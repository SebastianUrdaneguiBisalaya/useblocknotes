import {
  type AbortSignalLike,
  type AiAdapter,
  type AiRequest,
  type AiStreamEvent,
  type BlockProps,
  createBlockId,
} from "@useblocknotes/core";

/** Options of {@link createMockAdapter}. */
export interface MockAdapterOptions {
  /** Pause between stream events, in milliseconds. Defaults to 40. */
  readonly delayMs?: number;
}

/** Resolves after `ms`, or right away when `signal` is aborted. */
function wait(ms: number, signal: AbortSignalLike): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
  });
}

/** Text deltas of `text`, one word (with its trailing spaces) each. */
function textDeltas(blockId: string, text: string): AiStreamEvent[] {
  return (text.match(/\S+\s*/g) ?? []).map((delta) => ({
    blockId,
    delta,
    type: "text_delta",
  }));
}

function insert(
  afterId: string | null,
  id: string,
  type: string,
  props: BlockProps,
  inline: boolean,
): AiStreamEvent {
  return {
    operation: {
      afterId,
      block: inline
        ? {
            content: [],
            id,
            props,
            type,
          }
        : {
            id,
            props,
            type,
          },
      op: "insert",
    },
    type: "operation",
  };
}

/** Rewrites the selected blocks: the first one is rewritten, the rest deleted. */
function rewrite(request: AiRequest): AiStreamEvent[] {
  const [first, ...rest] = request.selection?.blockIds ?? [];
  if (first === undefined) {
    return [];
  }
  return [
    {
      operation: {
        content: [],
        id: first,
        op: "update",
      },
      type: "operation",
    },
    ...textDeltas(
      first,
      `(${request.instruction}) ${request.selection?.text ?? ""}`,
    ),
    ...rest.map(
      (id): AiStreamEvent => ({
        operation: {
          id,
          op: "delete",
        },
        type: "operation",
      }),
    ),
  ];
}

/** Writes new blocks after the cursor, picked by keywords of the instruction. */
function write(request: AiRequest): AiStreamEvent[] {
  const instruction = request.instruction.toLowerCase();
  const subtitleId = createBlockId();
  const events: AiStreamEvent[] = [
    insert(request.anchorBlockId, subtitleId, "subtitle", {}, true),
    ...textDeltas(subtitleId, `Mock answer to "${request.instruction}"`),
  ];
  if (instruction.includes("table")) {
    events.push(
      insert(
        subtitleId,
        createBlockId(),
        "table",
        {
          rows: [
            [
              "Plan",
              "Price",
              "Seats",
            ],
            [
              "Free",
              "$0",
              "1",
            ],
            [
              "Team",
              "$12",
              "10",
            ],
          ],
        },
        false,
      ),
    );
    return events;
  }
  if (instruction.includes("chart")) {
    events.push(
      insert(
        subtitleId,
        createBlockId(),
        "chart",
        {
          data: [
            {
              label: "Jan",
              value: 12,
            },
            {
              label: "Feb",
              value: 18,
            },
            {
              label: "Mar",
              value: 9,
            },
            {
              label: "Apr",
              value: 24,
            },
          ],
          kind: "line",
        },
        false,
      ),
    );
    return events;
  }
  const paragraphId = createBlockId();
  events.push(
    insert(subtitleId, paragraphId, "paragraph", {}, true),
    ...textDeltas(
      paragraphId,
      "This text is streamed by a mock adapter, word by word, without any network request. Accept it to keep it as a single undo step, or reject it to restore the document. Ask for a table or a chart to get other blocks.",
    ),
  );
  return events;
}

/**
 * An offline {@link AiAdapter} for the playground. It never calls an AI API:
 * it streams scripted events with a small delay so the live preview, cancel,
 * accept and reject can be tried without a network connection.
 *
 * - With a selection, it rewrites the selected blocks.
 * - Without one, it writes after the cursor: a table or a chart when the
 *   instruction mentions them, paragraphs otherwise.
 * - An instruction containing "error" yields an invalid event, to try
 *   `onAiError`.
 */
export function createMockAdapter(options: MockAdapterOptions = {}): AiAdapter {
  const delayMs = options.delayMs ?? 40;
  return async function* mockAdapter(request) {
    const events =
      request.selection === null || request.selection.blockIds.length === 0
        ? write(request)
        : rewrite(request);
    await wait(delayMs * 5, request.signal);
    for (const event of events) {
      if (request.signal.aborted) {
        return;
      }
      yield event;
      await wait(delayMs, request.signal);
    }
    if (request.instruction.toLowerCase().includes("error")) {
      yield {
        type: "not_an_event",
      };
    }
  };
}
