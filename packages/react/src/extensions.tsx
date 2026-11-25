import {
  type AnyExtension,
  Extension,
  type Extensions,
  Node,
} from "@tiptap/core";
import Bold from "@tiptap/extension-bold";
import Code from "@tiptap/extension-code";
import Document from "@tiptap/extension-document";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import Strike from "@tiptap/extension-strike";
import Text from "@tiptap/extension-text";
import Underline from "@tiptap/extension-underline";
import {
  Dropcursor,
  Gapcursor,
  Placeholder,
  UndoRedo,
} from "@tiptap/extensions";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  NodeViewContent,
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
  useEditorState,
} from "@tiptap/react";
import {
  type BlockProps,
  type BlockRegistry,
  createBlockId,
  type JsonValue,
  type Messages,
} from "@useblocknotes/core";
import type { ReactNode } from "react";
import type { $ZodType } from "zod/v4/core";
import { safeParse } from "zod/v4/core";
import { AiHighlightExtension } from "./ai-session.js";
import { BlockViewContext } from "./context.js";
import { BLOCK_GROUP, nodeToBlock, TITLE_NODE } from "./convert.js";
import { BlockKeymap, ListNumbers, listNumberOf } from "./lists.js";
import { BlockMove, DragHandle } from "./move.js";
import { aiSlashItem, blockSlashItems, createSlashMenu } from "./slash-menu.js";
import type { ReactBlockDefinition, ReactInlineDefinition } from "./types.js";

/** Props when the schema accepts `{}`, else `{}` (validated on insert). */
function defaultProps(schema: $ZodType<BlockProps>): BlockProps {
  const result = safeParse(schema, {});
  return result.success ? result.data : {};
}

/** Parses and validates props stored in pasted HTML, falling back to defaults. */
function propsFromHTML(
  element: HTMLElement,
  schema: $ZodType<BlockProps>,
): BlockProps {
  const raw = element.getAttribute("data-bn-props");
  if (raw !== null) {
    try {
      const json: JsonValue = JSON.parse(raw);
      const result = safeParse(schema, json);
      if (result.success) {
        return result.data;
      }
    } catch {
      // Invalid JSON: use defaults.
    }
  }
  return defaultProps(schema);
}

function propsAttribute(schema: $ZodType<BlockProps>) {
  return {
    default: defaultProps(schema),
    parseHTML: (element: HTMLElement) => propsFromHTML(element, schema),
    renderHTML: (attributes: Record<string, BlockProps>) => ({
      "data-bn-props": JSON.stringify(attributes["props"] ?? {}),
    }),
  };
}

function BlockView(
  props: ReactNodeViewProps & {
    readonly definition: ReactBlockDefinition;
    readonly registry: BlockRegistry<ReactNode>;
  },
): ReactNode {
  const { decorations, definition, editor, node, registry, updateAttributes } =
    props;
  const editable = useEditorState({
    editor,
    selector: (snapshot) => snapshot.editor.isEditable,
  });
  const block = nodeToBlock(node);
  const Render = definition.render;
  let body: ReactNode;
  if (Render !== undefined) {
    body = (
      <Render
        block={block}
        editable={editable}
        updateProps={(next: BlockProps) =>
          updateAttributes({
            props: next,
          })
        }
      />
    );
  } else if (definition.content !== "none") {
    body = <NodeViewContent className="bn-block-content" />;
  } else {
    body = (
      <div className="bn-block-content">
        {definition.toText(block, registry.text)}
      </div>
    );
  }
  return (
    <BlockViewContext
      value={{
        listNumber: listNumberOf(decorations),
      }}
    >
      <NodeViewWrapper
        className="bn-block"
        data-bn-block=""
        data-bn-id={block.id}
        data-bn-type={block.type}
      >
        {editable ? <DragHandle /> : null}
        {body}
      </NodeViewWrapper>
    </BlockViewContext>
  );
}

function blockNode(
  definition: ReactBlockDefinition,
  registry: BlockRegistry<ReactNode>,
): AnyExtension {
  const inline = definition.content !== "none";
  const plainText = definition.content === "text";
  return Node.create({
    ...(plainText
      ? {
          code: true,
          marks: "",
          whitespace: "pre" as const,
        }
      : {}),
    addAttributes() {
      return {
        id: {
          default: null,
          // Ids are never read from HTML, so copy/paste always gets new ids.
          keepOnSplit: false,
          parseHTML: () => null,
          renderHTML: (attributes: Record<string, string | null>) => ({
            "data-bn-id": attributes["id"],
          }),
        },
        props: propsAttribute(definition.schema),
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(
        (props: ReactNodeViewProps) => (
          <BlockView
            {...props}
            definition={definition}
            registry={registry}
          />
        ),
        {
          // Inline content may sit inside <p> or <h1>, where <div> is invalid.
          contentDOMElementTag: "span",
        },
      );
    },
    atom: !inline,
    content: plainText ? "text*" : inline ? "inline*" : "",
    defining: true,
    // Dragged by the handle only (see `DragHandle`), never by its content.
    draggable: true,
    group: BLOCK_GROUP,
    name: definition.type,
    parseHTML() {
      return [
        {
          tag: `div[data-bn-type="${definition.type}"]`,
        },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      const attributes = {
        ...HTMLAttributes,
        "data-bn-type": definition.type,
      };
      return inline
        ? [
            "div",
            attributes,
            0,
          ]
        : [
            "div",
            attributes,
          ];
    },
    selectable: !inline,
  });
}

function InlineView(
  props: ReactNodeViewProps & {
    readonly definition: ReactInlineDefinition;
  },
): ReactNode {
  const { definition, node } = props;
  const element = {
    props: nodeToBlock(node).props,
    type: node.type.name,
  };
  const Render = definition.render;
  return (
    <NodeViewWrapper
      as="span"
      className="bn-inline"
      data-bn-inline={element.type}
    >
      {Render === undefined ? (
        definition.toText(element)
      ) : (
        <Render node={element} />
      )}
    </NodeViewWrapper>
  );
}

function inlineNode(definition: ReactInlineDefinition): AnyExtension {
  return Node.create({
    addAttributes() {
      return {
        props: propsAttribute(definition.schema),
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer((props: ReactNodeViewProps) => (
        <InlineView
          {...props}
          definition={definition}
        />
      ));
    },
    atom: true,
    group: "inline",
    inline: true,
    name: definition.type,
    parseHTML() {
      return [
        {
          tag: `span[data-bn-inline="${definition.type}"]`,
        },
      ];
    },
    renderHTML({ HTMLAttributes, node }) {
      return [
        "span",
        {
          ...HTMLAttributes,
          "data-bn-inline": definition.type,
        },
        definition.toText({
          props: nodeToBlock(node).props,
          type: definition.type,
        }),
      ];
    },
  });
}

const Title = Node.create({
  content: "text*",
  defining: true,
  marks: "",
  name: TITLE_NODE,
  parseHTML() {
    return [
      {
        tag: "h1[data-bn-title]",
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "h1",
      {
        ...HTMLAttributes,
        class: "bn-title",
        "data-bn-title": "",
      },
      0,
    ];
  },
});

/** Gives every block a unique id: new blocks and duplicates get a fresh one. */
const BlockIds = Extension.create({
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) {
            return null;
          }
          const tr = newState.tr;
          const seen = new Set<string>();
          newState.doc.forEach((node, pos) => {
            if (node.type.name === TITLE_NODE) {
              return;
            }
            const id: string | null | undefined = node.attrs["id"];
            if (id === null || id === undefined || seen.has(id)) {
              const next = createBlockId();
              seen.add(next);
              tr.setNodeAttribute(pos, "id", next);
            } else {
              seen.add(id);
            }
          });
          return tr.docChanged ? tr : null;
        },
        key: new PluginKey("blockNotesIds"),
      }),
    ];
  },
  name: "blockNotesIds",
});

/** Options of {@link createExtensions}. */
export interface ExtensionOptions {
  /** Current UI messages; read each time a text is shown. */
  messages(): Messages;
  /** AI entry points (`/ai` and `Mod-J`), or `null` without an adapter. */
  readonly ai?: AiEntry | null;
}

/** Opens the AI prompt from the slash menu and the keyboard. */
export interface AiEntry {
  /** Opens the AI prompt for the current selection. */
  ask(): void;
}

function aiShortcut(entry: AiEntry): AnyExtension {
  return Extension.create({
    addKeyboardShortcuts() {
      return {
        "Mod-j": () => {
          entry.ask();
          return true;
        },
      };
    },
    name: "blockNotesAiShortcut",
  });
}

/** Builds the Tiptap extensions for a registry. */
export function createExtensions(
  registry: BlockRegistry<ReactNode>,
  options: ExtensionOptions,
): Extensions {
  const { messages } = options;
  const ai = options.ai ?? null;
  return [
    Document.extend({
      content: `${TITLE_NODE} ${BLOCK_GROUP}*`,
    }),
    Text,
    Title,
    ...[
      ...registry.blocks.values(),
    ].map((definition) => blockNode(definition, registry)),
    ...[
      ...registry.inlines.values(),
    ].map(inlineNode),
    Bold,
    Italic,
    Underline,
    Strike,
    Code,
    Link.configure({
      autolink: true,
      openOnClick: false,
    }),
    UndoRedo,
    Dropcursor,
    Gapcursor,
    Placeholder.configure({
      placeholder: ({ hasAnchor, node }) => {
        if (node.type.name === TITLE_NODE) {
          return messages().placeholders.title;
        }
        return hasAnchor ? messages().placeholders.block : "";
      },
      showOnlyCurrent: false,
    }),
    BlockIds,
    ListNumbers,
    BlockKeymap,
    BlockMove,
    createSlashMenu({
      items: () =>
        ai === null
          ? blockSlashItems(registry, messages())
          : [
              aiSlashItem(messages().ai.askAi, ai.ask),
              ...blockSlashItems(registry, messages()),
            ],
      messages: () => messages().slashMenu,
    }),
    AiHighlightExtension,
    ...(ai === null
      ? []
      : [
          aiShortcut(ai),
        ]),
  ];
}
