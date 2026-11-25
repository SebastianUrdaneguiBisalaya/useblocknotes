import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { TITLE_NODE } from "./convert.js";
import { useMessages } from "./messages.js";
import type { AiController } from "./use-ai.js";

/** Props of the "Ask AI" button. */
export interface AskAiButtonProps {
  readonly tiptap: Editor | null;
  readonly ai: AiController;
  /** Class of the button (`.bn-ask-ai`). */
  readonly className?: string | undefined;
}

interface Range {
  readonly from: number;
  readonly to: number;
}

/** Non-empty selection outside the title, while the editor is focused. */
function useSelectionRange(tiptap: Editor | null): Range | null {
  return useEditorState({
    editor: tiptap,
    selector: ({ editor }): Range | null => {
      if (editor === null || !editor.isFocused || !editor.isEditable) {
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

/**
 * @internal Floating button shown above a selection that opens the AI prompt
 * for it.
 */
export function AskAiButton({
  ai,
  className,
  tiptap,
}: AskAiButtonProps): ReactNode {
  const messages = useMessages().ai;
  const range = useSelectionRange(tiptap);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const visible = range !== null && !ai.open;

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!visible || tiptap === null || button === null) {
      return;
    }
    const { view } = tiptap;
    const reference = {
      contextElement: view.dom,
      getBoundingClientRect: () => {
        const start = view.coordsAtPos(range.from);
        const end = view.coordsAtPos(range.to);
        const left = Math.min(start.left, end.left);
        const right = Math.max(start.right, end.right);
        return {
          bottom: end.bottom,
          height: end.bottom - start.top,
          left,
          right,
          top: start.top,
          width: right - left,
          x: left,
          y: start.top,
        };
      },
    };
    return autoUpdate(reference, button, () => {
      void computePosition(reference, button, {
        middleware: [
          offset(8),
          flip(),
          shift({
            padding: 8,
          }),
        ],
        placement: "top-start",
        strategy: "fixed",
      }).then(({ x, y }) => {
        button.style.left = `${x}px`;
        button.style.top = `${y}px`;
      });
    });
  }, [
    visible,
    tiptap,
    range,
  ]);

  if (!visible) {
    return null;
  }
  return (
    <button
      className={
        className === undefined ? "bn-ask-ai" : `bn-ask-ai ${className}`
      }
      // Prevent mouse down from blurring the editor and losing the selection.
      onClick={ai.ask}
      onMouseDown={(event) => event.preventDefault()}
      ref={buttonRef}
      style={{
        position: "fixed",
      }}
      type="button"
    >
      {messages.askAi}
    </button>
  );
}
