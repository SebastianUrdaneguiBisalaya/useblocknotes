import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { createCommands } from "./commands.js";
import { handleBackspace, handleEnter } from "./lists.js";
import {
  matchesShortcut,
  type ResolvedShortcuts,
  type ShortcutAction,
} from "./shortcuts.js";

/** Options of {@link createShortcuts}. */
export interface ShortcutsExtensionOptions {
  readonly shortcuts: ResolvedShortcuts;
  /** Opens the AI prompt, or `null` without an AI adapter. */
  readonly ask: (() => void) | null;
}

/**
 * @internal Binds every editor shortcut from the resolved `shortcuts` option.
 * Runs before Tiptap's base keymap (so Enter and Backspace get the block
 * behavior first) and after the slash menu keys.
 */
export function createShortcuts(options: ShortcutsExtensionOptions): Extension {
  const { shortcuts } = options;
  return Extension.create({
    addProseMirrorPlugins() {
      const editor = this.editor;
      const commands = createCommands(
        () => editor,
        () => options.ask,
      );
      const actions: readonly (readonly [
        ShortcutAction,
        () => boolean,
      ])[] = [
        [
          "enter",
          () => editor.commands.command(({ tr }) => handleEnter(tr)),
        ],
        [
          "backspace",
          () => editor.commands.command(({ tr }) => handleBackspace(tr)),
        ],
        [
          "openAi",
          commands.openAi,
        ],
        [
          "moveBlockUp",
          commands.moveBlockUp,
        ],
        [
          "moveBlockDown",
          commands.moveBlockDown,
        ],
        [
          "indent",
          commands.indent,
        ],
        [
          "outdent",
          commands.outdent,
        ],
        [
          "toggleBold",
          commands.toggleBold,
        ],
        [
          "toggleItalic",
          commands.toggleItalic,
        ],
        [
          "toggleUnderline",
          commands.toggleUnderline,
        ],
        [
          "toggleStrike",
          commands.toggleStrike,
        ],
        [
          "toggleCode",
          commands.toggleCode,
        ],
        [
          "undo",
          commands.undo,
        ],
        [
          "redo",
          commands.redo,
        ],
      ];
      return [
        new Plugin({
          key: new PluginKey("blockNotesShortcuts"),
          props: {
            handleKeyDown: (_view, event) =>
              editor.isEditable &&
              actions.some(
                ([action, run]) =>
                  matchesShortcut(event, shortcuts[action]) && run(),
              ),
          },
        }),
      ];
    },
    name: "blockNotesShortcuts",
    // Before Tiptap's base keymap (priority 100).
    priority: 1000,
  });
}
