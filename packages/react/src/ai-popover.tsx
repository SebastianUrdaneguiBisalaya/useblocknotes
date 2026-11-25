import type { Editor } from "@tiptap/core";
import { type ComponentType, type ReactNode, useMemo } from "react";
import {
  AiComposer,
  AiStatusLine,
  join,
  useCloseHandler,
} from "./ai-controls.js";
import {
  type FloatingProps,
  type FloatingReference,
  useFloating,
} from "./floating.js";
import { useMessages } from "./messages.js";
import type { AiController } from "./use-ai.js";

/** Props of an AI popover component (see `components.aiPopover`). */
export interface AiPopoverProps {
  /** AI state and actions of the editor. */
  readonly ai: AiController;
  /** Below the last AI block while a batch is pending, else the cursor. */
  readonly reference: FloatingReference;
  /** Spread on the root element to let the editor position it. */
  readonly floating: FloatingProps;
  /** The `aiPopoverClassName` prop of `<BlockNotesEditor />`. */
  readonly className?: string | undefined;
}

/**
 * Anchors below the last AI block while a batch is pending, else below the
 * cursor.
 */
function anchor(tiptap: Editor): FloatingReference {
  const { view } = tiptap;
  return {
    contextElement: view.dom,
    getBoundingClientRect: () => {
      const blocks = view.dom.querySelectorAll(".bn-ai-block");
      const last = blocks.item(blocks.length - 1);
      if (last !== null) {
        return last.getBoundingClientRect();
      }
      const coords = view.coordsAtPos(view.state.selection.to);
      return new DOMRect(
        coords.left,
        coords.top,
        0,
        coords.bottom - coords.top,
      );
    },
  };
}

/**
 * The built-in AI popover: the instruction input while idle, then the status
 * with Stop, Accept and Discard. Uses the `bn-ai-*` classes.
 */
export function AiPopover({
  ai,
  className,
  floating,
}: AiPopoverProps): ReactNode {
  const messages = useMessages().ai;
  const onKeyDown = useCloseHandler(ai);
  return (
    <section
      {...floating}
      aria-label={messages.label}
      className={join("bn-ai-popover", className)}
      data-bn-ai-status={ai.status}
      onKeyDown={onKeyDown}
    >
      {ai.status === "idle" ? (
        <AiComposer
          ai={ai}
          closable={true}
          focus={true}
        />
      ) : (
        <AiStatusLine ai={ai} />
      )}
    </section>
  );
}

/** @internal Positions and renders the AI popover component. */
export function AiPopoverHost({
  ai,
  className,
  component: Component,
  tiptap,
}: {
  readonly ai: AiController;
  readonly className: string | undefined;
  readonly component: ComponentType<AiPopoverProps>;
  readonly tiptap: Editor;
}): ReactNode {
  const reference = useMemo(
    () => anchor(tiptap),
    [
      tiptap,
    ],
  );
  // Streamed text moves the anchor without scrolling or resizing.
  const floating = useFloating(reference, "bottom-start", tiptap);
  return (
    <Component
      ai={ai}
      className={className}
      floating={floating}
      reference={reference}
    />
  );
}
