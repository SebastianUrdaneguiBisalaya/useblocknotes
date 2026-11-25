import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import {
  type BlockNotesDocument,
  createRegistry,
  defineBlock,
  defineInline,
} from "@useblocknotes/core";
import type { ReactNode } from "react";
import * as z from "zod";
import { defaultBlocks } from "../src/blocks.js";
import { documentToJSON, nodeToDocument } from "../src/convert.js";
import { createExtensions } from "../src/extensions.js";
import { applyOperationsToTransaction } from "../src/transaction.js";

const chart = defineBlock({
  content: "none",
  schema: z.object({
    kind: z.enum([
      "bar",
      "line",
    ]),
  }),
  toText: (block) => `${block.props.kind} chart`,
  type: "chart",
});

const citation = defineInline({
  schema: z.object({
    source: z.string(),
  }),
  toText: (node) => `[${node.props.source}]`,
  type: "citation",
});

const registry = createRegistry<ReactNode>({
  blocks: [
    ...defaultBlocks,
    chart,
  ],
  inlines: [
    citation,
  ],
});

const schema = getSchema(
  createExtensions(registry, {
    placeholders: {
      block: "",
      title: "",
    },
    slashMenu: {
      empty: "",
      label: "",
    },
  }),
);

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
          text: "Hello ",
          type: "text",
        },
        {
          marks: [
            {
              type: "bold",
            },
            {
              href: "https://example.com",
              type: "link",
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
      id: "p",
      props: {},
      type: "paragraph",
    },
    {
      id: "c",
      props: {
        kind: "bar",
      },
      type: "chart",
    },
  ],
  title: "Notes",
};

function createState() {
  return EditorState.create({
    doc: schema.nodeFromJSON(documentToJSON(document)),
    schema,
  });
}

describe("document conversion", () => {
  test("round-trips a document through the editor schema", () => {
    expect(nodeToDocument(createState().doc)).toEqual(document);
  });
});

describe("applyOperationsToTransaction", () => {
  test("applies every operation to the editor document", () => {
    const tr = createState().tr;
    const result = applyOperationsToTransaction(
      tr,
      [
        {
          op: "set_title",
          title: "Renamed",
        },
        {
          afterId: "h",
          block: {
            content: [
              {
                text: "New",
                type: "text",
              },
            ],
            id: "n",
            props: {},
            type: "paragraph",
          },
          op: "insert",
        },
        {
          id: "h",
          op: "update",
          props: {
            level: 2,
          },
        },
        {
          content: [
            {
              text: "Replaced",
              type: "text",
            },
          ],
          id: "p",
          op: "update",
        },
        {
          afterId: null,
          id: "c",
          op: "move",
        },
        {
          id: "n",
          op: "delete",
        },
      ],
      {
        registry,
      },
    );
    expect(result.ok).toBe(true);
    const fromEditor = nodeToDocument(tr.doc);
    expect(result.ok && fromEditor).toEqual(result.ok && result.value);
    expect(fromEditor.title).toBe("Renamed");
    expect(fromEditor.blocks.map((block) => block.id)).toEqual([
      "c",
      "h",
      "p",
    ]);
  });

  test("leaves the transaction untouched on error", () => {
    const tr = createState().tr;
    const result = applyOperationsToTransaction(
      tr,
      [
        {
          op: "set_title",
          title: "x",
        },
        {
          id: "missing",
          op: "delete",
        },
      ],
      {
        registry,
      },
    );
    expect(!result.ok && result.error.code).toBe("unknown_block");
    expect(tr.docChanged).toBe(false);
  });
});
