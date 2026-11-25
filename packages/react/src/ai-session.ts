import { Extension } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  type EditorState,
  Plugin,
  PluginKey,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  type AiOperation,
  type AiSelection,
  type AiStreamState,
  type BlockNotesDocument,
  type BlockRegistry,
  diffDocuments,
  type OperationError,
  type Result,
} from "@useblocknotes/core";
import type { ReactNode } from "react";
import { nodeToDocument, TITLE_NODE } from "./convert.js";
import { applyOperationsToTransaction } from "./transaction.js";

/** Blocks written by AI, highlighted while the batch is pending. */
export interface AiHighlight {
  readonly ids: ReadonlySet<string>;
  /** Block being written, marked `data-bn-ai="active"`. */
  readonly active: string | null;
}

const NO_HIGHLIGHT: AiHighlight = {
  active: null,
  ids: new Set(),
};

const aiHighlightKey = new PluginKey<AiHighlight>("blockNotesAi");

/**
 * @internal Decorates AI blocks with the `bn-ai-block` class and a
 * `data-bn-ai` attribute (`"active"` on the block being written).
 */
export const AiHighlightExtension = Extension.create({
  addProseMirrorPlugins() {
    return [
      new Plugin<AiHighlight>({
        key: aiHighlightKey,
        props: {
          decorations(state) {
            const highlight = aiHighlightKey.getState(state) ?? NO_HIGHLIGHT;
            if (highlight.ids.size === 0) {
              return null;
            }
            const decorations: Decoration[] = [];
            state.doc.forEach((node, pos) => {
              const id: string | null = node.attrs["id"] ?? null;
              if (id !== null && highlight.ids.has(id)) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: "bn-ai-block",
                    "data-bn-ai": id === highlight.active ? "active" : "",
                  }),
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
        state: {
          apply(tr, value) {
            const next: AiHighlight | undefined = tr.getMeta(aiHighlightKey);
            return next ?? value;
          },
          init: () => NO_HIGHLIGHT,
        },
      }),
    ];
  },
  name: "blockNotesAiHighlight",
});

/** The part of an editor view the AI session needs. */
export interface AiView {
  readonly state: EditorState;
  dispatch(tr: Transaction): void;
}

/** Ids of blocks the batch inserts or updates that exist in `document`. */
function writtenIds(
  operations: readonly AiOperation[],
  document: BlockNotesDocument,
): Set<string> {
  const present = new Set(document.blocks.map((block) => block.id));
  const ids = new Set<string>();
  for (const operation of operations) {
    const id = operation.op === "insert" ? operation.block.id : operation.id;
    if (
      (operation.op === "insert" || operation.op === "update") &&
      present.has(id)
    ) {
      ids.add(id);
    }
  }
  return ids;
}

/** Replaces the editor content with `target`, outside the undo history. */
function showDocument(
  view: AiView,
  target: BlockNotesDocument,
  highlight: AiHighlight,
): void {
  const tr = view.state.tr;
  const operations = diffDocuments(nodeToDocument(tr.doc), target);
  applyOperationsToTransaction(tr, operations, {});
  tr.setMeta("addToHistory", false);
  tr.setMeta(aiHighlightKey, highlight);
  view.dispatch(tr);
}

/** Shows the stream's preview document with AI blocks highlighted. */
export function showAiPreview(view: AiView, state: AiStreamState): void {
  showDocument(view, state.document, {
    active: state.activeBlockId,
    ids: writtenIds(state.operations, state.document),
  });
}

/** Restores the document the AI request started from. */
export function rejectAiPreview(view: AiView, base: BlockNotesDocument): void {
  showDocument(view, base, NO_HIGHLIGHT);
}

/**
 * Restores `base`, then applies the batch as a single undo step that is not
 * merged with edits before or after it.
 */
export function acceptAiPreview(
  view: AiView,
  base: BlockNotesDocument,
  operations: readonly AiOperation[],
  registry: BlockRegistry<ReactNode>,
): Result<BlockNotesDocument, OperationError> {
  rejectAiPreview(view, base);
  const tr = closeHistory(view.state.tr);
  const result = applyOperationsToTransaction(tr, operations, {
    registry,
  });
  if (result.ok) {
    view.dispatch(tr);
    view.dispatch(closeHistory(view.state.tr));
  }
  return result;
}

/** Selected blocks and text, and the block that has the cursor. */
export interface EditorSelection {
  readonly selection: AiSelection | null;
  readonly anchorBlockId: string | null;
}

function blockId(node: PMNode | null | undefined): string | null {
  if (node === null || node === undefined || node.type.name === TITLE_NODE) {
    return null;
  }
  const id: string | null = node.attrs["id"] ?? null;
  return id;
}

/** Reads the AI selection from the editor state. */
export function readSelection(state: EditorState): EditorSelection {
  const { $from, empty, from, to } = state.selection;
  const anchorBlockId =
    $from.depth >= 1 ? blockId($from.node(1)) : blockId($from.nodeAfter);
  if (empty) {
    return {
      anchorBlockId,
      selection: null,
    };
  }
  const blockIds: string[] = [];
  state.doc.nodesBetween(from, to, (node) => {
    const id = blockId(node);
    if (id !== null) {
      blockIds.push(id);
    }
    return false;
  });
  return {
    anchorBlockId,
    selection:
      blockIds.length === 0
        ? null
        : {
            blockIds,
            text: state.doc.textBetween(from, to, "\n", "\n"),
          },
  };
}
