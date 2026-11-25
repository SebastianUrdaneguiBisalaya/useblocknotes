import { NodeViewContent } from "@tiptap/react";
import { headingBlock, paragraphBlock } from "@useblocknotes/core";
import type { ReactNode } from "react";
import type { ReactBlockDefinition } from "./types.js";

/** Element that wraps a block's editable inline content. */
export type BlockContentTag =
  | "div"
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "blockquote"
  | "pre";

/** Props of {@link BlockContent}. */
export interface BlockContentProps {
  /** Element to render. Defaults to `div`. */
  readonly as?: BlockContentTag;
  readonly className?: string;
}

/**
 * Where a block's editable inline content goes. Use it inside the `render` of
 * blocks defined with `content: "inline"`.
 *
 * @example
 * ```tsx
 * render: () => <div className="callout"><BlockContent as="p" /></div>
 * ```
 */
export function BlockContent({
  as = "div",
  className,
}: BlockContentProps): ReactNode {
  return (
    <NodeViewContent<BlockContentTag>
      as={as}
      className={
        className === undefined
          ? "bn-block-content"
          : `bn-block-content ${className}`
      }
    />
  );
}

/** Core's paragraph block, rendered as `<p>`. */
export const paragraph: ReactBlockDefinition = {
  ...paragraphBlock,
  render: () => <BlockContent as="p" />,
};

/** Core's heading block, rendered as `<h1>` to `<h3>` by level. */
export const heading: ReactBlockDefinition = {
  ...headingBlock,
  render: ({ block }) => {
    const level = block.props["level"];
    return <BlockContent as={level === 2 ? "h2" : level === 3 ? "h3" : "h1"} />;
  },
};

/** The built-in blocks with React renders: paragraph and headings. */
export const defaultBlocks: readonly ReactBlockDefinition[] = [
  paragraph,
  heading,
];
