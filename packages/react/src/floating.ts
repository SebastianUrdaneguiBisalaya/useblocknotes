import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  type Placement,
  shift,
} from "@floating-ui/dom";
import type { Editor } from "@tiptap/core";
import {
  type CSSProperties,
  type RefCallback,
  useLayoutEffect,
  useState,
} from "react";

/**
 * What a floating component is anchored to: a virtual element with the
 * position of the cursor, selection or AI block. Works as a reference for
 * Floating UI and as a `virtualRef` for Radix or similar libraries.
 */
export interface FloatingReference {
  /** Current position, in viewport coordinates. */
  getBoundingClientRect(): DOMRect;
  /** Element whose scroll containers move the reference (the editor). */
  readonly contextElement?: Element;
}

/**
 * Props that let the editor position a floating component like the built-in
 * one. Spread them on the root element, or ignore them and position it with
 * `reference` and your own library.
 *
 * @example
 * ```tsx
 * function MyMenu({ floating }: SlashMenuProps) {
 *   return <div {...floating} className="menu">…</div>;
 * }
 * ```
 */
export interface FloatingProps {
  readonly ref: RefCallback<HTMLElement>;
  readonly style: CSSProperties;
}

const FIXED: CSSProperties = {
  position: "fixed",
};

/**
 * @internal Positions the element given to `ref` next to `reference` while
 * both exist, and on every editor transaction when `editor` is given (for
 * anchors that move without scrolling or resizing, like streamed text).
 */
export function useFloating(
  reference: FloatingReference | null,
  placement: Placement,
  editor: Editor | null = null,
): FloatingProps {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (reference === null || element === null) {
      return;
    }
    const update = (): void => {
      void computePosition(reference, element, {
        middleware: [
          offset(8),
          flip(),
          shift({
            padding: 8,
          }),
        ],
        placement,
        strategy: "fixed",
      }).then(({ x, y }) => {
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
      });
    };
    const stop = autoUpdate(reference, element, update);
    editor?.on("transaction", update);
    return () => {
      stop();
      editor?.off("transaction", update);
    };
  }, [
    reference,
    element,
    placement,
    editor,
  ]);

  return {
    ref: setElement,
    style: FIXED,
  };
}
