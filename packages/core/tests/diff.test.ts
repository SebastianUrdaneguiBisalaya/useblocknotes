import { describe, expect, test } from "bun:test";
import {
  applyOperations,
  type Block,
  type BlockNotesDocument,
  diffDocuments,
} from "../src/index.js";

const paragraph = (id: string, text = id): Block => ({
  content: [
    {
      text,
      type: "text",
    },
  ],
  id,
  props: {},
  type: "paragraph",
});

const doc = (blocks: readonly Block[], title = "Doc"): BlockNotesDocument => ({
  blocks,
  title,
});

function roundTrip(before: BlockNotesDocument, after: BlockNotesDocument) {
  const operations = diffDocuments(before, after);
  const result = applyOperations(before, operations);
  expect(result.ok && result.value).toEqual(after);
  return operations;
}

describe("diffDocuments", () => {
  test("returns no operations for equal documents", () => {
    const a = doc([
      paragraph("a"),
    ]);
    expect(diffDocuments(a, structuredClone(a))).toEqual([]);
  });

  test("ignores props key order", () => {
    const before = doc([
      {
        id: "x",
        props: {
          a: 1,
          b: 2,
        },
        type: "chart",
      },
    ]);
    // Built from entries so formatters cannot reorder the keys.
    const reversed = Object.fromEntries([
      [
        "b",
        2,
      ],
      [
        "a",
        1,
      ],
    ]);
    const after = doc([
      {
        id: "x",
        props: reversed,
        type: "chart",
      },
    ]);
    expect(Object.keys(reversed)).toEqual([
      "b",
      "a",
    ]);
    expect(diffDocuments(before, after)).toEqual([]);
  });

  test("moves a single block with one operation", () => {
    const operations = roundTrip(
      doc([
        paragraph("a"),
        paragraph("b"),
        paragraph("c"),
        paragraph("d"),
      ]),
      doc([
        paragraph("b"),
        paragraph("c"),
        paragraph("d"),
        paragraph("a"),
      ]),
    );
    expect(operations).toEqual([
      {
        afterId: "d",
        id: "a",
        op: "move",
      },
    ]);
  });

  test("emits title, delete, insert and content update", () => {
    const operations = roundTrip(
      doc([
        paragraph("a"),
        paragraph("b"),
      ]),
      doc(
        [
          paragraph("a", "changed"),
          paragraph("n"),
        ],
        "New",
      ),
    );
    expect(operations.map((operation) => operation.op)).toEqual([
      "set_title",
      "delete",
      "insert",
      "update",
    ]);
  });

  test("replaces a block that changed type or lost props, keeping its id", () => {
    const operations = roundTrip(
      doc([
        paragraph("a"),
        {
          id: "c",
          props: {
            kind: "bar",
            stacked: true,
          },
          type: "chart",
        },
      ]),
      doc([
        {
          content: paragraph("a").content ?? [],
          id: "a",
          props: {
            level: 2,
          },
          type: "heading",
        },
        {
          id: "c",
          props: {
            kind: "bar",
          },
          type: "chart",
        },
      ]),
    );
    expect(operations).toMatchObject([
      {
        id: "a",
        op: "update",
        type: "heading",
      },
      {
        id: "c",
        op: "update",
        type: "chart",
      },
    ]);
  });

  test("round-trips random edits", () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let run = 0; run < 300; run++) {
      const before = Array.from(
        {
          length: Math.floor(random() * 8),
        },
        (_, i) => paragraph(`b${i}`),
      );
      const after = before
        .filter(() => random() > 0.25)
        .map((block) =>
          random() > 0.7 ? paragraph(block.id, `${block.id}!`) : block,
        );
      for (let i = 0; i < 3; i++) {
        if (random() > 0.5) {
          after.splice(
            Math.floor(random() * (after.length + 1)),
            0,
            paragraph(`n${run}-${i}`),
          );
        }
      }
      after.sort(() => (random() > 0.6 ? 1 : -1));
      roundTrip(doc(before), doc(after, random() > 0.8 ? "T" : "Doc"));
    }
  });
});
