import { describe, expect, test } from "bun:test";
import * as z from "zod";
import {
  type Block,
  type BlockNotesDocument,
  createRegistry,
  defaultBlocks,
  defineBlock,
  outline,
  pick,
  toMarkdown,
} from "../src/index.js";

const chart = defineBlock({
  content: "none",
  schema: z.object({
    kind: z.string(),
  }),
  toText: (block) => `${block.props.kind} chart`,
  type: "chart",
});

const registry = createRegistry({
  blocks: [
    ...defaultBlocks,
    chart,
  ],
});

function paragraph(id: string, text: string): Block {
  return {
    content: [
      {
        text,
        type: "text",
      },
    ],
    id,
    props: {},
    type: "paragraph",
  };
}

function bullet(id: string, text: string): Block {
  return {
    content: [
      {
        text,
        type: "text",
      },
    ],
    id,
    props: {
      indent: 0,
    },
    type: "bulletListItem",
  };
}

const document: BlockNotesDocument = {
  blocks: [
    {
      content: [
        {
          text: "Goals",
          type: "text",
        },
      ],
      id: "h",
      props: {
        level: 2,
      },
      type: "heading",
    },
    paragraph("p1", "Ship the *first* version\nthen iterate"),
    bullet("l1", "One"),
    bullet("l2", "Two"),
    {
      id: "c",
      props: {
        kind: "bar",
      },
      type: "chart",
    },
    paragraph("p2", ""),
  ],
  title: "Notes",
};

describe("outline", () => {
  test("lists headings and one line per block with ids", () => {
    expect(outline(document, registry)).toBe(
      [
        "# Notes",
        "[h] ### Goals",
        "[p1] paragraph: Ship the *first* version…",
        "[l1] bulletListItem: One",
        "[l2] bulletListItem: Two",
        "[c] chart: bar chart",
        "[p2] paragraph",
      ].join("\n"),
    );
  });

  test("cuts long lines", () => {
    const long: BlockNotesDocument = {
      blocks: [
        paragraph("p", "abcdefghij"),
      ],
      title: "T",
    };
    expect(
      outline(long, registry, {
        maxLineLength: 5,
      }),
    ).toBe("# T\n[p] paragraph: abcd…");
  });
});

describe("pick", () => {
  test("returns only the given blocks in document order", () => {
    expect(
      pick(document, [
        "l2",
        "h",
        "missing",
      ]).map((block) => block.id),
    ).toEqual([
      "h",
      "l2",
    ]);
  });

  test("adds neighbors without duplicates or overflow", () => {
    expect(
      pick(
        document,
        [
          "h",
          "l1",
        ],
        {
          neighbors: 1,
        },
      ).map((block) => block.id),
    ).toEqual([
      "h",
      "p1",
      "l1",
      "l2",
    ]);
  });

  test("keeps block identity", () => {
    expect(
      pick(document, [
        "c",
      ])[0],
    ).toBe(document.blocks[4]);
  });
});

describe("toMarkdown", () => {
  test("converts a document with its title", () => {
    expect(toMarkdown(document, registry)).toBe(
      [
        "# Notes",
        "",
        "## Goals",
        "",
        "Ship the \\*first\\* version\nthen iterate",
        "",
        "- One",
        "- Two",
        "",
        "bar chart",
      ].join("\n"),
    );
  });

  test("converts a list of blocks", () => {
    expect(
      toMarkdown(
        pick(document, [
          "l1",
          "l2",
        ]),
        registry,
      ),
    ).toBe("- One\n- Two");
  });

  test("falls back to inline text for unknown types", () => {
    const unknown: Block = {
      ...paragraph("x", "**raw**"),
      type: "callout",
    };
    expect(
      toMarkdown(
        [
          unknown,
        ],
        registry,
      ),
    ).toBe("\\*\\*raw\\*\\*");
  });
});
