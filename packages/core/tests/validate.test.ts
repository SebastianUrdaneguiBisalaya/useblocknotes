import { describe, expect, test } from "bun:test";
import * as z from "zod";
import {
  type BlockNotesDocument,
  createRegistry,
  defaultBlocks,
  defineBlock,
  defineInline,
  RegistryError,
  validateDocument,
} from "../src/index.js";

const citation = defineInline({
  schema: z.object({
    source: z.string(),
  }),
  toText: (node) => `[${node.props.source}]`,
  type: "citation",
});

const chart = defineBlock({
  content: "none",
  schema: z.object({
    kind: z.enum([
      "bar",
      "line",
    ]),
    values: z.array(z.number()).default([]),
  }),
  toText: (block) => `${block.props.kind} chart`,
  type: "chart",
});

const registry = createRegistry({
  blocks: [
    ...defaultBlocks,
    chart,
  ],
  inlines: [
    citation,
  ],
});

const validDocument: BlockNotesDocument = {
  blocks: [
    {
      id: "h1",
      props: {
        level: 1,
      },
      type: "heading",
    },
    {
      content: [
        {
          text: "Hello ",
          type: "text",
        },
        {
          marks: [
            {
              type: "bold",
            },
          ],
          text: "world",
          type: "text",
        },
        {
          props: {
            source: "docs",
          },
          type: "citation",
        },
      ],
      id: "p1",
      props: {},
      type: "paragraph",
    },
    {
      id: "c1",
      props: {
        kind: "bar",
      },
      type: "chart",
    },
  ],
  title: "Notes",
};

describe("validateDocument", () => {
  test("accepts a valid document and applies schema defaults", () => {
    const result = validateDocument(validDocument, registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.blocks[2]?.props).toEqual({
        kind: "bar",
        values: [],
      });
      expect(result.value.blocks[0]?.content).toEqual([]);
    }
  });

  test("accepts parsed JSON input", () => {
    const result = validateDocument(
      JSON.parse(JSON.stringify(validDocument)),
      registry,
    );
    expect(result.ok).toBe(true);
  });

  test("rejects an invalid document shape", () => {
    const result = validateDocument(
      {
        blocks: "nope",
      },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.every((i) => i.code === "invalid_structure")).toBe(
        true,
      );
    }
  });

  test("reports unknown block types, invalid props and duplicate ids", () => {
    const result = validateDocument(
      {
        blocks: [
          {
            id: "a",
            props: {},
            type: "video",
          },
          {
            id: "a",
            props: {
              level: 7,
            },
            type: "heading",
          },
        ],
        title: "",
      },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.map((i) => i.code)).toEqual([
        "unknown_block_type",
        "duplicate_block_id",
        "invalid_block_props",
      ]);
      expect(result.error[2]?.path).toEqual([
        "blocks",
        1,
        "props",
        "level",
      ]);
    }
  });

  test("rejects inline content on content: none blocks", () => {
    const result = validateDocument(
      {
        blocks: [
          {
            content: [
              {
                text: "x",
                type: "text",
              },
            ],
            id: "c1",
            props: {
              kind: "line",
            },
            type: "chart",
          },
        ],
        title: "",
      },
      registry,
    );
    expect(!result.ok && result.error[0]?.code).toBe("unexpected_content");
  });

  test("validates inline elements", () => {
    const result = validateDocument(
      {
        blocks: [
          {
            content: [
              {
                props: {},
                type: "mention",
              },
              {
                props: {
                  source: 1,
                },
                type: "citation",
              },
            ],
            id: "p1",
            props: {},
            type: "paragraph",
          },
        ],
        title: "",
      },
      registry,
    );
    expect(!result.ok && result.error.map((i) => i.code)).toEqual([
      "unknown_inline_type",
      "invalid_inline_props",
    ]);
  });
});

describe("createRegistry", () => {
  test("throws on duplicate and reserved types", () => {
    expect(() =>
      createRegistry({
        blocks: [
          ...defaultBlocks,
          ...defaultBlocks,
        ],
      }),
    ).toThrow(RegistryError);
    expect(() =>
      createRegistry({
        blocks: [],
        inlines: [
          defineInline({
            schema: z.object({}),
            toText: () => "",
            type: "text",
          }),
        ],
      }),
    ).toThrow(RegistryError);
  });

  test("converts inline content to text and Markdown", () => {
    const content = validDocument.blocks[1]?.content;
    expect(registry.text.text(content)).toBe("Hello world[docs]");
    expect(registry.text.markdown(content)).toBe("Hello **world**[docs]");
  });
});
