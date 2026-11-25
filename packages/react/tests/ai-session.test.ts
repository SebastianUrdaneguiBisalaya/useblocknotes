import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { history, undo, undoDepth } from "@tiptap/pm/history";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import {
  type AiStreamEvent,
  type BlockNotesDocument,
  createRegistry,
  processAiStream,
} from "@useblocknotes/core";
import type { ReactNode } from "react";
import {
  acceptAiPreview,
  readSelection,
  rejectAiPreview,
  showAiPreview,
} from "../src/ai-session.js";
import { defaultBlocks } from "../src/blocks.js";
import { documentToJSON, nodeToDocument } from "../src/convert.js";
import { createExtensions } from "../src/extensions.js";

const registry = createRegistry<ReactNode>({
  blocks: defaultBlocks,
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

const base: BlockNotesDocument = {
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

/** An editor view stand-in that applies dispatched transactions. */
function createView() {
  const view = {
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr);
    },
    state: EditorState.create({
      doc: schema.nodeFromJSON(documentToJSON(base)),
      plugins: [
        history(),
      ],
      schema,
    }),
  };
  return view;
}

async function* events(): AsyncGenerator<AiStreamEvent> {
  yield {
    operation: {
      afterId: "a",
      block: {
        content: [],
        id: "ai",
        props: {},
        type: "paragraph",
      },
      op: "insert",
    },
    type: "operation",
  };
  yield {
    blockId: "ai",
    delta: "Hello",
    type: "text_delta",
  };
  yield {
    blockId: "ai",
    delta: " world",
    type: "text_delta",
  };
}

async function streamInto(view: ReturnType<typeof createView>) {
  const result = await processAiStream(events(), {
    document: base,
    onUpdate: (state) => showAiPreview(view, state),
    registry,
  });
  if (!result.ok) {
    throw new Error(result.error.code);
  }
  return result.value;
}

const text = (view: ReturnType<typeof createView>) =>
  nodeToDocument(view.state.doc).blocks.map((block) =>
    registry.text.text(block.content),
  );

describe("AI preview", () => {
  test("renders streamed text live, outside the undo history", async () => {
    const view = createView();
    await streamInto(view);

    expect(text(view)).toEqual([
      "Intro",
      "Hello world",
    ]);
    expect(undoDepth(view.state)).toBe(0);
  });

  test("reject restores the original document", async () => {
    const view = createView();
    await streamInto(view);
    rejectAiPreview(view, base);

    expect(nodeToDocument(view.state.doc)).toEqual(base);
    expect(undoDepth(view.state)).toBe(0);
  });

  test("accept applies the batch as a single undo step", async () => {
    const view = createView();
    view.dispatch(view.state.tr.insertText("!", 11));
    const before = nodeToDocument(view.state.doc);
    const state = await processAiStream(events(), {
      document: before,
      onUpdate: (next) => showAiPreview(view, next),
      registry,
    });
    expect(state.ok).toBe(true);
    if (!state.ok) return;

    const result = acceptAiPreview(
      view,
      before,
      state.value.operations,
      registry,
    );
    expect(result.ok).toBe(true);
    expect(text(view)).toEqual([
      "Intro!",
      "Hello world",
    ]);
    expect(undoDepth(view.state)).toBe(2);

    undo(view.state, view.dispatch);
    expect(nodeToDocument(view.state.doc)).toEqual(before);
    undo(view.state, view.dispatch);
    expect(nodeToDocument(view.state.doc)).toEqual(base);
  });
});

describe("readSelection", () => {
  test("returns the cursor block and no selection when empty", () => {
    const view = createView();
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 7)),
    );

    expect(readSelection(view.state)).toEqual({
      anchorBlockId: "a",
      selection: null,
    });
  });

  test("returns selected blocks and text", () => {
    const view = createView();
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 6, 9)),
    );

    expect(readSelection(view.state)).toEqual({
      anchorBlockId: "a",
      selection: {
        blockIds: [
          "a",
        ],
        text: "Int",
      },
    });
  });
});
