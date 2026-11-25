import { EditorContent } from "@tiptap/react";
import type { ComponentType, ReactNode } from "react";
import { AiChatBar, type AiChatBarProps } from "./ai-chat-bar.js";
import { join } from "./ai-controls.js";
import { AiPopover, AiPopoverHost, type AiPopoverProps } from "./ai-popover.js";
import {
  AskAiButton,
  type AskAiButtonProps,
  AskAiHost,
} from "./ask-ai-button.js";
import { ShortcutsContext } from "./context.js";
import { MessagesContext } from "./messages.js";
import { SlashMenu, SlashMenuHost, type SlashMenuProps } from "./slash-menu.js";
import type { BlockNotesInstance } from "./use-block-notes.js";

/**
 * Where the AI prompt is shown.
 *
 * - `popover`: next to the cursor, opened by `/ai`, the `openAi` shortcut
 *   (`Mod-j`) or "Ask AI".
 * - `chat`: a bar fixed at the bottom of the editor, with the history of
 *   requests. `/ai`, `openAi` and "Ask AI" focus it.
 */
export type AiMode = "popover" | "chat";

/**
 * Color theme of the base styles (`@useblocknotes/react/styles.css`).
 *
 * - `system`: follows the operating system (`prefers-color-scheme`), or the
 *   `--bn-color-scheme` variable when the host sets it.
 * - `light` / `dark`: forces that theme with `data-bn-theme` on `.bn-root`.
 */
export type BlockNotesTheme = "system" | "light" | "dark";

/**
 * Components that replace the built-in UI. Each one is optional: omit it to
 * keep the built-in component, or pass `null` to render nothing. The editor
 * keeps the logic (filtering, keys, AI state) and passes it as props.
 *
 * @example
 * ```tsx
 * <BlockNotesEditor
 *   editor={editor}
 *   components={{ slashMenu: MySlashMenu, askAiButton: null }}
 * />
 * ```
 */
export interface BlockNotesComponents {
  /** The `/` menu. */
  readonly slashMenu?: ComponentType<SlashMenuProps> | null;
  /** The AI prompt when `aiMode` is `"popover"`. */
  readonly aiPopover?: ComponentType<AiPopoverProps> | null;
  /** The AI prompt when `aiMode` is `"chat"`. */
  readonly aiChatBar?: ComponentType<AiChatBarProps> | null;
  /** The button shown above a selection that opens the AI prompt. */
  readonly askAiButton?: ComponentType<AskAiButtonProps> | null;
}

/** Props of `<BlockNotesEditor />`. */
export interface BlockNotesEditorProps {
  /** Instance created with `useBlockNotes()`. */
  readonly editor: BlockNotesInstance;
  /** Class of the root element (`.bn-root`). */
  readonly className?: string;
  /** Class of the editable content element (`.bn-content`). */
  readonly contentClassName?: string;
  /** AI prompt mode. Defaults to `"popover"`. */
  readonly aiMode?: AiMode;
  /** Class of the AI popover (`.bn-ai-popover`). */
  readonly aiPopoverClassName?: string;
  /** Class of the AI chat bar (`.bn-ai-chat`). */
  readonly aiChatClassName?: string;
  /** Class of the floating "Ask AI" button (`.bn-ask-ai`). */
  readonly askAiClassName?: string;
  /** Replaces or hides the slash menu and the AI components. */
  readonly components?: BlockNotesComponents;
  /** Color theme of the base styles. Defaults to `"system"`. */
  readonly theme?: BlockNotesTheme;
}

/**
 * Renders a useblocknotes editor. Unstyled by default: import
 * `@useblocknotes/react/styles.css` for base styles driven by CSS variables,
 * or style the `bn-*` classes and `data-bn-*` attributes yourself.
 *
 * @example
 * ```tsx
 * const editor = useBlockNotes({ initialDocument });
 * return <BlockNotesEditor editor={editor} className="prose" />;
 * ```
 */
export function BlockNotesEditor({
  aiChatClassName,
  aiMode = "popover",
  aiPopoverClassName,
  askAiClassName,
  className,
  components = {},
  contentClassName,
  editor,
  theme = "system",
}: BlockNotesEditorProps): ReactNode {
  const { ai, tiptap } = editor;
  const slashMenu = pick(components.slashMenu, SlashMenu);
  const aiPopover = pick(components.aiPopover, AiPopover);
  const ChatBar = pick(components.aiChatBar, AiChatBar);
  const askAiButton = pick(components.askAiButton, AskAiButton);
  return (
    <MessagesContext value={editor.messages}>
      <ShortcutsContext value={editor.shortcuts}>
        <div
          className={join("bn-root", className)}
          data-bn-root=""
          data-bn-theme={theme === "system" ? undefined : theme}
        >
          <EditorContent
            className={join("bn-content", contentClassName)}
            editor={tiptap}
          />
          {slashMenu === null ? null : (
            <SlashMenuHost
              component={slashMenu}
              editorElement={tiptap?.view.dom ?? null}
              store={editor.slashMenu}
            />
          )}
          {ai.enabled && tiptap !== null && askAiButton !== null ? (
            <AskAiHost
              ai={ai}
              className={askAiClassName}
              component={askAiButton}
              tiptap={tiptap}
            />
          ) : null}
          {ai.enabled && aiMode === "chat" && ChatBar !== null ? (
            <ChatBar
              ai={ai}
              className={aiChatClassName}
            />
          ) : null}
          {ai.open &&
          aiMode === "popover" &&
          tiptap !== null &&
          aiPopover !== null ? (
            <AiPopoverHost
              ai={ai}
              className={aiPopoverClassName}
              component={aiPopover}
              tiptap={tiptap}
            />
          ) : null}
        </div>
      </ShortcutsContext>
    </MessagesContext>
  );
}

/** The consumer's component, the built-in one when omitted, or `null`. */
function pick<TProps>(
  custom: ComponentType<TProps> | null | undefined,
  builtIn: ComponentType<TProps>,
): ComponentType<TProps> | null {
  return custom === undefined ? builtIn : custom;
}
