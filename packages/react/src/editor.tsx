import { EditorContent } from "@tiptap/react";
import type { ReactNode } from "react";
import { AiChatBar } from "./ai-chat-bar.js";
import { join } from "./ai-controls.js";
import { AiPopover } from "./ai-popover.js";
import { AskAiButton } from "./ask-ai-button.js";
import type { BlockNotesInstance } from "./use-block-notes.js";

/**
 * Where the AI prompt is shown.
 *
 * - `popover`: next to the cursor, opened by `/ai`, `Mod-J` or "Ask AI".
 * - `chat`: a bar fixed at the bottom of the editor, with the history of
 *   requests. `/ai`, `Mod-J` and "Ask AI" focus it.
 */
export type AiMode = "popover" | "chat";

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
  contentClassName,
  editor,
}: BlockNotesEditorProps): ReactNode {
  return (
    <div
      className={join("bn-root", className)}
      data-bn-root=""
    >
      <EditorContent
        className={join("bn-content", contentClassName)}
        editor={editor.tiptap}
      />
      {editor.ai.enabled ? (
        <AskAiButton
          ai={editor.ai}
          className={askAiClassName}
          tiptap={editor.tiptap}
        />
      ) : null}
      {editor.ai.enabled && aiMode === "chat" ? (
        <AiChatBar
          ai={editor.ai}
          className={aiChatClassName}
        />
      ) : null}
      {editor.ai.open && aiMode === "popover" ? (
        <AiPopover
          ai={editor.ai}
          className={aiPopoverClassName}
          tiptap={editor.tiptap}
        />
      ) : null}
    </div>
  );
}
