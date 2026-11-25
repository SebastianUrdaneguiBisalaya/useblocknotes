import { Extension } from "@tiptap/core";
import {
  NodeSelection,
  type Selection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import type { ReactNode } from "react";
import { TITLE_NODE } from "./convert.js";

/**
 * @internal Handle shown on hover to drag a block. Tiptap starts a native
 * ProseMirror drag of the whole block from any `data-drag-handle` element,
 * and the drop moves the node, so its id is kept.
 */
export function DragHandle(): ReactNode {
  return (
    <div
      aria-hidden="true"
      className="bn-drag-handle"
      contentEditable={false}
      data-drag-handle=""
      draggable="true"
    >
      <svg
        aria-hidden="true"
        fill="currentColor"
        height="14"
        viewBox="0 0 10 16"
        width="9"
      >
        <circle
          cx="2"
          cy="2"
          r="1.5"
        />
        <circle
          cx="8"
          cy="2"
          r="1.5"
        />
        <circle
          cx="2"
          cy="8"
          r="1.5"
        />
        <circle
          cx="8"
          cy="8"
          r="1.5"
        />
        <circle
          cx="2"
          cy="14"
          r="1.5"
        />
        <circle
          cx="8"
          cy="14"
          r="1.5"
        />
      </svg>
    </div>
  );
}

/** Maps the selection into the moved block, shifted by `offset`. */
function shiftSelection(
  tr: Transaction,
  selection: Selection,
  offset: number,
): Selection {
  if (selection instanceof NodeSelection) {
    return NodeSelection.create(tr.doc, selection.from + offset);
  }
  return TextSelection.create(
    tr.doc,
    selection.anchor + offset,
    selection.head + offset,
  );
}

/** Moves the block holding the selection one position up or down. */
export function moveBlock(tr: Transaction, direction: -1 | 1): boolean {
  const { selection } = tr;
  const $from = tr.doc.resolve(selection.from);
  const index = $from.index(0);
  const node = tr.doc.maybeChild(index);
  const neighbor = tr.doc.maybeChild(index + direction);
  if (
    node === null ||
    neighbor === null ||
    node.type.name === TITLE_NODE ||
    neighbor.type.name === TITLE_NODE ||
    // A text selection must stay inside one block.
    (!(selection instanceof NodeSelection) &&
      tr.doc.resolve(selection.to).index(0) !== index)
  ) {
    return false;
  }
  const pos = $from.posAtIndex(index, 0);
  const offset = direction === -1 ? -neighbor.nodeSize : neighbor.nodeSize;
  tr.delete(pos, pos + node.nodeSize);
  tr.insert(
    pos + (direction === -1 ? -neighbor.nodeSize : neighbor.nodeSize),
    node,
  );
  tr.setSelection(shiftSelection(tr, selection, offset));
  tr.scrollIntoView();
  return true;
}

/** @internal Keyboard alternative to dragging: Mod-Shift-ArrowUp/Down moves a block. */
export const BlockMove = Extension.create({
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-ArrowDown": () =>
        this.editor.commands.command(({ tr }) => moveBlock(tr, 1)),
      "Mod-Shift-ArrowUp": () =>
        this.editor.commands.command(({ tr }) => moveBlock(tr, -1)),
    };
  },
  name: "blockNotesMove",
});
