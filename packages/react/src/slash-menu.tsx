import { type Editor, Extension, type Range } from "@tiptap/core";
import { NodeSelection, PluginKey, TextSelection } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import type { BlockProps, BlockRegistry } from "@useblocknotes/core";
import { type ReactNode, useId } from "react";
import { TITLE_NODE } from "./convert.js";

/** An entry of the slash menu. */
export interface SlashItem {
  /** Stable key, unique in the menu. */
  readonly key: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly keywords: readonly string[];
  /** Runs the entry. `range` is the typed `/query`, to be removed. */
  run(editor: Editor, range: Range): void;
}

/** Texts of the slash menu. */
export interface SlashMenuMessages {
  /** Shown when no entry matches the query. */
  readonly empty: string;
  /** Accessible name of the menu. */
  readonly label: string;
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

/** Slash menu entries of the registered blocks, in registry order. */
export function blockSlashItems(
  registry: BlockRegistry<ReactNode>,
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
      label: entry.label,
      run: (editor: Editor, range: Range) =>
        insertBlock(editor, range, definition.type, entry.defaultProps),
    })),
  );
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

interface SlashMenuListProps {
  readonly items: readonly SlashItem[];
  readonly selected: number;
  readonly messages: SlashMenuMessages;
  readonly onSelect: (index: number) => void;
  readonly onHover: (index: number) => void;
}

function SlashMenuList({
  items,
  messages,
  onHover,
  onSelect,
  selected,
}: SlashMenuListProps): ReactNode {
  const id = useId();
  if (items.length === 0) {
    return <div className="bn-slash-empty">{messages.empty}</div>;
  }
  return (
    <div
      aria-activedescendant={`${id}-${selected}`}
      aria-label={messages.label}
      className="bn-slash-list"
      role="listbox"
      tabIndex={-1}
    >
      {items.map((item, index) => (
        <div
          aria-selected={index === selected}
          className="bn-slash-item"
          data-selected={index === selected ? "" : undefined}
          id={`${id}-${index}`}
          key={item.key}
          // Keep the editor focused: select on mouse down.
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(index);
          }}
          onMouseEnter={() => onHover(index)}
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
  );
}

/** Options of the slash menu extension. */
export interface SlashMenuOptions {
  readonly items: readonly SlashItem[];
  readonly messages: SlashMenuMessages;
}

/**
 * @internal The `/` menu. Opens after `/` at the start of a block or after a
 * space, filters entries as the user types, and runs the selected entry.
 * Not available in the title or in code blocks.
 */
export function createSlashMenu(options: SlashMenuOptions): Extension {
  return Extension.create({
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
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
          dismissOnOutsideClick: true,
          editor,
          floatingUi: {
            strategy: "fixed",
          },
          items: ({ query }) => filterSlashItems(options.items, query),
          pluginKey: new PluginKey("blockNotesSlashMenu"),
          render: () => {
            let renderer: ReactRenderer<ReactNode, SlashMenuListProps> | null =
              null;
            let unmount: (() => void) | null = null;
            let element: HTMLElement | null = null;
            let items: readonly SlashItem[] = [];
            let selected = 0;
            let command: ((item: SlashItem) => void) | null = null;

            const props = (): SlashMenuListProps => ({
              items,
              messages: options.messages,
              onHover: (index) => {
                selected = index;
                renderer?.updateProps(props());
              },
              onSelect: (index) => {
                const item = items[index];
                if (item !== undefined) {
                  command?.(item);
                }
              },
              selected,
            });

            return {
              onExit: () => {
                unmount?.();
                renderer?.destroy();
                element?.remove();
                renderer = null;
                unmount = null;
                element = null;
              },
              onKeyDown: ({ event }) => {
                if (items.length === 0) {
                  return false;
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  selected = (selected + step + items.length) % items.length;
                  renderer?.updateProps(props());
                  return true;
                }
                if (event.key === "Enter" || event.key === "Tab") {
                  props().onSelect(selected);
                  return true;
                }
                return false;
              },
              onStart: (suggestion) => {
                items = suggestion.items;
                selected = 0;
                command = suggestion.command;
                renderer = new ReactRenderer(SlashMenuList, {
                  editor: suggestion.editor,
                  props: props(),
                });
                element = renderer.element;
                element.classList.add("bn-slash-menu");
                // Mount inside the editor root so `--bn-*` variables apply.
                const root =
                  suggestion.editor.view.dom.closest("[data-bn-root]") ??
                  document.body;
                root.appendChild(element);
                unmount = suggestion.mount?.(element) ?? null;
              },
              onUpdate: (suggestion) => {
                items = suggestion.items;
                selected = Math.min(selected, Math.max(0, items.length - 1));
                command = suggestion.command;
                renderer?.updateProps(props());
              },
            };
          },
          startOfLine: false,
        }),
      ];
    },
    name: "blockNotesSlashMenu",
  });
}
