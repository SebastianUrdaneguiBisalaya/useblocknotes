import { EditorContent } from "@tiptap/react";
import type { ReactNode } from "react";
import { AiPrompt } from "./ai-prompt.js";
import { AskAiButton } from "./ask-ai-button.js";
import type { BlockNotesInstance } from "./use-block-notes.js";

/** Props of `<BlockNotesEditor />`. */
export interface BlockNotesEditorProps {
  /** Instance created with `useBlockNotes()`. */
  readonly editor: BlockNotesInstance;
  /** Class of the root element (`.bn-root`). */
  readonly className?: string;
  /** Class of the editable content element (`.bn-content`). */
  readonly contentClassName?: string;
  /** Class of the AI prompt (`.bn-ai-prompt`). */
  readonly aiPromptClassName?: string;
  /** Class of the floating "Ask AI" button (`.bn-ask-ai`). */
  readonly askAiClassName?: string;
}

function join(base: string, extra: string | undefined): string {
  return extra === undefined ? base : `${base} ${extra}`;
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
  aiPromptClassName,
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
      {editor.ai.open ? (
        <AiPrompt
          ai={editor.ai}
          className={aiPromptClassName}
        />
      ) : null}
    </div>
  );
}
