import { Extension, InputRule } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { type BlockProps, MAX_LIST_INDENT } from "@useblocknotes/core";
import { nodeToBlock, TITLE_NODE } from "./convert.js";

const PARAGRAPH = "paragraph";
const BULLET = "bulletListItem";
const NUMBERED = "numberedListItem";
const CODE = "codeBlock";

function isList(node: PMNode): boolean {
  return node.type.name === BULLET || node.type.name === NUMBERED;
}

function indentOf(node: PMNode): number {
  const indent = nodeToBlock(node).props["indent"];
  return typeof indent === "number" ? indent : 0;
}

/** Computes list numbers: consecutive numbered items per indent level. */
function listNumbers(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  let counts: number[] = [];
  doc.forEach((node, pos) => {
    if (!isList(node)) {
      counts = [];
      return;
    }
    const indent = indentOf(node);
    counts = counts.slice(0, indent + 1);
    while (counts.length <= indent) {
      counts.push(0);
    }
    if (node.type.name === BULLET) {
      counts[indent] = 0;
      return;
    }
    const listNumber = (counts[indent] ?? 0) + 1;
    counts[indent] = listNumber;
    decorations.push(
      Decoration.node(
        pos,
        pos + node.nodeSize,
        {
          "data-bn-list-number": String(listNumber),
        },
        {
          listNumber,
        },
      ),
    );
  });
  return DecorationSet.create(doc, decorations);
}

const listNumbersKey = new PluginKey<DecorationSet>("blockNotesListNumbers");

/** @internal Numbers numbered list items with node decorations. */
export const ListNumbers = Extension.create({
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: listNumbersKey,
        props: {
          decorations: (state) => listNumbersKey.getState(state),
        },
        state: {
          apply: (tr, previous) =>
            tr.docChanged ? listNumbers(tr.doc) : previous,
          init: (_config, state) => listNumbers(state.doc),
        },
      }),
    ];
  },
  name: "blockNotesListNumbers",
});

/** @internal Reads the list number from a node view's decorations. */
export function listNumberOf(
  decorations: readonly Decoration[],
): number | null {
  for (const decoration of decorations) {
    const listNumber: number | undefined = decoration.spec.listNumber;
    if (typeof listNumber === "number") {
      return listNumber;
    }
  }
  return null;
}

interface CurrentBlock {
  readonly node: PMNode;
  readonly pos: number;
  /** Cursor offset inside the block's content. */
  readonly offset: number;
}

/** The top-level block holding a collapsed selection, if any. */
function currentBlock(tr: Transaction): CurrentBlock | null {
  const { selection } = tr;
  const { $from } = selection;
  if (!selection.empty || $from.depth < 1) {
    return null;
  }
  const node = $from.node(1);
  if (node.type.name === TITLE_NODE || !node.isTextblock) {
    return null;
  }
  return {
    node,
    offset: $from.parentOffset,
    pos: $from.before(1),
  };
}

function setProps(
  tr: Transaction,
  block: CurrentBlock,
  props: BlockProps,
): boolean {
  tr.setNodeMarkup(block.pos, undefined, {
    ...block.node.attrs,
    props,
  });
  return true;
}

/** Converts a block to another type, keeping its id and content. */
function convert(
  tr: Transaction,
  block: CurrentBlock,
  typeName: string,
  props: BlockProps,
): boolean {
  const type = tr.doc.type.schema.nodes[typeName];
  if (type === undefined) {
    return false;
  }
  tr.setBlockType(block.pos, block.pos + block.node.nodeSize, type, {
    id: block.node.attrs["id"],
    props,
  });
  return true;
}

function changeIndent(tr: Transaction, delta: number): boolean {
  const block = currentBlock(tr);
  if (block === null || !isList(block.node)) {
    return false;
  }
  const indent = Math.min(
    MAX_LIST_INDENT,
    Math.max(0, indentOf(block.node) + delta),
  );
  if (indent !== indentOf(block.node)) {
    setProps(tr, block, {
      ...nodeToBlock(block.node).props,
      indent,
    });
  }
  // Keep focus in the editor at the indent bounds.
  return true;
}

function handleEnter(tr: Transaction): boolean {
  const block = currentBlock(tr);
  if (block === null) {
    return false;
  }
  const { node, pos } = block;

  if (isList(node)) {
    if (node.content.size === 0) {
      const indent = indentOf(node);
      return indent > 0
        ? setProps(tr, block, {
            ...nodeToBlock(node).props,
            indent: indent - 1,
          })
        : convert(tr, block, PARAGRAPH, {});
    }
    // Continue the list with the same type and props, and a new id.
    tr.split(tr.selection.from, 1, [
      {
        attrs: {
          id: null,
          props: node.attrs["props"],
        },
        type: node.type,
      },
    ]);
    tr.scrollIntoView();
    return true;
  }

  // Leave a code block with Enter on two trailing empty lines.
  const paragraph = tr.doc.type.schema.nodes[PARAGRAPH];
  if (
    node.type.name === CODE &&
    paragraph !== undefined &&
    block.offset === node.content.size &&
    node.textContent.endsWith("\n\n")
  ) {
    const end = pos + 1 + node.content.size;
    tr.delete(end - 2, end);
    const after = tr.mapping.map(pos + node.nodeSize);
    tr.insert(after, paragraph.create());
    tr.setSelection(TextSelection.create(tr.doc, after + 1));
    tr.scrollIntoView();
    return true;
  }
  return false;
}

function handleBackspace(tr: Transaction): boolean {
  const block = currentBlock(tr);
  if (
    block === null ||
    block.offset !== 0 ||
    block.node.type.name === PARAGRAPH
  ) {
    return false;
  }
  const indent = isList(block.node) ? indentOf(block.node) : 0;
  return indent > 0
    ? setProps(tr, block, {
        ...nodeToBlock(block.node).props,
        indent: indent - 1,
      })
    : convert(tr, block, PARAGRAPH, {});
}

/** Markdown shortcut typed at the start of a paragraph, e.g. `- `. */
function shortcut(
  find: RegExp,
  typeName: string,
  props: (match: RegExpMatchArray) => BlockProps,
): InputRule {
  return new InputRule({
    find,
    handler: ({ match, range, state }) => {
      const type = state.schema.nodes[typeName];
      const $start = state.doc.resolve(range.from);
      if (type === undefined || $start.depth < 1) {
        return null;
      }
      const node = $start.node(1);
      if (node.type.name !== PARAGRAPH) {
        return null;
      }
      state.tr
        .delete(range.from, range.to)
        .setBlockType(range.from, range.from, type, {
          id: node.attrs["id"],
          props: props(match),
        });
      return;
    },
  });
}

/**
 * @internal Notion-like keys for built-in blocks: Enter continues or ends
 * lists, Tab and Shift-Tab indent list items, Backspace at the start turns a
 * block into a paragraph, Enter on two empty lines leaves a code block, and
 * Markdown shortcuts (`- `, `1. `, `> `, ```` ``` ````, `# `) convert paragraphs.
 */
export const BlockKeymap = Extension.create({
  addInputRules() {
    return [
      shortcut(/^\s*[-+*]\s$/, BULLET, () => ({
        indent: 0,
      })),
      shortcut(/^\d+[.)]\s$/, NUMBERED, () => ({
        indent: 0,
      })),
      shortcut(/^>\s$/, "quote", () => ({})),
      shortcut(/^```([\w+#-]*)\s$/, CODE, (match) => ({
        language: match[1] ?? "",
      })),
      shortcut(/^(#{1,3})\s$/, "heading", (match) => ({
        level: match[1]?.length ?? 1,
      })),
    ];
  },
  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr }) => handleBackspace(tr)),
      Enter: () => this.editor.commands.command(({ tr }) => handleEnter(tr)),
      "Shift-Tab": () =>
        this.editor.commands.command(({ tr }) => changeIndent(tr, -1)),
      Tab: () => this.editor.commands.command(({ tr }) => changeIndent(tr, 1)),
    };
  },
  name: "blockNotesKeymap",
  // Run before Tiptap's default Enter and Backspace handling.
  priority: 1000,
});
