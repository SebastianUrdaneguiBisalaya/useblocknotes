import * as z from "zod/mini";
import { safeParse } from "zod/v4/core";
import type {
  Block,
  BlockNotesDocument,
  BlockProps,
  InlineNode,
} from "./document.js";
import type { BlockRegistry } from "./registry.js";
import type { Result } from "./result.js";
import {
  blockSchema,
  checkBlock,
  inlineSchema,
  propsSchema,
  toPath,
  type ValidationIssue,
  type ValidationPath,
} from "./validate.js";

/** Inserts a block after `afterId`, or at the start when `afterId` is `null`. */
export interface InsertOperation {
  readonly op: "insert";
  readonly afterId: string | null;
  readonly block: Block;
}

/**
 * Updates a block, keeping its id.
 *
 * - Without `type`: `props` are shallow-merged into the current props and
 *   `content`, when given, replaces the current inline content.
 * - With `type`: the block is replaced (for example a paragraph turned into a
 *   heading). `props` default to `{}` and `content` to none.
 */
export interface UpdateOperation {
  readonly op: "update";
  readonly id: string;
  readonly type?: string;
  readonly props?: BlockProps;
  readonly content?: readonly InlineNode[];
}

/** Deletes a block. */
export interface DeleteOperation {
  readonly op: "delete";
  readonly id: string;
}

/** Moves a block after `afterId`, or to the start when `afterId` is `null`. */
export interface MoveOperation {
  readonly op: "move";
  readonly id: string;
  readonly afterId: string | null;
}

/** Sets the document title. */
export interface SetTitleOperation {
  readonly op: "set_title";
  readonly title: string;
}

/** A change to a document. Every edit, manual or from AI, is an operation. */
export type Operation =
  | InsertOperation
  | UpdateOperation
  | DeleteOperation
  | MoveOperation
  | SetTitleOperation;

/** Why `applyOperations()` rejected an operation. `index` is the operation's position. */
export type OperationError =
  | {
      /** The operation does not have a valid shape. */
      readonly code: "invalid_operation";
      readonly index: number;
      readonly path: ValidationPath;
      readonly message: string;
    }
  | {
      /** `id` does not exist in the document. */
      readonly code: "unknown_block";
      readonly index: number;
      readonly blockId: string;
    }
  | {
      /** `afterId` does not exist in the document. */
      readonly code: "unknown_anchor";
      readonly index: number;
      readonly afterId: string;
    }
  | {
      /** An inserted block reuses an existing id. */
      readonly code: "duplicate_block_id";
      readonly index: number;
      readonly blockId: string;
    }
  | {
      /** A block cannot be moved after itself. */
      readonly code: "invalid_move";
      readonly index: number;
      readonly blockId: string;
    }
  | {
      /** The resulting block fails registry validation. */
      readonly code: "invalid_block";
      readonly index: number;
      readonly blockId: string;
      readonly issues: readonly ValidationIssue[];
    };

/** Options of `applyOperations()`. */
export interface ApplyOperationsOptions<TNode = null> {
  /**
   * Validates inserted and updated blocks against the registered schemas and
   * stores their parsed props. Without it, only the operation shape is checked.
   */
  readonly registry?: BlockRegistry<TNode>;
}

const anchorSchema = z.nullable(z.string().check(z.minLength(1)));
const idSchema = z.string().check(z.minLength(1));

const operationSchema = z.discriminatedUnion("op", [
  z.object({
    afterId: anchorSchema,
    block: blockSchema,
    op: z.literal("insert"),
  }),
  z.object({
    content: z.exactOptional(z.array(inlineSchema)),
    id: idSchema,
    op: z.literal("update"),
    props: z.exactOptional(propsSchema),
    type: z.exactOptional(z.string().check(z.minLength(1))),
  }),
  z.object({
    id: idSchema,
    op: z.literal("delete"),
  }),
  z.object({
    afterId: anchorSchema,
    id: idSchema,
    op: z.literal("move"),
  }),
  z.object({
    op: z.literal("set_title"),
    title: z.string(),
  }),
]);

type Failure = Result<BlockNotesDocument, OperationError> & {
  readonly ok: false;
};

function fail(error: OperationError): Failure {
  return {
    error,
    ok: false,
  };
}

/** Index to insert at, after `afterId` (`0` for `null`), or `-1` if unknown. */
function insertionIndex(
  blocks: readonly Block[],
  afterId: string | null,
): number {
  if (afterId === null) {
    return 0;
  }
  const index = blocks.findIndex((block) => block.id === afterId);
  return index === -1 ? -1 : index + 1;
}

/**
 * Applies operations to a document, in order, and returns the new document.
 *
 * Pure: the input document is never mutated and unchanged blocks keep their
 * identity. All-or-nothing: the first invalid operation stops and returns a
 * typed error.
 *
 * @example
 * ```ts
 * const result = applyOperations(document, [
 *   { op: "insert", afterId: null, block: { id: "b1", type: "paragraph", props: {} } },
 *   { op: "set_title", title: "Notes" },
 * ], { registry });
 * if (result.ok) save(result.value);
 * ```
 */
export function applyOperations<TNode = null>(
  document: BlockNotesDocument,
  operations: readonly Operation[],
  options: ApplyOperationsOptions<TNode> = {},
): Result<BlockNotesDocument, OperationError> {
  const { registry } = options;
  const blocks = [
    ...document.blocks,
  ];
  let title = document.title;

  const check = (
    block: Block,
    index: number,
  ): Result<Block, OperationError> => {
    if (registry === undefined) {
      return {
        ok: true,
        value: block,
      };
    }
    const result = checkBlock(block, registry, [
      "operations",
      index,
    ]);
    return result.ok
      ? result
      : fail({
          blockId: block.id,
          code: "invalid_block",
          index,
          issues: result.error,
        });
  };

  for (const [index, operation] of operations.entries()) {
    const parsed = safeParse(operationSchema, operation);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail({
        code: "invalid_operation",
        index,
        message: issue?.message ?? "Invalid operation",
        path: toPath(issue?.path ?? []),
      });
    }
    const op = parsed.data;

    switch (op.op) {
      case "set_title": {
        title = op.title;
        break;
      }
      case "insert": {
        if (blocks.some((block) => block.id === op.block.id)) {
          return fail({
            blockId: op.block.id,
            code: "duplicate_block_id",
            index,
          });
        }
        const at = insertionIndex(blocks, op.afterId);
        if (at === -1 && op.afterId !== null) {
          return fail({
            afterId: op.afterId,
            code: "unknown_anchor",
            index,
          });
        }
        const block = check(op.block, index);
        if (!block.ok) {
          return block;
        }
        blocks.splice(at, 0, block.value);
        break;
      }
      case "update": {
        const at = blocks.findIndex((block) => block.id === op.id);
        const current = blocks[at];
        if (current === undefined) {
          return fail({
            blockId: op.id,
            code: "unknown_block",
            index,
          });
        }
        const replace = op.type !== undefined;
        const content = replace ? op.content : (op.content ?? current.content);
        const next: Block = {
          id: current.id,
          props: replace
            ? (op.props ?? {})
            : {
                ...current.props,
                ...op.props,
              },
          type: op.type ?? current.type,
          ...(content === undefined
            ? {}
            : {
                content,
              }),
        };
        const block = check(next, index);
        if (!block.ok) {
          return block;
        }
        blocks[at] = block.value;
        break;
      }
      case "delete": {
        const at = blocks.findIndex((block) => block.id === op.id);
        if (at === -1) {
          return fail({
            blockId: op.id,
            code: "unknown_block",
            index,
          });
        }
        blocks.splice(at, 1);
        break;
      }
      case "move": {
        if (op.afterId === op.id) {
          return fail({
            blockId: op.id,
            code: "invalid_move",
            index,
          });
        }
        const from = blocks.findIndex((block) => block.id === op.id);
        const [block] = from === -1 ? [] : blocks.splice(from, 1);
        if (block === undefined) {
          return fail({
            blockId: op.id,
            code: "unknown_block",
            index,
          });
        }
        const at = insertionIndex(blocks, op.afterId);
        if (at === -1 && op.afterId !== null) {
          return fail({
            afterId: op.afterId,
            code: "unknown_anchor",
            index,
          });
        }
        blocks.splice(at, 0, block);
        break;
      }
    }
  }

  return {
    ok: true,
    value: {
      blocks,
      title,
    },
  };
}
