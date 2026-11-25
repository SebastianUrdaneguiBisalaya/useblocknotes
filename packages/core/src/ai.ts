import * as z from "zod/mini";
import { safeParse } from "zod/v4/core";
import type { BlockNotesDocument, InlineNode, JsonValue } from "./document.js";
import {
  applyOperations,
  blockOperationSchema,
  type DeleteOperation,
  type InsertOperation,
  type MoveOperation,
  type OperationError,
  type UpdateOperation,
} from "./operations.js";
import type { BlockRegistry } from "./registry.js";
import type { Result } from "./result.js";
import { toPath, type ValidationPath } from "./validate.js";

/** A block operation an AI stream can emit. */
export type AiOperation =
  | InsertOperation
  | UpdateOperation
  | DeleteOperation
  | MoveOperation;

/**
 * An event of an AI stream.
 *
 * - `operation`: a block operation (`insert`, `update`, `delete`, `move`).
 * - `text_delta`: text appended to the inline content of a block, for example
 *   a block inserted earlier in the stream that is still being written.
 *
 * @example
 * ```ts
 * { type: "operation", operation: { op: "insert", afterId: "b1", block: { id: "ai-1", type: "paragraph", props: {}, content: [] } } }
 * { type: "text_delta", blockId: "ai-1", delta: "Hello" }
 * ```
 */
export type AiStreamEvent =
  | {
      readonly type: "operation";
      readonly operation: AiOperation;
    }
  | {
      readonly type: "text_delta";
      readonly blockId: string;
      readonly delta: string;
    };

/**
 * The part of `AbortSignal` used by useblocknotes. A standard `AbortSignal`
 * satisfies it.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: "abort", listener: () => void): void;
  removeEventListener(type: "abort", listener: () => void): void;
}

/** Blocks the user selected before asking AI. */
export interface AiSelection {
  /** Ids of the selected blocks, in document order. */
  readonly blockIds: readonly string[];
  /** Plain text of the selection. */
  readonly text: string;
}

/** What the editor passes to the host's {@link AiAdapter}. */
export interface AiRequest {
  /** What the user asked for. */
  readonly instruction: string;
  /** The selection the request applies to, or `null` when there is none. */
  readonly selection: AiSelection | null;
  /** Document context for the model, for example an outline or Markdown. */
  readonly context: string;
  /** Aborted when the user cancels. Pass it to the AI provider call. */
  readonly signal: AbortSignalLike;
}

/**
 * Bridge between the editor and the host's AI provider. useblocknotes never
 * calls an AI API: the host does, and maps the response to stream events.
 *
 * Events are validated at runtime, so raw JSON (parsed server-sent events,
 * NDJSON lines, Vercel AI SDK or Trigger.dev stream chunks) can be yielded
 * as is.
 *
 * @example
 * ```ts
 * const adapter: AiAdapter = async function* ({ instruction, context, signal }) {
 *   const response = await fetch("/api/ai", {
 *     method: "POST",
 *     body: JSON.stringify({ instruction, context }),
 *     signal,
 *   });
 *   for await (const line of readLines(response.body)) yield JSON.parse(line);
 * };
 * ```
 */
export type AiAdapter = (
  request: AiRequest,
) => AsyncIterable<AiStreamEvent | JsonValue>;

/** Progress of an AI stream. */
export interface AiStreamState {
  /**
   * The pending batch: operations received so far, with consecutive text
   * deltas folded into the operation that writes the block. Apply it to the
   * original document to accept the AI changes.
   */
  readonly operations: readonly AiOperation[];
  /** The original document with the pending batch applied, for live preview. */
  readonly document: BlockNotesDocument;
  /** Block that received the latest change, or `null`. */
  readonly activeBlockId: string | null;
}

/**
 * Why `processAiStream()` stopped before the stream ended. Every error carries
 * the last valid `state`; `index` is the position of the offending event.
 */
export type AiStreamError =
  | {
      /** The event does not have a valid shape. */
      readonly code: "invalid_event";
      readonly index: number;
      readonly path: ValidationPath;
      readonly message: string;
      readonly state: AiStreamState;
    }
  | {
      /** The operation cannot be applied to the current preview document. */
      readonly code: "rejected_operation";
      readonly index: number;
      readonly error: OperationError;
      readonly state: AiStreamState;
    }
  | {
      /** A text delta targets a block that does not exist. */
      readonly code: "unknown_block";
      readonly index: number;
      readonly blockId: string;
      readonly state: AiStreamState;
    }
  | {
      /** `signal` was aborted. */
      readonly code: "aborted";
      readonly state: AiStreamState;
    }
  | {
      /** The async iterable threw. */
      readonly code: "stream_failed";
      readonly message: string;
      readonly state: AiStreamState;
    };

/** Options of `processAiStream()`. */
export interface ProcessAiStreamOptions<TNode = null> {
  /** Document the AI changes apply to. */
  readonly document: BlockNotesDocument;
  /** Validates AI blocks against the registered schemas. */
  readonly registry?: BlockRegistry<TNode>;
  /** Stops processing as soon as it is aborted. */
  readonly signal?: AbortSignalLike;
  /** Called after every accepted event with the new state. */
  readonly onUpdate?: (state: AiStreamState) => void;
}

const eventSchema = z.discriminatedUnion("type", [
  z.object({
    operation: blockOperationSchema,
    type: z.literal("operation"),
  }),
  z.object({
    blockId: z.string().check(z.minLength(1)),
    delta: z.string(),
    type: z.literal("text_delta"),
  }),
]);

type StepError =
  | {
      readonly code: "rejected_operation";
      readonly error: OperationError;
    }
  | {
      readonly code: "unknown_block";
      readonly blockId: string;
    };

/** Appends text, merging into the last text node when it has no marks. */
function appendText(
  content: readonly InlineNode[],
  delta: string,
): InlineNode[] {
  const last = content.at(-1);
  if (
    last !== undefined &&
    last.type === "text" &&
    "text" in last &&
    (last.marks === undefined || last.marks.length === 0)
  ) {
    return [
      ...content.slice(0, -1),
      {
        text: last.text + delta,
        type: "text",
      },
    ];
  }
  return [
    ...content,
    {
      text: delta,
      type: "text",
    },
  ];
}

/** Folds new content into the last operation when it writes the same block. */
function foldContent(
  operations: readonly AiOperation[],
  blockId: string,
  content: readonly InlineNode[],
): AiOperation[] {
  const last = operations.at(-1);
  const rest = operations.slice(0, -1);
  if (last?.op === "insert" && last.block.id === blockId) {
    return [
      ...rest,
      {
        ...last,
        block: {
          ...last.block,
          content,
        },
      },
    ];
  }
  if (
    last?.op === "update" &&
    last.id === blockId &&
    last.content !== undefined
  ) {
    return [
      ...rest,
      {
        ...last,
        content,
      },
    ];
  }
  return [
    ...operations,
    {
      content,
      id: blockId,
      op: "update",
    },
  ];
}

function activeAfter(operation: AiOperation, active: string | null) {
  switch (operation.op) {
    case "insert":
      return operation.block.id;
    case "delete":
      return operation.id === active ? null : active;
    default:
      return operation.id;
  }
}

function step<TNode>(
  state: AiStreamState,
  event: AiStreamEvent,
  registry: BlockRegistry<TNode> | undefined,
): Result<AiStreamState, StepError> {
  const options =
    registry === undefined
      ? {}
      : {
          registry,
        };

  if (event.type === "operation") {
    const result = applyOperations(
      state.document,
      [
        event.operation,
      ],
      options,
    );
    if (!result.ok) {
      return {
        error: {
          code: "rejected_operation",
          error: result.error,
        },
        ok: false,
      };
    }
    return {
      ok: true,
      value: {
        activeBlockId: activeAfter(event.operation, state.activeBlockId),
        document: result.value,
        operations: [
          ...state.operations,
          event.operation,
        ],
      },
    };
  }

  const block = state.document.blocks.find(
    (candidate) => candidate.id === event.blockId,
  );
  if (block === undefined) {
    return {
      error: {
        blockId: event.blockId,
        code: "unknown_block",
      },
      ok: false,
    };
  }
  const content = appendText(block.content ?? [], event.delta);
  const result = applyOperations(
    state.document,
    [
      {
        content,
        id: block.id,
        op: "update",
      },
    ],
    options,
  );
  if (!result.ok) {
    return {
      error: {
        code: "rejected_operation",
        error: result.error,
      },
      ok: false,
    };
  }
  return {
    ok: true,
    value: {
      activeBlockId: block.id,
      document: result.value,
      operations: foldContent(state.operations, block.id, content),
    },
  };
}

/**
 * Consumes an AI stream and turns its events into a pending batch of
 * operations plus a live preview document.
 *
 * Every event is validated with Zod and applied to the preview; the first
 * invalid event stops processing with a typed error. Aborting `signal` stops
 * immediately, even while waiting for the next event, and closes the
 * iterable. Never throws.
 *
 * @example
 * ```ts
 * const controller = new AbortController();
 * const result = await processAiStream(
 *   adapter({ instruction, selection: null, context, signal: controller.signal }),
 *   { document, registry, signal: controller.signal, onUpdate: render },
 * );
 * if (result.ok) accept(result.value.operations);
 * ```
 */
export async function processAiStream<TNode = null>(
  events: AsyncIterable<AiStreamEvent | JsonValue>,
  options: ProcessAiStreamOptions<TNode>,
): Promise<Result<AiStreamState, AiStreamError>> {
  const { registry, signal, onUpdate } = options;
  let state: AiStreamState = {
    activeBlockId: null,
    document: options.document,
    operations: [],
  };
  const fail = (
    error: AiStreamError,
  ): Result<AiStreamState, AiStreamError> => ({
    error,
    ok: false,
  });
  const aborted = () =>
    fail({
      code: "aborted",
      state,
    });

  if (signal?.aborted === true) {
    return aborted();
  }

  let cancelled = false;
  let onAbort = () => {};
  const abortion = new Promise<null>((resolve) => {
    onAbort = () => {
      cancelled = true;
      resolve(null);
    };
  });
  signal?.addEventListener("abort", onAbort);

  const iterator = events[Symbol.asyncIterator]();
  let finished = false;
  try {
    for (let index = 0; ; index++) {
      let next: IteratorResult<AiStreamEvent | JsonValue> | null;
      try {
        next = await Promise.race([
          iterator.next(),
          abortion,
        ]);
      } catch (error) {
        finished = true;
        return fail({
          code: "stream_failed",
          message: error instanceof Error ? error.message : String(error),
          state,
        });
      }
      if (next === null || cancelled) {
        return aborted();
      }
      if (next.done === true) {
        finished = true;
        return {
          ok: true,
          value: state,
        };
      }

      const parsed = safeParse(eventSchema, next.value);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return fail({
          code: "invalid_event",
          index,
          message: issue?.message ?? "Invalid event",
          path: toPath(issue?.path ?? []),
          state,
        });
      }
      const result = step(state, parsed.data, registry);
      if (!result.ok) {
        return fail({
          ...result.error,
          index,
          state,
        });
      }
      state = result.value;
      onUpdate?.(state);
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (!finished) {
      // Not awaited: a pending `next()` would delay `return()` until it settles.
      iterator.return?.().catch(() => undefined);
    }
  }
}
