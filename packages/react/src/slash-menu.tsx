import { type Editor, Extension, type Range } from "@tiptap/core";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
} from "@tiptap/pm/state";
import Suggestion, { exitSuggestion } from "@tiptap/suggestion";
import type { BlockProps, BlockRegistry, Messages } from "@useblocknotes/core";
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useId,
  useSyncExternalStore,
} from "react";
import { TITLE_NODE } from "./convert.js";
import {
  type FloatingProps,
  type FloatingReference,
  useFloating,
} from "./floating.js";
import { useMessages } from "./messages.js";
import { matchesShortcut, type ResolvedShortcuts } from "./shortcuts.js";

/** An entry of the slash menu, as shown to a slash menu component. */
export interface SlashMenuItem {
  /** Stable key, unique in the menu. */
  readonly key: string;
  /** Localized text. */
  readonly label: string;
  readonly icon?: ReactNode;
  /** Extra words that match this entry when filtering. */
  readonly keywords: readonly string[];
}

/** @internal An entry of the slash menu with its action. */
export interface SlashItem extends SlashMenuItem {
  /** Runs the entry. `range` is the typed `/query`, to be removed. */
  run(editor: Editor, range: Range): void;
}

/**
 * Turns the current block into `type` when it is empty, or inserts a new
 * block after it. Conversions keep the block id.
 */
function insertBlock(
  editor: Editor,
  range: Range,
  typeName: string,
  props: BlockProps,
): void {
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      const type = tr.doc.type.schema.nodes[typeName];
      tr.delete(range.from, range.to);
      const $from = tr.doc.resolve(range.from);
      if (type === undefined || $from.depth < 1) {
        return false;
      }
      const current = $from.node(1);
      const pos = $from.before(1);
      const end = pos + current.nodeSize;
      const empty =
        current.type.name !== TITLE_NODE && current.content.size === 0;
      const id: string | null = empty ? current.attrs["id"] : null;

      if (type.isTextblock) {
        if (empty) {
          tr.setBlockType(pos, end, type, {
            id,
            props,
          });
          return true;
        }
        tr.insert(
          end,
          type.create({
            id,
            props,
          }),
        );
        tr.setSelection(TextSelection.create(tr.doc, end + 1));
        return true;
      }

      const node = type.create({
        id,
        props,
      });
      const at = empty ? pos : end;
      if (empty) {
        tr.replaceWith(pos, end, node);
      } else {
        tr.insert(end, node);
      }
      tr.setSelection(NodeSelection.create(tr.doc, at));
      return true;
    })
    .scrollIntoView()
    .run();
}

/**
 * Slash menu entries of the registered blocks, in registry order. Entries
 * with a `messageKey` take their label from `messages.blocks`.
 */
export function blockSlashItems(
  registry: BlockRegistry<ReactNode>,
  messages: Messages,
): SlashItem[] {
  return [
    ...registry.blocks.values(),
  ].flatMap((definition) =>
    (definition.slash ?? []).map((entry, index) => ({
      ...(entry.icon === undefined || entry.icon === null
        ? {}
        : {
            icon: entry.icon,
          }),
      key: `${definition.type}:${index}`,
      keywords: entry.keywords ?? [],
      label:
        entry.messageKey === undefined
          ? entry.label
          : messages.blocks[entry.messageKey],
      run: (editor: Editor, range: Range) =>
        insertBlock(editor, range, definition.type, entry.defaultProps),
    })),
  );
}

/** Slash entry that removes the typed `/query` and opens the AI prompt. */
export function aiSlashItem(label: string, ask: () => void): SlashItem {
  return {
    icon: "AI",
    key: "ai",
    keywords: [
      "ai",
      "assistant",
      "generate",
      "write",
    ],
    label,
    run: (editor: Editor, range: Range) => {
      editor.chain().focus().deleteRange(range).run();
      ask();
    },
  };
}

/** Items matching `query` in label or keywords; label prefix matches first. */
export function filterSlashItems(
  items: readonly SlashItem[],
  query: string,
): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (q === "") {
    return [
      ...items,
    ];
  }
  const matches = items.filter((item) =>
    [
      item.label,
      ...item.keywords,
    ].some((word) => word.toLowerCase().includes(q)),
  );
  const prefix = matches.filter((item) =>
    item.label.toLowerCase().startsWith(q),
  );
  return [
    ...prefix,
    ...matches.filter((item) => !prefix.includes(item)),
  ];
}

/** State and actions of the open slash menu. */
export interface SlashMenuState {
  /** Entries matching `query`, best matches first. */
  readonly items: readonly SlashMenuItem[];
  /** Text typed after `/`. */
  readonly query: string;
  /**
   * Highlighted entry. The `slashMenuUp`, `slashMenuDown` and
   * `slashMenuSelect` shortcuts (arrows, Enter and Tab by default) move and
   * run it; the editor handles those keys.
   */
  readonly selectedIndex: number;
  /** Position of the typed `/query`. */
  readonly reference: FloatingReference;
  /** Runs the entry at `index` and closes the menu. */
  select(index: number): void;
  /** Highlights the entry at `index`, for example on hover. */
  highlight(index: number): void;
  /** Closes the menu and leaves the typed text. */
  close(): void;
}

/** Live slash menu state of an editor. `null` while the menu is closed. */
export interface SlashMenuStore {
  getState(): SlashMenuState | null;
  /** Calls `listener` on every change. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/** @internal A store the slash menu extension writes to. */
export interface WritableSlashMenuStore extends SlashMenuStore {
  setState(state: SlashMenuState | null): void;
}

/** @internal */
export function createSlashMenuStore(): WritableSlashMenuStore {
  let state: SlashMenuState | null = null;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (next) => {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Options of the slash menu extension. */
export interface SlashMenuOptions {
  /** Current entries; read each time the menu filters. */
  items(): readonly SlashItem[];
  /** Receives the menu state for `<BlockNotesEditor />` to render. */
  readonly store: WritableSlashMenuStore;
  /** Keys that move, run and close the menu. */
  readonly shortcuts: ResolvedShortcuts;
}

/**
 * Handles the menu keys while it is open. Every other key reaches the editor,
 * except Escape, which the suggestion plugin would always use to close.
 */
function handleMenuKey(
  menu: SlashMenuState,
  event: KeyboardEvent,
  shortcuts: ResolvedShortcuts,
): boolean {
  const count = menu.items.length;
  if (matchesShortcut(event, shortcuts.slashMenuClose)) {
    menu.close();
    return true;
  }
  if (count > 0 && matchesShortcut(event, shortcuts.slashMenuDown)) {
    menu.highlight((menu.selectedIndex + 1) % count);
    return true;
  }
  if (count > 0 && matchesShortcut(event, shortcuts.slashMenuUp)) {
    menu.highlight((menu.selectedIndex - 1 + count) % count);
    return true;
  }
  if (count > 0 && matchesShortcut(event, shortcuts.slashMenuSelect)) {
    menu.select(menu.selectedIndex);
    return true;
  }
  return event.key === "Escape" || event.key === "Esc";
}

const slashMenuKey = new PluginKey("blockNotesSlashMenu");

/**
 * @internal The `/` menu. Opens after `/` at the start of a block or after a
 * space, filters entries as the user types, and runs the selected entry.
 * Not available in the title or in code blocks. Its state goes to `store`;
 * `<BlockNotesEditor />` renders it.
 */
export function createSlashMenu(options: SlashMenuOptions): Extension {
  const { shortcuts, store } = options;
  return Extension.create({
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        new Plugin({
          key: new PluginKey("blockNotesSlashMenuKeys"),
          props: {
            handleKeyDown: (_view, event) => {
              const menu = store.getState();
              return menu !== null && handleMenuKey(menu, event, shortcuts);
            },
          },
        }),
        Suggestion<SlashItem, SlashItem>({
          allow: ({ range, state }) => {
            const $from = state.doc.resolve(range.from);
            const parent = $from.parent;
            return (
              $from.depth === 1 &&
              parent.type.name !== TITLE_NODE &&
              parent.type.spec.code !== true
            );
          },
          char: "/",
          command: ({ editor: target, props, range }) =>
            props.run(target, range),
          editor,
          items: ({ query }) => filterSlashItems(options.items(), query),
          pluginKey: slashMenuKey,
          render: () => {
            let items: readonly SlashItem[] = [];
            let query = "";
            let selected = 0;
            let command: ((item: SlashItem) => void) | null = null;
            let clientRect: (() => DOMRect | null) | null = null;
            // One reference per opening, reading the latest position.
            let reference: FloatingReference | null = null;

            const select = (index: number): void => {
              const item = items[index];
              if (item !== undefined) {
                command?.(item);
              }
            };
            const close = (): void => exitSuggestion(editor.view, slashMenuKey);
            const highlight = (index: number): void => {
              if (index >= 0 && index < items.length && index !== selected) {
                selected = index;
                publish();
              }
            };
            const publish = (): void => {
              if (reference === null) {
                return;
              }
              store.setState({
                close,
                highlight,
                items,
                query,
                reference,
                select,
                selectedIndex: selected,
              });
            };

            return {
              onExit: () => {
                reference = null;
                store.setState(null);
              },
              onStart: (suggestion) => {
                items = suggestion.items;
                query = suggestion.query;
                selected = 0;
                command = suggestion.command;
                clientRect = suggestion.clientRect ?? null;
                reference = {
                  contextElement: suggestion.editor.view.dom,
                  getBoundingClientRect: () => clientRect?.() ?? new DOMRect(),
                };
                publish();
              },
              onUpdate: (suggestion) => {
                items = suggestion.items;
                query = suggestion.query;
                selected = Math.min(selected, Math.max(0, items.length - 1));
                command = suggestion.command;
                clientRect = suggestion.clientRect ?? null;
                publish();
              },
            };
          },
          startOfLine: false,
        }),
      ];
    },
    name: "blockNotesSlashMenu",
    // Menu keys run before the editor shortcuts (Enter, Tab, arrows).
    priority: 1100,
  });
}

/** Props of a slash menu component (see `components.slashMenu`). */
export interface SlashMenuProps extends SlashMenuState {
  /** Spread on the root element to let the editor position it. */
  readonly floating: FloatingProps;
}

/**
 * The built-in slash menu: a listbox of entries with icons. Uses the
 * `bn-slash-*` classes.
 */
export function SlashMenu({
  floating,
  highlight,
  items,
  select,
  selectedIndex,
}: SlashMenuProps): ReactNode {
  const messages = useMessages().slashMenu;
  const id = useId();
  return (
    <div
      {...floating}
      className="bn-slash-menu"
    >
      {items.length === 0 ? (
        <div className="bn-slash-empty">{messages.empty}</div>
      ) : (
        <div
          aria-activedescendant={`${id}-${selectedIndex}`}
          aria-label={messages.label}
          className="bn-slash-list"
          role="listbox"
          tabIndex={-1}
        >
          {items.map((item, index) => (
            <div
              aria-selected={index === selectedIndex}
              className="bn-slash-item"
              data-selected={index === selectedIndex ? "" : undefined}
              id={`${id}-${index}`}
              key={item.key}
              // Keep the editor focused: select on mouse down.
              onMouseDown={(event) => {
                event.preventDefault();
                select(index);
              }}
              onMouseEnter={() => highlight(index)}
              role="option"
              tabIndex={-1}
            >
              {item.icon === undefined ? null : (
                <span
                  aria-hidden="true"
                  className="bn-slash-icon"
                >
                  {item.icon}
                </span>
              )}
              <span className="bn-slash-label">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Reads the live slash menu state of an editor, or `null` while it is closed.
 * Use it to render a slash menu outside `<BlockNotesEditor />` (pass
 * `components={{ slashMenu: null }}` to hide the built-in one).
 *
 * @example
 * ```tsx
 * const menu = useSlashMenu(editor);
 * return menu === null ? null : <MyMenu {...menu} />;
 * ```
 */
export function useSlashMenu(editor: {
  readonly slashMenu: SlashMenuStore;
}): SlashMenuState | null {
  const store = editor.slashMenu;
  return useSyncExternalStore(store.subscribe, store.getState, () => null);
}

/**
 * @internal Renders the slash menu component while the menu is open, and
 * closes the menu on a pointer down outside the editor and outside any
 * element with `data-bn-slash-menu` (the host, or a portal of a custom menu).
 */
export function SlashMenuHost({
  component: Component,
  editorElement,
  store,
}: {
  readonly component: ComponentType<SlashMenuProps>;
  readonly editorElement: Element | null;
  readonly store: SlashMenuStore;
}): ReactNode {
  const state = useSlashMenu({
    slashMenu: store,
  });
  const floating = useFloating(state?.reference ?? null, "bottom-start");
  const close = state?.close;
  useEffect(() => {
    if (close === undefined) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (
        target instanceof Node &&
        !editorElement?.contains(target) &&
        !(target instanceof Element && target.closest("[data-bn-slash-menu]"))
      ) {
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [
    close,
    editorElement,
  ]);
  if (state === null) {
    return null;
  }
  return (
    <div
      className="bn-slash-host"
      data-bn-slash-menu=""
    >
      <Component
        {...state}
        floating={floating}
      />
    </div>
  );
}
