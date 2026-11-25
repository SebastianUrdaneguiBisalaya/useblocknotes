import { describe, expect, test } from "bun:test";
import {
  applyOperations,
  type BlockNotesDocument,
  createRegistry,
  defaultBlocks,
  type Operation,
  type OperationError,
} from "../src/index.js";

const registry = createRegistry({
  blocks: defaultBlocks,
});

const document: BlockNotesDocument = {
  blocks: [
    {
      content: [
        {
          text: "Title",
          type: "text",
        },
      ],
      id: "a",
      props: {
        level: 1,
      },
      type: "heading",
    },
    {
      content: [],
      id: "b",
      props: {},
      type: "paragraph",
    },
    {
      content: [],
      id: "c",
      props: {},
      type: "paragraph",
    },
  ],
  title: "Doc",
};

const ids = (doc: BlockNotesDocument): string[] =>
  doc.blocks.map((block) => block.id);

function apply(operations: readonly Operation[]) {
  return applyOperations(document, operations, {
    registry,
  });
}

describe("applyOperations", () => {
  test("inserts after a block and at the start", () => {
    const result = apply([
      {
        afterId: "a",
        block: {
          id: "x",
          props: {},
          type: "paragraph",
        },
        op: "insert",
      },
      {
        afterId: null,
        block: {
          id: "y",
          props: {
            level: 2,
          },
          type: "heading",
        },
        op: "insert",
      },
    ]);
    expect(result.ok && ids(result.value)).toEqual([
      "y",
      "a",
      "x",
      "b",
      "c",
    ]);
    // Parsed through the registry: inline blocks get empty content.
    expect(result.ok && result.value.blocks[2]?.content).toEqual([]);
  });

  test("updates by merging props and replacing content", () => {
    const result = apply([
      {
        content: [
          {
            text: "New",
            type: "text",
          },
        ],
        id: "a",
        op: "update",
        props: {
          level: 2,
        },
      },
    ]);
    expect(result.ok && result.value.blocks[0]).toEqual({
      content: [
        {
          text: "New",
          type: "text",
        },
      ],
      id: "a",
      props: {
        level: 2,
      },
      type: "heading",
    });
  });

  test("deletes, moves and sets the title", () => {
    const result = apply([
      {
        id: "b",
        op: "delete",
      },
      {
        afterId: "c",
        id: "a",
        op: "move",
      },
      {
        afterId: null,
        id: "a",
        op: "move",
      },
      {
        afterId: "a",
        id: "c",
        op: "move",
      },
      {
        afterId: null,
        id: "c",
        op: "move",
      },
      {
        op: "set_title",
        title: "Renamed",
      },
    ]);
    expect(result.ok && ids(result.value)).toEqual([
      "c",
      "a",
    ]);
    expect(result.ok && result.value.title).toBe("Renamed");
  });

  test("is pure and keeps unchanged blocks", () => {
    const snapshot = structuredClone(document);
    const result = apply([
      {
        id: "c",
        op: "delete",
      },
    ]);
    expect(document).toEqual(snapshot);
    expect(result.ok && result.value.blocks[0]).toBe(document.blocks[0]);
  });

  test("returns typed errors", () => {
    const cases: [
      readonly Operation[],
      OperationError["code"],
    ][] = [
      [
        [
          {
            id: "nope",
            op: "delete",
          },
        ],
        "unknown_block",
      ],
      [
        [
          {
            afterId: "nope",
            id: "a",
            op: "move",
          },
        ],
        "unknown_anchor",
      ],
      [
        [
          {
            afterId: "a",
            id: "a",
            op: "move",
          },
        ],
        "invalid_move",
      ],
      [
        [
          {
            afterId: null,
            block: {
              id: "b",
              props: {},
              type: "paragraph",
            },
            op: "insert",
          },
        ],
        "duplicate_block_id",
      ],
      [
        [
          {
            id: "a",
            op: "update",
            props: {
              level: 9,
            },
          },
        ],
        "invalid_block",
      ],
      [
        [
          {
            afterId: null,
            block: {
              id: "z",
              props: {},
              type: "video",
            },
            op: "insert",
          },
        ],
        "invalid_block",
      ],
    ];
    for (const [operations, code] of cases) {
      const result = apply(operations);
      expect(!result.ok && result.error.code).toBe(code);
    }
  });

  test("rejects malformed operations at runtime and reports the index", () => {
    const operations = JSON.parse(
      '[{"op":"set_title","title":"ok"},{"op":"explode"}]',
    );
    const result = applyOperations(document, operations);
    expect(!result.ok && result.error).toMatchObject({
      code: "invalid_operation",
      index: 1,
    });
  });

  test("is all-or-nothing", () => {
    const result = apply([
      {
        op: "set_title",
        title: "Changed",
      },
      {
        id: "nope",
        op: "delete",
      },
    ]);
    expect(result.ok).toBe(false);
    expect(document.title).toBe("Doc");
  });

  test("checks only the shape without a registry", () => {
    const result = applyOperations(document, [
      {
        afterId: null,
        block: {
          id: "z",
          props: {},
          type: "anything",
        },
        op: "insert",
      },
    ]);
    expect(result.ok).toBe(true);
  });
});
