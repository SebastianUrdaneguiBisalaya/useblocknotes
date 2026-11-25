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
import { createCommands } from "../src/commands.js";
import { documentToJSON, nodeToDocument } from "../src/convert.js";
import { createExtensions } from "../src/extensions.js";
import {
  type KeyboardEventLike,
  matchesShortcut,
  resolveShortcuts,
  type ShortcutsOption,
} from "../src/shortcuts.js";
import { createSlashMenuStore } from "../src/slash-menu.js";

function key(
  name: string,
  modifiers: Partial<Omit<KeyboardEventLike, "key">> = {},
): KeyboardEventLike {
  return {
    altKey: false,
    ctrlKey: false,
    key: name,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  };
}

describe("resolveShortcuts", () => {
  test("keeps the defaults for actions not listed", () => {
    const resolved = resolveShortcuts({
      openAi: "Mod-k",
      toggleBold: [
        "Mod-b",
        "Mod-Shift-b",
      ],
      undo: false,
    });
    expect(resolved.openAi).toEqual([
      "Mod-k",
    ]);
    expect(resolved.toggleBold).toEqual([
      "Mod-b",
      "Mod-Shift-b",
    ]);
    expect(resolved.undo).toEqual([]);
    expect(resolved.redo).toEqual([
      "Mod-y",
      "Mod-Shift-z",
    ]);
  });

  test("turns every shortcut off with false", () => {
    expect(Object.values(resolveShortcuts(false)).flat()).toEqual([]);
  });
});

describe("matchesShortcut", () => {
  test("requires exactly the same modifiers", () => {
    expect(
      matchesShortcut(key("Enter"), [
        "Enter",
      ]),
    ).toBe(true);
    expect(
      matchesShortcut(
        key("Enter", {
          shiftKey: true,
        }),
        [
          "Enter",
        ],
      ),
    ).toBe(false);
    expect(
      matchesShortcut(
        key("Tab", {
          shiftKey: true,
        }),
        [
          "Shift-Tab",
        ],
      ),
    ).toBe(true);
  });

  test("matches letters in any case and Mod as Ctrl or Cmd by platform", () => {
    const ctrl = key("S", {
      ctrlKey: true,
      shiftKey: true,
    });
    const cmd = key("S", {
      metaKey: true,
      shiftKey: true,
    });
    const matches = [
      ctrl,
      cmd,
    ].filter((event) =>
      matchesShortcut(event, [
        "Mod-Shift-s",
      ]),
    );
    expect(matches.length).toBe(1);
    expect(
      matchesShortcut(key(" "), [
        "Space",
      ]),
    ).toBe(true);
  });
});

const document: BlockNotesDocument = {
  blocks: [
    {
      content: [
        {
          text: "First",
          type: "text",
        },
      ],
      id: "a",
      props: {},
      type: "paragraph",
    },
    {
      content: [],
      id: "b",
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

function setup(option?: ShortcutsOption) {
  const store = createSlashMenuStore();
  const asked: string[] = [];
  const editor = new EditorClass({
    content: documentToJSON(document),
    element: window.document.createElement("div"),
    extensions: createExtensions(
      createRegistry<ReactNode>({
        blocks: defaultBlocks,
      }),
      {
        ai: {
          ask: () => asked.push("ask"),
        },
        messages: () => enMessages,
        shortcuts: resolveShortcuts(option),
        slashMenu: store,
      },
    ),
  });
  // Cursor in the empty second block.
  const end = editor.state.doc.content.size;
  editor.commands.setTextSelection(end - 1);
  return {
    asked,
    editor,
    store,
  };
}

/** Runs the editor's keydown handlers, in plugin order. */
function press(
  editor: Editor,
  name: string,
  modifiers: KeyboardEventInit = {},
): boolean {
  const event = new KeyboardEvent("keydown", {
    key: name,
    ...modifiers,
  });
  return (
    editor.view.someProp("handleKeyDown", (handle) =>
      handle(editor.view, event),
    ) ?? false
  );
}

async function type(editor: Editor, text: string): Promise<void> {
  editor.view.dispatch(editor.state.tr.insertText(text));
  // The suggestion plugin loads items asynchronously.
  await Bun.sleep(0);
}

function types(editor: Editor): string[] {
  return nodeToDocument(editor.state.doc).blocks.map((block) => block.type);
}

/** `Mod` for the current platform; read after happy-dom replaces `navigator`. */
function mod(): KeyboardEventInit {
  return /Mac|iP(hone|[oa]d)/.test(navigator.platform)
    ? {
        metaKey: true,
      }
    : {
        ctrlKey: true,
      };
}

describe("editor shortcuts", () => {
  test("Enter runs the highlighted slash menu entry", async () => {
    const { editor, store } = setup();
    await type(editor, "/quote");
    expect(press(editor, "Enter")).toBe(true);
    expect(store.getState()).toBeNull();
    expect(types(editor)).toEqual([
      "paragraph",
      "quote",
    ]);
    editor.destroy();
  });

  test("arrow keys move the slash menu highlight", async () => {
    const { editor, store } = setup();
    await type(editor, "/");
    press(editor, "ArrowDown");
    expect(store.getState()?.selectedIndex).toBe(1);
    press(editor, "ArrowUp");
    press(editor, "ArrowUp");
    expect(store.getState()?.selectedIndex).toBe(
      (store.getState()?.items.length ?? 0) - 1,
    );
    editor.destroy();
  });

  test("Escape stays open when slashMenuClose is off", async () => {
    const { editor, store } = setup({
      slashMenuClose: false,
    });
    await type(editor, "/");
    press(editor, "Escape");
    expect(store.getState()).not.toBeNull();
    editor.destroy();
  });

  test("remaps openAi and turns moveBlockUp off", () => {
    const { asked, editor } = setup({
      moveBlockUp: false,
      openAi: "Mod-k",
    });
    expect(press(editor, "j", mod())).toBe(false);
    expect(press(editor, "k", mod())).toBe(true);
    expect(asked).toEqual([
      "ask",
    ]);
    expect(
      press(editor, "ArrowUp", {
        ...mod(),
        shiftKey: true,
      }),
    ).toBe(false);
    editor.destroy();
  });

  test("shortcuts: false turns the editor keys off", () => {
    const { editor } = setup(false);
    expect(press(editor, "b", mod())).toBe(false);
    expect(press(editor, "Tab")).toBe(false);
    editor.destroy();
  });

  test("commands run the actions without keys", () => {
    const { asked, editor } = setup(false);
    const commands = createCommands(
      () => editor,
      () => () => asked.push("ask"),
    );
    expect(commands.moveBlockUp()).toBe(true);
    expect(nodeToDocument(editor.state.doc).blocks[0]?.id).toBe("b");
    expect(commands.undo()).toBe(true);
    expect(nodeToDocument(editor.state.doc).blocks[0]?.id).toBe("a");
    expect(commands.openAi()).toBe(true);
    expect(asked).toEqual([
      "ask",
    ]);
    editor.setEditable(false);
    expect(commands.moveBlockUp()).toBe(false);
    editor.destroy();
  });
});
