import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import {
  type ApplyOperationsOptions,
  applyOperations,
  type Block,
  type BlockNotesDocument,
  type Operation,
  type OperationError,
  type Result,
} from "@useblocknotes/core";
import {
  blockToJSON,
  nodeToBlock,
  nodeToDocument,
  TITLE_NODE,
} from "./convert.js";

interface Found {
  readonly node: PMNode;
  readonly pos: number;
}

function findBlock(doc: PMNode, id: string): Found | null {
  let found: Found | null = null;
  doc.forEach((node, pos) => {
    if (found === null && node.attrs["id"] === id) {
      found = {
        node,
        pos,
      };
    }
  });
  return found;
}

/** Position right after the title node, where the first block starts. */
function firstBlockPos(doc: PMNode): number {
  const first = doc.firstChild;
  return first?.type.name === TITLE_NODE ? first.nodeSize : 0;
}

function insertPos(doc: PMNode, afterId: string | null): number {
  if (afterId === null) {
    return firstBlockPos(doc);
  }
  const anchor = findBlock(doc, afterId);
  return anchor === null ? -1 : anchor.pos + anchor.node.nodeSize;
}

/**
 * Validates operations against the editor's current document with core's
 * `applyOperations()`, then applies them to `tr` as editor steps, so the batch
 * keeps the selection and is a single undo step.
 *
 * Returns the resulting document, or the first operation error (and leaves
 * `tr` untouched).
 */
export function applyOperationsToTransaction<TNode>(
  tr: Transaction,
  operations: readonly Operation[],
  options: ApplyOperationsOptions<TNode>,
): Result<BlockNotesDocument, OperationError> {
  const result = applyOperations(nodeToDocument(tr.doc), operations, options);
  if (!result.ok) {
    return result;
  }
  const finalBlocks = new Map<string, Block>(
    result.value.blocks.map((block) => [
      block.id,
      block,
    ]),
  );
  const schema = tr.doc.type.schema;
  const toNode = (block: Block): PMNode =>
    schema.nodeFromJSON(blockToJSON(finalBlocks.get(block.id) ?? block));

  for (const operation of operations) {
    switch (operation.op) {
      case "set_title": {
        const title = tr.doc.firstChild;
        if (title?.type.name === TITLE_NODE) {
          tr.replaceWith(
            1,
            1 + title.content.size,
            operation.title === ""
              ? Fragment.empty
              : schema.text(operation.title),
          );
        }
        break;
      }
      case "insert": {
        tr.insert(
          insertPos(tr.doc, operation.afterId),
          toNode(operation.block),
        );
        break;
      }
      case "update": {
        const found = findBlock(tr.doc, operation.id);
        if (found === null) {
          break;
        }
        const block = finalBlocks.get(operation.id);
        if (operation.content === undefined && block !== undefined) {
          tr.setNodeMarkup(found.pos, undefined, {
            ...found.node.attrs,
            props: block.props,
          });
        } else {
          tr.replaceWith(
            found.pos,
            found.pos + found.node.nodeSize,
            toNode(nodeToBlock(found.node)),
          );
        }
        break;
      }
      case "delete": {
        const found = findBlock(tr.doc, operation.id);
        if (found !== null) {
          tr.delete(found.pos, found.pos + found.node.nodeSize);
        }
        break;
      }
      case "move": {
        const found = findBlock(tr.doc, operation.id);
        if (found === null) {
          break;
        }
        tr.delete(found.pos, found.pos + found.node.nodeSize);
        tr.insert(insertPos(tr.doc, operation.afterId), found.node);
        break;
      }
    }
  }
  return result;
}
