import { describe, expect, test } from "bun:test";
import { Text } from "@react-pdf/renderer";
import {
  type Block,
  type BlockNotesDocument,
  createRegistry,
  defineBlock,
  defineInline,
} from "@useblocknotes/core";
import { isValidElement, type ReactNode } from "react";
import * as z from "zod";
import { defaultPdfBlocks, defaultPdfStyles } from "../src/blocks.js";
import { blockToPdf, listNumbers } from "../src/export.js";
import { exportPdf, type PdfBlockDefinition } from "../src/index.js";

const chart = defineBlock<
  "chart",
  {
    kind: string;
  },
  ReactNode
>({
  content: "none",
  schema: z.object({
    kind: z.string(),
  }),
  toText: (block) => `${block.props.kind} chart`,
  type: "chart",
});

const badge = defineBlock<
  "badge",
  {
    label: string;
  },
  ReactNode
>({
  content: "none",
  schema: z.object({
    label: z.string(),
  }),
  toPdf: (block) => <Text>{`[${block.props.label}]`}</Text>,
  toText: (block) => block.props.label,
  type: "badge",
});

const citation = defineInline<
  "citation",
  {
    source: string;
  },
  ReactNode
>({
  schema: z.object({
    source: z.string(),
  }),
  toText: (node) => `[${node.props.source}]`,
  type: "citation",
});

const blocks: readonly PdfBlockDefinition[] = [
  ...defaultPdfBlocks,
  chart,
  badge,
];

const registry = createRegistry<ReactNode>({
  blocks,
});

function block(id: string, type: string, props: Block["props"] = {}): Block {
  return {
    id,
    props,
    type,
  };
}

describe("blockToPdf", () => {
  test("falls back to a paragraph of toText without toPdf", () => {
    const node = blockToPdf(
      block("c", "chart", {
        kind: "bar",
      }),
      registry,
      defaultPdfStyles,
    );

    expect(isValidElement(node)).toBe(true);
    if (
      !isValidElement<{
        children: string;
        style: object;
      }>(node)
    )
      return;
    expect(node.type).toBe(Text);
    expect(node.props.children).toBe("bar chart");
    expect(node.props.style).toBe(defaultPdfStyles.paragraph);
  });

  test("uses toPdf when defined", () => {
    const node = blockToPdf(
      block("b", "badge", {
        label: "new",
      }),
      registry,
      defaultPdfStyles,
    );

    expect(isValidElement(node)).toBe(true);
    if (
      !isValidElement<{
        children: string;
      }>(node)
    )
      return;
    expect(node.props.children).toBe("[new]");
  });

  test("skips unregistered types", () => {
    expect(
      blockToPdf(block("x", "unknown"), registry, defaultPdfStyles),
    ).toBeNull();
  });

  test("every built-in block has a PDF render", () => {
    expect(
      defaultPdfBlocks.every((definition) => definition.toPdf !== undefined),
    ).toBe(true);
  });
});

describe("listNumbers", () => {
  test("numbers consecutive items per indent and resets on breaks", () => {
    const numbered = (id: string, indent = 0) =>
      block(id, "numberedListItem", {
        indent,
      });
    const numbers = listNumbers([
      numbered("a"),
      numbered("b"),
      numbered("b1", 1),
      numbered("b2", 1),
      numbered("c"),
      block("bullet", "bulletListItem", {
        indent: 0,
      }),
      numbered("d"),
      block("p", "paragraph"),
      numbered("e"),
    ]);

    expect(Object.fromEntries(numbers)).toEqual({
      a: 1,
      b: 2,
      b1: 1,
      b2: 2,
      c: 3,
      d: 1,
      e: 1,
    });
  });
});

describe("exportPdf", () => {
  const document: BlockNotesDocument = {
    blocks: [
      {
        content: [
          {
            text: "Intro",
            type: "text",
          },
        ],
        id: "h",
        props: {
          level: 1,
        },
        type: "heading",
      },
      {
        content: [
          {
            text: "Plain, ",
            type: "text",
          },
          {
            marks: [
              {
                type: "bold",
              },
              {
                type: "italic",
              },
              {
                type: "underline",
              },
              {
                type: "strike",
              },
            ],
            text: "styled",
            type: "text",
          },
          {
            marks: [
              {
                href: "https://example.com",
                type: "link",
              },
            ],
            text: " link ",
            type: "text",
          },
          {
            props: {
              source: "docs",
            },
            type: "citation",
          },
        ],
        id: "p",
        props: {},
        type: "paragraph",
      },
      {
        content: [
          {
            text: "One",
            type: "text",
          },
        ],
        id: "l1",
        props: {
          indent: 0,
        },
        type: "numberedListItem",
      },
      {
        content: [
          {
            text: "Two",
            type: "text",
          },
        ],
        id: "l2",
        props: {
          indent: 1,
        },
        type: "bulletListItem",
      },
      {
        content: [
          {
            text: "Quoted",
            type: "text",
          },
        ],
        id: "q",
        props: {},
        type: "quote",
      },
      {
        content: [
          {
            text: "const a = 1;",
            type: "text",
          },
        ],
        id: "code",
        props: {
          language: "ts",
        },
        type: "codeBlock",
      },
      block("c", "chart", {
        kind: "bar",
      }),
    ],
    title: "",
  };

  test("renders a PDF locally", async () => {
    const result = await exportPdf(document, {
      blocks,
      inlines: [
        citation,
      ],
      locale: "es",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe("application/pdf");
    const bytes = new Uint8Array(await result.value.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  test("returns a typed error for an invalid document", async () => {
    const result = await exportPdf({
      blocks: [
        block("x", "unknown"),
      ],
      title: "Bad",
    });

    expect(result.ok || result.error.code).toBe("invalid_document");
  });
});
