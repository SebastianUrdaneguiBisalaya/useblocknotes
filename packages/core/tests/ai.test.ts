import { describe, expect, test } from "bun:test";
import {
  type AiAdapter,
  type AiStreamEvent,
  type AiStreamState,
  applyOperations,
  type BlockNotesDocument,
  createRegistry,
  defaultBlocks,
  type JsonValue,
  processAiStream,
} from "../src/index.js";

const registry = createRegistry({
  blocks: defaultBlocks,
});

const document: BlockNotesDocument = {
  blocks: [
    {
      content: [
        {
          text: "Intro",
          type: "text",
        },
      ],
      id: "a",
      props: {},
      type: "paragraph",
    },
  ],
  title: "Doc",
};

async function* stream(
  events: readonly (AiStreamEvent | JsonValue)[],
): AsyncGenerator<AiStreamEvent | JsonValue> {
  for (const event of events) {
    yield event;
  }
}

const insertB: AiStreamEvent = {
  operation: {
    afterId: "a",
    block: {
      content: [],
      id: "b",
      props: {},
      type: "paragraph",
    },
    op: "insert",
  },
  type: "operation",
};

function delta(blockId: string, text: string): AiStreamEvent {
  return {
    blockId,
    delta: text,
    type: "text_delta",
  };
}

describe("processAiStream", () => {
  test("folds text deltas into the inserting operation", async () => {
    const updates: AiStreamState[] = [];
    const result = await processAiStream(
      stream([
        insertB,
        delta("b", "Hel"),
        delta("b", "lo"),
      ]),
      {
        document,
        onUpdate: (state) => updates.push(state),
        registry,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(updates).toHaveLength(3);
    expect(result.value.activeBlockId).toBe("b");
    expect(result.value.operations).toEqual([
      {
        afterId: "a",
        block: {
          content: [
            {
              text: "Hello",
              type: "text",
            },
          ],
          id: "b",
          props: {},
          type: "paragraph",
        },
        op: "insert",
      },
    ]);
    expect(result.value.document.blocks[1]?.content).toEqual([
      {
        text: "Hello",
        type: "text",
      },
    ]);
    const applied = applyOperations(document, result.value.operations, {
      registry,
    });
    expect(applied.ok && applied.value).toEqual(result.value.document);
  });

  test("appends deltas to existing blocks as one update", async () => {
    const result = await processAiStream(
      stream([
        delta("a", " and"),
        delta("a", " more"),
      ]),
      {
        document,
      },
    );

    expect(result.ok && result.value.operations).toEqual([
      {
        content: [
          {
            text: "Intro and more",
            type: "text",
          },
        ],
        id: "a",
        op: "update",
      },
    ]);
  });

  test("keeps marked text and starts a new text node", async () => {
    const result = await processAiStream(
      stream([
        {
          operation: {
            content: [
              {
                marks: [
                  {
                    type: "bold",
                  },
                ],
                text: "Bold",
                type: "text",
              },
            ],
            id: "a",
            op: "update",
          },
          type: "operation",
        },
        delta("a", " plain"),
      ]),
      {
        document,
        registry,
      },
    );

    expect(result.ok && result.value.operations).toEqual([
      {
        content: [
          {
            marks: [
              {
                type: "bold",
              },
            ],
            text: "Bold",
            type: "text",
          },
          {
            text: " plain",
            type: "text",
          },
        ],
        id: "a",
        op: "update",
      },
    ]);
  });

  test("tracks the active block across move and delete", async () => {
    const result = await processAiStream(
      stream([
        insertB,
        {
          operation: {
            afterId: null,
            id: "b",
            op: "move",
          },
          type: "operation",
        },
        {
          operation: {
            id: "b",
            op: "delete",
          },
          type: "operation",
        },
      ]),
      {
        document,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.activeBlockId).toBeNull();
    expect(result.value.operations).toHaveLength(3);
    expect(result.value.document).toEqual(document);
  });

  test("rejects invalid events with their index", async () => {
    const result = await processAiStream(
      stream([
        insertB,
        {
          blockId: "b",
          type: "text_delta",
        },
      ]),
      {
        document,
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({
      code: "invalid_event",
      index: 1,
      path: [
        "delta",
      ],
    });
    expect(result.error.state.operations).toHaveLength(1);
  });

  test("rejects set_title and unknown event types", async () => {
    const result = await processAiStream(
      stream([
        {
          operation: {
            op: "set_title",
            title: "New",
          },
          type: "operation",
        },
      ]),
      {
        document,
      },
    );

    expect(result.ok || result.error.code).toBe("invalid_event");
  });

  test("rejects operations the document cannot apply", async () => {
    const result = await processAiStream(
      stream([
        {
          operation: {
            id: "missing",
            op: "delete",
          },
          type: "operation",
        },
      ]),
      {
        document,
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({
      code: "rejected_operation",
      error: {
        blockId: "missing",
        code: "unknown_block",
      },
      index: 0,
    });
  });

  test("rejects deltas for unknown blocks", async () => {
    const result = await processAiStream(
      stream([
        delta("x", "Hi"),
      ]),
      {
        document,
      },
    );

    expect(result.ok || result.error).toMatchObject({
      blockId: "x",
      code: "unknown_block",
      index: 0,
    });
  });

  test("validates AI blocks against the registry", async () => {
    const result = await processAiStream(
      stream([
        {
          operation: {
            afterId: "a",
            block: {
              id: "h",
              props: {
                level: 9,
              },
              type: "heading",
            },
            op: "insert",
          },
          type: "operation",
        },
      ]),
      {
        document,
        registry,
      },
    );

    expect(result.ok || result.error).toMatchObject({
      code: "rejected_operation",
      error: {
        code: "invalid_block",
      },
    });
  });

  test("reports a stream that throws", async () => {
    async function* failing(): AsyncGenerator<AiStreamEvent> {
      yield insertB;
      throw new Error("network down");
    }

    const result = await processAiStream(failing(), {
      document,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({
      code: "stream_failed",
      message: "network down",
    });
    expect(result.error.state.operations).toHaveLength(1);
  });

  test("stops on abort while waiting and closes the stream", async () => {
    const controller = new AbortController();
    let closed = false;

    const adapter: AiAdapter = async function* ({ signal }) {
      try {
        yield insertB;
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve());
        });
        yield delta("b", "never");
      } finally {
        closed = true;
      }
    };

    const result = await processAiStream(
      adapter({
        anchorBlockId: null,
        context: "",
        instruction: "Write",
        selection: null,
        signal: controller.signal,
      }),
      {
        document,
        onUpdate: () => setTimeout(() => controller.abort(), 0),
        signal: controller.signal,
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("aborted");
    expect(result.error.state.operations).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(closed).toBe(true);
  });

  test("returns immediately when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let started = false;
    async function* events(): AsyncGenerator<AiStreamEvent> {
      started = true;
      yield insertB;
    }

    const result = await processAiStream(events(), {
      document,
      signal: controller.signal,
    });

    expect(result.ok || result.error.code).toBe("aborted");
    expect(started).toBe(false);
  });
});
