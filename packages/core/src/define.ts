import type { $ZodType } from "zod/v4/core";
import type {
  Block,
  BlockProps,
  InlineElementNode,
  InlineNode,
} from "./document.js";
import type { BlockMessageKey } from "./i18n.js";

/**
 * What a block holds besides its props:
 * - `"inline"`: rich inline content (text, marks and inline elements);
 * - `"text"`: plain text only, no marks or inline elements (for example code);
 * - `"none"`: nothing, all data lives in props (for example a table or a chart).
 */
export type BlockContent = "inline" | "text" | "none";

/** Converts inline content to text or Markdown, using the registered inline elements. */
export interface TextContext {
  /** Plain text of inline content. */
  text(content: readonly InlineNode[] | undefined): string;
  /** Markdown of inline content. */
  markdown(content: readonly InlineNode[] | undefined): string;
}

/** An entry of the slash menu that inserts a block. */
export interface SlashMenuEntry<TProps extends BlockProps, TNode = null> {
  /** Text shown in the menu. */
  readonly label: string;
  /**
   * Key in `messages.blocks` that localizes `label`. Used by the built-in
   * blocks; custom blocks pass an already localized `label`.
   */
  readonly messageKey?: BlockMessageKey;
  /** Icon shown next to the label (for example a React element). */
  readonly icon?: TNode;
  /** Extra words that match this entry when filtering. */
  readonly keywords?: readonly string[];
  /** Props of the inserted block. */
  readonly defaultProps: TProps;
}

/** Props passed to a block's `render`. */
export interface BlockRenderProps<
  TType extends string = string,
  TProps extends BlockProps = BlockProps,
> {
  readonly block: Block<TType, TProps>;
  /** `false` in read-only mode. */
  readonly editable: boolean;
  /** Replaces the block's props. */
  updateProps(props: TProps): void;
}

/**
 * A block type. Create it with `defineBlock()`.
 *
 * `TNode` is the output type of `render`, `toPdf` and slash icons (for example
 * a React node); core never renders it.
 */
export interface BlockDefinition<
  TType extends string = string,
  TProps extends BlockProps = BlockProps,
  TNode = null,
> {
  /** Unique block type, stored in `block.type`. */
  readonly type: TType;
  /** Zod schema (classic or mini) that validates the block's props. */
  readonly schema: $ZodType<TProps>;
  /** Whether the block holds inline content. */
  readonly content: BlockContent;
  /** Plain text of the block, used for AI context and PDF fallback. */
  toText(block: Block<TType, TProps>, context: TextContext): string;
  /** Markdown of the block, used for AI context. Defaults to `toText`. */
  toMarkdown?(block: Block<TType, TProps>, context: TextContext): string;
  /** Renders the block (editable and read-only). */
  render?(props: BlockRenderProps<TType, TProps>): TNode;
  /** Renders the block for PDF export. Falls back to `toText` as a paragraph. */
  toPdf?(block: Block<TType, TProps>, context: TextContext): TNode;
  /** Slash menu entries that insert this block. */
  readonly slash?: readonly SlashMenuEntry<TProps, TNode>[];
}

/**
 * A custom inline element type (for example a citation). Create it with
 * `defineInline()`.
 */
export interface InlineDefinition<
  TType extends string = string,
  TProps extends BlockProps = BlockProps,
  TNode = null,
> {
  /** Unique inline type, stored in `node.type`. Cannot be `"text"`. */
  readonly type: TType;
  /** Zod schema (classic or mini) that validates the element's props. */
  readonly schema: $ZodType<TProps>;
  /** Plain text of the element. */
  toText(node: InlineElementNode<TType, TProps>): string;
  /** Markdown of the element. Defaults to `toText`. */
  toMarkdown?(node: InlineElementNode<TType, TProps>): string;
  /** Renders the element. */
  render?(props: { readonly node: InlineElementNode<TType, TProps> }): TNode;
  /** Renders the element for PDF export. Falls back to `toText`. */
  toPdf?(node: InlineElementNode<TType, TProps>): TNode;
}

/**
 * Defines a block type with its props schema, text conversion, rendering and
 * slash menu entries.
 *
 * @example
 * ```ts
 * const callout = defineBlock({
 *   type: "callout",
 *   schema: z.object({ tone: z.enum(["info", "warning"]) }),
 *   content: "inline",
 *   toText: (block, ctx) => ctx.text(block.content),
 * });
 * ```
 */
export function defineBlock<
  const TType extends string,
  TProps extends BlockProps,
  TNode = null,
>(
  definition: BlockDefinition<TType, TProps, TNode>,
): BlockDefinition<TType, TProps, TNode> {
  return definition;
}

/**
 * Defines a custom inline element type (for example a citation).
 *
 * @example
 * ```ts
 * const citation = defineInline({
 *   type: "citation",
 *   schema: z.object({ source: z.string() }),
 *   toText: (node) => `[${node.props.source}]`,
 * });
 * ```
 */
export function defineInline<
  const TType extends string,
  TProps extends BlockProps,
  TNode = null,
>(
  definition: InlineDefinition<TType, TProps, TNode>,
): InlineDefinition<TType, TProps, TNode> {
  return definition;
}
