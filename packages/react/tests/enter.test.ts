import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import {
  type BlockNotesDocument,
  createRegistry,
  defineBlock,
  enMessages,
} from "@useblocknotes/core";
import type { ReactNode } from "react";
import * as z from "zod";
import { defaultBlocks } from "../src/blocks.js";
import { documentToJSON, nodeToDocument, TITLE_NODE } from "../src/convert.js";
import { createExtensions } from "../src/extensions.js";
import { handleEnter } from "../src/lists.js";
import { createSlashMenuStore } from "../src/slash-menu.js";

// Registered first, so a plain ProseMirror split would create it on Enter.
const subtitle = defineBlock({
  content: "inline",
  schema: z.object({}),
  toText: (block, context) => context.text(block.content),
  type: "subtitle",
});

const registry = createRegistry<ReactNode>({
  blocks: [
    subtitle,
    ...defaultBlocks,
  ],
});

const schema = getSchema(
  createExtensions(registry, {
    messages: () => enMessages,
    slashMenu: createSlashMenuStore(),
  }),
);

const document: BlockNotesDocument = {
  blocks: [
    {
      content: [
        {
          text: "Heading",
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
          text: "Sub",
          type: "text",
        },
      ],
      id: "s",
      props: {},
      type: "subtitle",
    },
    {
      content: [
        {
          text: "Item",
          type: "text",
        },
      ],
      id: "l",
      props: {
        indent: 0,
      },
      type: "bulletListItem",
    },
  ],
  title: "Notes",
};

/** Position inside the block with `id` (or the title), `offset` characters in. */
function positionIn(state: EditorState, id: string, offset: number): number {
  let found = -1;
  state.doc.forEach((node, pos) => {
    const matches =
      id === TITLE_NODE
        ? node.type.name === TITLE_NODE
        : node.attrs["id"] === id;
    if (matches) {
      found = pos + 1 + offset;
    }
  });
  return found;
}

/** Presses Enter at `offset` inside the block `id` and returns the result. */
function enter(id: string, offset: number) {
  const initial = EditorState.create({
    doc: schema.nodeFromJSON(documentToJSON(document)),
    schema,
  });
  const tr = initial.tr.setSelection(
    TextSelection.create(initial.doc, positionIn(initial, id, offset)),
  );
  const handled = handleEnter(tr);
  const result = nodeToDocument(tr.doc);
  return {
    blocks: result.blocks.map((block) => ({
      text: (block.content ?? [])
        .map((node) => ("text" in node ? node.text : ""))
        .join(""),
      type: block.type,
    })),
    handled,
    selectionIn: tr.selection.$from.parent.type.name,
    title: result.title,
  };
}

describe("Enter", () => {
  test("creates a paragraph at the end of a heading", () => {
    const result = enter("h", "Heading".length);
    expect(result.handled).toBe(true);
    expect(result.blocks.slice(0, 2)).toEqual([
      {
        text: "Heading",
        type: "heading",
      },
      {
        text: "",
        type: "paragraph",
      },
    ]);
    expect(result.selectionIn).toBe("paragraph");
  });

  test("creates a paragraph, not the first registered type, after a custom block", () => {
    const result = enter("s", "Sub".length);
    expect(result.blocks[2]).toEqual({
      text: "",
      type: "paragraph",
    });
  });

  test("inserts a paragraph before a block when the cursor is at its start", () => {
    const result = enter("h", 0);
    expect(result.blocks.slice(0, 2)).toEqual([
      {
        text: "",
        type: "paragraph",
      },
      {
        text: "Heading",
        type: "heading",
      },
    ]);
    expect(result.selectionIn).toBe("heading");
  });

  test("keeps the default split in the middle of a block", () => {
    expect(enter("h", 3).handled).toBe(false);
  });

  test("moves the text after the cursor in the title to a first paragraph", () => {
    const result = enter(TITLE_NODE, 2);
    expect(result.title).toBe("No");
    expect(result.blocks[0]).toEqual({
      text: "tes",
      type: "paragraph",
    });
    expect(result.selectionIn).toBe("paragraph");
  });

  test("creates an empty first paragraph at the end of the title", () => {
    const result = enter(TITLE_NODE, "Notes".length);
    expect(result.title).toBe("Notes");
    expect(result.blocks[0]).toEqual({
      text: "",
      type: "paragraph",
    });
  });

  test("continues a list with the same type", () => {
    const result = enter("l", "Item".length);
    expect(result.blocks.at(-1)).toEqual({
      text: "",
      type: "bulletListItem",
    });
  });
});
