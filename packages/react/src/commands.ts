import type { Editor } from "@tiptap/core";
import { changeIndent } from "./lists.js";
import { moveBlock } from "./move.js";

/**
 * Editor actions that have keyboard shortcuts, to run them from your own
 * hotkey system. Each returns `true` when it did something. They do nothing
 * before the editor mounts or while it is read-only.
 *
 * @example
 * ```ts
 * const editor = useBlockNotes({ shortcuts: false });
 * useHotkeys("mod+j", () => editor.commands.openAi());
 * ```
 */
export interface BlockNotesCommands {
  /** Opens the AI prompt for the current selection. Needs an AI adapter. */
  openAi(): boolean;
  /** Moves the current block up. */
  moveBlockUp(): boolean;
  /** Moves the current block down. */
  moveBlockDown(): boolean;
  /** Indents the current list item. */
  indent(): boolean;
  /** Outdents the current list item. */
  outdent(): boolean;
  toggleBold(): boolean;
  toggleItalic(): boolean;
  toggleUnderline(): boolean;
  toggleStrike(): boolean;
  toggleCode(): boolean;
  undo(): boolean;
  redo(): boolean;
}

/**
 * @internal Builds the commands. `getEditor` and `ask` are read on every
 * call, so the same object keeps working after the editor mounts.
 */
export function createCommands(
  getEditor: () => Editor | null,
  ask: () => (() => void) | null,
): BlockNotesCommands {
  const run = (action: (editor: Editor) => boolean): boolean => {
    const editor = getEditor();
    return (
      editor !== null &&
      !editor.isDestroyed &&
      editor.isEditable &&
      action(editor)
    );
  };
  return {
    indent: () =>
      run((editor) => editor.commands.command(({ tr }) => changeIndent(tr, 1))),
    moveBlockDown: () =>
      run((editor) => editor.commands.command(({ tr }) => moveBlock(tr, 1))),
    moveBlockUp: () =>
      run((editor) => editor.commands.command(({ tr }) => moveBlock(tr, -1))),
    openAi: () =>
      run(() => {
        const open = ask();
        if (open === null) {
          return false;
        }
        open();
        return true;
      }),
    outdent: () =>
      run((editor) =>
        editor.commands.command(({ tr }) => changeIndent(tr, -1)),
      ),
    redo: () => run((editor) => editor.commands.redo()),
    toggleBold: () => run((editor) => editor.commands.toggleBold()),
    toggleCode: () => run((editor) => editor.commands.toggleCode()),
    toggleItalic: () => run((editor) => editor.commands.toggleItalic()),
    toggleStrike: () => run((editor) => editor.commands.toggleStrike()),
    toggleUnderline: () => run((editor) => editor.commands.toggleUnderline()),
    undo: () => run((editor) => editor.commands.undo()),
  };
}
