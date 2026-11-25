import { NodeViewContent } from "@tiptap/react";
import {
  type BlockRenderProps,
  bulletListItemBlock,
  codeBlock,
  headingBlock,
  numberedListItemBlock,
  paragraphBlock,
  quoteBlock,
} from "@useblocknotes/core";
import type { CSSProperties, ReactNode } from "react";
import { useBlockView } from "./context.js";
import type { ReactBlockDefinition } from "./types.js";

/** Element that wraps a block's editable inline content. */
export type BlockContentTag =
  | "div"
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "code"
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

function indentStyle(props: BlockRenderProps): CSSProperties {
  const indent = props.block.props["indent"];
  return {
    "--bn-indent": typeof indent === "number" ? indent : 0,
  } as CSSProperties;
}

function BulletListItem(props: BlockRenderProps): ReactNode {
  return (
    <div
      className="bn-list-item"
      data-bn-indent={props.block.props["indent"]}
      style={indentStyle(props)}
    >
      <span
        aria-hidden="true"
        className="bn-list-marker"
        contentEditable={false}
      />
      <BlockContent />
    </div>
  );
}

function NumberedListItem(props: BlockRenderProps): ReactNode {
  const { listNumber } = useBlockView();
  return (
    <div
      className="bn-list-item"
      data-bn-indent={props.block.props["indent"]}
      style={indentStyle(props)}
    >
      <span
        aria-hidden="true"
        className="bn-list-marker"
        contentEditable={false}
      >
        {`${listNumber ?? 1}.`}
      </span>
      <BlockContent />
    </div>
  );
}

function CodeBlock({
  block,
  editable,
  updateProps,
}: BlockRenderProps): ReactNode {
  const language = block.props["language"];
  const value = typeof language === "string" ? language : "";
  return (
    <div className="bn-code">
      {editable ? (
        <input
          aria-label="Code language"
          className="bn-code-language"
          contentEditable={false}
          onChange={(event) =>
            updateProps({
              ...block.props,
              language: event.target.value,
            })
          }
          placeholder="Language"
          value={value}
        />
      ) : value === "" ? null : (
        <span className="bn-code-language">{value}</span>
      )}
      <pre data-language={value === "" ? undefined : value}>
        <BlockContent as="code" />
      </pre>
    </div>
  );
}

/** Core's bulleted list item. Nesting is shown with the `--bn-indent` variable. */
export const bulletListItem: ReactBlockDefinition = {
  ...bulletListItemBlock,
  render: BulletListItem,
};

/** Core's numbered list item, numbered by consecutive run and indent. */
export const numberedListItem: ReactBlockDefinition = {
  ...numberedListItemBlock,
  render: NumberedListItem,
};

/** Core's quote block, rendered as `<blockquote>`. */
export const quote: ReactBlockDefinition = {
  ...quoteBlock,
  render: () => <BlockContent as="blockquote" />,
};

/** Core's code block, rendered as `<pre><code>` with an editable language. */
export const code: ReactBlockDefinition = {
  ...codeBlock,
  render: CodeBlock,
};

/** The built-in blocks with React renders: paragraph, headings, lists, quote and code. */
export const defaultBlocks: readonly ReactBlockDefinition[] = [
  paragraph,
  heading,
  bulletListItem,
  numberedListItem,
  quote,
  code,
];
