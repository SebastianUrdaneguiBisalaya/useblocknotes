import { describe, expect, test } from "bun:test";
import {
  type Block,
  createRegistry,
  defaultBlocks,
  validateDocument,
} from "../src/index.js";

const registry = createRegistry({
  blocks: defaultBlocks,
});

function validate(blocks: readonly Block[]) {
  return validateDocument(
    {
      blocks,
      title: "",
    },
    registry,
  );
}

function markdown(block: Block): string {
  const definition = registry.blocks.get(block.type);
  const parsed = validate([
    block,
  ]);
  if (
    definition === undefined ||
    !parsed.ok ||
    parsed.value.blocks[0] === undefined
  ) {
    throw new Error(`invalid block ${block.type}`);
  }
  const toMarkdown = definition.toMarkdown ?? definition.toText;
  return toMarkdown(parsed.value.blocks[0], registry.text);
}

const text = (value: string) => [
  {
    text: value,
    type: "text" as const,
  },
];

describe("list, quote and code blocks", () => {
  test("list items default indent to 0 and bound it", () => {
    const ok = validate([
      {
        content: text("a"),
        id: "1",
        props: {},
        type: "bulletListItem",
      },
    ]);
    expect(ok.ok && ok.value.blocks[0]?.props).toEqual({
      indent: 0,
    });
    for (const indent of [
      -1,
      7,
      1.5,
    ]) {
      const bad = validate([
        {
          id: "1",
          props: {
            indent,
          },
          type: "numberedListItem",
        },
      ]);
      expect(!bad.ok && bad.error[0]?.code).toBe("invalid_block_props");
    }
  });

  test("code blocks accept only plain text", () => {
    const result = validate([
      {
        content: [
          {
            marks: [
              {
                type: "bold",
              },
            ],
            text: "x",
            type: "text",
          },
        ],
        id: "1",
        props: {},
        type: "codeBlock",
      },
    ]);
    expect(!result.ok && result.error[0]).toMatchObject({
      code: "unexpected_content",
      path: [
        "blocks",
        0,
        "content",
        0,
      ],
    });
  });

  test("convert to Markdown", () => {
    expect(
      markdown({
        content: text("item"),
        id: "1",
        props: {
          indent: 1,
        },
        type: "bulletListItem",
      }),
    ).toBe("  - item");
    expect(
      markdown({
        content: text("step"),
        id: "1",
        props: {},
        type: "numberedListItem",
      }),
    ).toBe("1. step");
    expect(
      markdown({
        content: text("line one\nline two"),
        id: "1",
        props: {},
        type: "quote",
      }),
    ).toBe("> line one\n> line two");
    expect(
      markdown({
        content: text("const a = 1;"),
        id: "1",
        props: {
          language: "ts",
        },
        type: "codeBlock",
      }),
    ).toBe("```ts\nconst a = 1;\n```");
    expect(
      markdown({
        content: text("```"),
        id: "1",
        props: {},
        type: "codeBlock",
      }),
    ).toBe("````\n```\n````");
  });
});
