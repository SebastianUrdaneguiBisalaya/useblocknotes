import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  type VirtualElement,
} from "@floating-ui/dom";
import type { Editor } from "@tiptap/core";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import {
  AiComposer,
  AiStatusLine,
  escapeHandler,
  join,
} from "./ai-controls.js";
import { useMessages } from "./messages.js";
import type { AiController } from "./use-ai.js";

/** Props of the AI popover. */
export interface AiPopoverProps {
  readonly ai: AiController;
  readonly tiptap: Editor | null;
  /** Class of the popover (`.bn-ai-popover`). */
  readonly className?: string | undefined;
}

/**
 * Anchors below the last AI block while a batch is pending, else below the
 * cursor.
 */
function anchor(tiptap: Editor): VirtualElement {
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
      return {
        bottom: coords.bottom,
        height: coords.bottom - coords.top,
        left: coords.left,
        right: coords.left,
        top: coords.top,
        width: 0,
        x: coords.left,
        y: coords.top,
      };
    },
  };
}

/** @internal The AI prompt in a popover next to the cursor. */
export function AiPopover({
  ai,
  className,
  tiptap,
}: AiPopoverProps): ReactNode {
  const messages = useMessages().ai;
  const popoverRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (tiptap === null || popover === null) {
      return;
    }
    const reference = anchor(tiptap);
    const update = () => {
      void computePosition(reference, popover, {
        middleware: [
          offset(8),
          flip(),
          shift({
            padding: 8,
          }),
        ],
        placement: "bottom-start",
        strategy: "fixed",
      }).then(({ x, y }) => {
        popover.style.left = `${x}px`;
        popover.style.top = `${y}px`;
      });
    };
    const stop = autoUpdate(reference, popover, update);
    // Streamed text moves the anchor without scrolling or resizing.
    tiptap.on("transaction", update);
    return () => {
      stop();
      tiptap.off("transaction", update);
    };
  }, [
    tiptap,
  ]);

  return (
    <section
      aria-label={messages.label}
      className={join("bn-ai-popover", className)}
      data-bn-ai-status={ai.status}
      onKeyDown={escapeHandler(ai)}
      ref={popoverRef}
      style={{
        position: "fixed",
      }}
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
