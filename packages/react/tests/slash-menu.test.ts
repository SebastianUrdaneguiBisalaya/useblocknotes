import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { Editor } from "@tiptap/core";
import {
  type BlockNotesDocument,
  createRegistry,
  enMessages,
} from "@useblocknotes/core";
import type { ReactNode } from "react";
import { defaultBlocks } from "../src/blocks.js";
import { documentToJSON, nodeToDocument } from "../src/convert.js";
import { createExtensions } from "../src/extensions.js";
import { createSlashMenuStore } from "../src/slash-menu.js";

const document: BlockNotesDocument = {
  blocks: [
    {
      content: [],
      id: "p",
      props: {},
      type: "paragraph",
    },
  ],
  title: "Notes",
};

let EditorClass: typeof Editor;

beforeAll(async () => {
  GlobalRegistrator.register();
  // Tiptap reads `window` when it loads.
  EditorClass = (await import("@tiptap/core")).Editor;
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

function createEditor() {
  const store = createSlashMenuStore();
  const registry = createRegistry<ReactNode>({
    blocks: defaultBlocks,
  });
  const editor = new EditorClass({
    content: documentToJSON(document),
    element: window.document.createElement("div"),
    extensions: createExtensions(registry, {
      messages: () => enMessages,
      slashMenu: store,
    }),
  });
  // Cursor inside the empty paragraph, after the title.
  editor.commands.setTextSelection(editor.state.doc.firstChild?.nodeSize ?? 0);
  editor.commands.setTextSelection(editor.state.selection.from + 1);
  return {
    editor,
    store,
  };
}

/** Types `text` and waits for the suggestion plugin, which loads items asynchronously. */
async function type(editor: Editor, text: string): Promise<void> {
  const { from, to } = editor.state.selection;
  editor.view.dispatch(editor.state.tr.insertText(text, from, to));
  await Bun.sleep(0);
}

describe("slash menu store", () => {
  test("publishes the filtered items while the menu is open", async () => {
    const { editor, store } = createEditor();
    const states: number[] = [];
    store.subscribe(() => states.push(store.getState()?.items.length ?? -1));
    expect(store.getState()).toBeNull();

    await type(editor, "/");
    const opened = store.getState();
    expect(opened?.query).toBe("");
    expect(opened?.selectedIndex).toBe(0);
    expect(opened?.items.length).toBeGreaterThan(1);

    await type(editor, "quote");
    expect(store.getState()?.items.map((item) => item.key)).toEqual([
      "quote:0",
    ]);
    expect(states.length).toBeGreaterThan(1);
    editor.destroy();
  });

  test("runs the selected item and closes", async () => {
    const { editor, store } = createEditor();
    await type(editor, "/quote");
    store.getState()?.select(0);
    expect(store.getState()).toBeNull();
    expect(nodeToDocument(editor.state.doc).blocks[0]?.type).toBe("quote");
    editor.destroy();
  });

  test("highlight changes the selected index, close leaves the text", async () => {
    const { editor, store } = createEditor();
    await type(editor, "/");
    store.getState()?.highlight(2);
    expect(store.getState()?.selectedIndex).toBe(2);
    store.getState()?.close();
    expect(store.getState()).toBeNull();
    expect(editor.state.doc.textContent).toBe("Notes/");
    editor.destroy();
  });
});
