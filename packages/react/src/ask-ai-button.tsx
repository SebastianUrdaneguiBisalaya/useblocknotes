import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { type ComponentType, type ReactNode, useMemo } from "react";
import { join } from "./ai-controls.js";
import { TITLE_NODE } from "./convert.js";
import {
  type FloatingProps,
  type FloatingReference,
  useFloating,
} from "./floating.js";
import { useMessages } from "./messages.js";
import type { AiController } from "./use-ai.js";

/**
 * Props of an "Ask AI" button component (see `components.askAiButton`). It is
 * rendered only while there is a non-empty selection and the prompt is closed.
 */
export interface AskAiButtonProps {
  /** AI state and actions of the editor. Call `ai.ask()` to open the prompt. */
  readonly ai: AiController;
  /** The selected text. */
  readonly reference: FloatingReference;
  /** Spread on the root element to let the editor position it. */
  readonly floating: FloatingProps;
  /** The `askAiClassName` prop of `<BlockNotesEditor />`. */
  readonly className?: string | undefined;
}

interface Range {
  readonly from: number;
  readonly to: number;
}

/** Non-empty selection outside the title, while the editor is focused. */
function useSelectionRange(tiptap: Editor): Range | null {
  return useEditorState({
    editor: tiptap,
    equalityFn: (a, b) => a?.from === b?.from && a?.to === b?.to,
    selector: ({ editor }): Range | null => {
      if (!editor.isFocused || !editor.isEditable) {
        return null;
      }
      const { $from, empty, from, to } = editor.state.selection;
      return empty || $from.parent.type.name === TITLE_NODE
        ? null
        : {
            from,
            to,
          };
    },
  });
}

function selectionReference(tiptap: Editor, range: Range): FloatingReference {
  const { view } = tiptap;
  return {
    contextElement: view.dom,
    getBoundingClientRect: () => {
      const start = view.coordsAtPos(range.from);
      const end = view.coordsAtPos(range.to);
      const left = Math.min(start.left, end.left);
      const right = Math.max(start.right, end.right);
      return new DOMRect(left, start.top, right - left, end.bottom - start.top);
    },
  };
}

/**
 * The built-in "Ask AI" button, shown above a selection. Uses the
 * `bn-ask-ai` class.
 */
export function AskAiButton({
  ai,
  className,
  floating,
}: AskAiButtonProps): ReactNode {
  const messages = useMessages().ai;
  return (
    <button
      {...floating}
      className={join("bn-ask-ai", className)}
      onClick={ai.ask}
      // Prevent mouse down from blurring the editor and losing the selection.
      onMouseDown={(event) => event.preventDefault()}
      type="button"
    >
      {messages.askAi}
    </button>
  );
}

/**
 * @internal Renders the "Ask AI" component above a non-empty selection while
 * the prompt is closed.
 */
export function AskAiHost({
  ai,
  className,
  component: Component,
  tiptap,
}: {
  readonly ai: AiController;
  readonly className: string | undefined;
  readonly component: ComponentType<AskAiButtonProps>;
  readonly tiptap: Editor;
}): ReactNode {
  const range = useSelectionRange(tiptap);
  const reference = useMemo(
    () =>
      range === null || ai.open ? null : selectionReference(tiptap, range),
    [
      tiptap,
      range,
      ai.open,
    ],
  );
  const floating = useFloating(reference, "top-start");
  if (reference === null) {
    return null;
  }
  return (
    <Component
      ai={ai}
      className={className}
      floating={floating}
      reference={reference}
    />
  );
}
