import * as z from "zod/mini";
import { defineBlock } from "./define.js";
import type { BlockProps } from "./document.js";

/** A paragraph of inline text. Built in. */
export const paragraphBlock = defineBlock<"paragraph", BlockProps>({
  content: "inline",
  schema: z.object({}),
  slash: [
    {
      defaultProps: {},
      keywords: [
        "paragraph",
        "text",
        "p",
      ],
      label: "Text",
      messageKey: "paragraph",
    },
  ],
  toMarkdown: (block, context) => context.markdown(block.content),
  toText: (block, context) => context.text(block.content),
  type: "paragraph",
});

/** A heading of level 1, 2 or 3. Built in. */
export const headingBlock = defineBlock({
  content: "inline",
  schema: z.object({
    level: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
    ]),
  }),
  slash: (
    [
      1,
      2,
      3,
    ] as const
  ).map((level) => ({
    defaultProps: {
      level,
    },
    keywords: [
      "heading",
      "title",
      `h${level}`,
    ],
    label: `Heading ${level}`,
    messageKey: `heading${level}` as const,
  })),
  toMarkdown: (block, context) =>
    `${"#".repeat(block.props.level)} ${context.markdown(block.content)}`,
  toText: (block, context) => context.text(block.content),
  type: "heading",
});

/** Deepest list indent level. */
export const MAX_LIST_INDENT = 6;

const listProps = z.object({
  indent: z._default(z.int().check(z.gte(0), z.lte(MAX_LIST_INDENT)), 0),
});

/**
 * A bulleted list item. The document stays flat: nesting is the `indent` prop
 * (0 to {@link MAX_LIST_INDENT}). Built in.
 */
export const bulletListItemBlock = defineBlock({
  content: "inline",
  schema: listProps,
  slash: [
    {
      defaultProps: {
        indent: 0,
      },
      keywords: [
        "bullet",
        "list",
        "unordered",
        "ul",
      ],
      label: "Bulleted list",
      messageKey: "bulletListItem",
    },
  ],
  toMarkdown: (block, context) =>
    `${"  ".repeat(block.props.indent)}- ${context.markdown(block.content)}`,
  toText: (block, context) => context.text(block.content),
  type: "bulletListItem",
});

/**
 * A numbered list item. Consecutive items at the same indent are numbered
 * together. Nesting is the `indent` prop (0 to {@link MAX_LIST_INDENT}). Built in.
 */
export const numberedListItemBlock = defineBlock({
  content: "inline",
  schema: listProps,
  slash: [
    {
      defaultProps: {
        indent: 0,
      },
      keywords: [
        "numbered",
        "ordered",
        "list",
        "ol",
      ],
      label: "Numbered list",
      messageKey: "numberedListItem",
    },
  ],
  // Markdown renumbers `1.` items, so every item can use `1.`.
  toMarkdown: (block, context) =>
    `${"   ".repeat(block.props.indent)}1. ${context.markdown(block.content)}`,
  toText: (block, context) => context.text(block.content),
  type: "numberedListItem",
});

/** A quote. Built in. */
export const quoteBlock = defineBlock<"quote", BlockProps>({
  content: "inline",
  schema: z.object({}),
  slash: [
    {
      defaultProps: {},
      keywords: [
        "quote",
        "blockquote",
        "citation",
      ],
      label: "Quote",
      messageKey: "quote",
    },
  ],
  toMarkdown: (block, context) =>
    context
      .markdown(block.content)
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n"),
  toText: (block, context) => context.text(block.content),
  type: "quote",
});

/** A code block: plain text with an optional `language`. Built in. */
export const codeBlock = defineBlock({
  content: "text",
  schema: z.object({
    language: z._default(z.string(), ""),
  }),
  slash: [
    {
      defaultProps: {
        language: "",
      },
      keywords: [
        "code",
        "snippet",
        "pre",
      ],
      label: "Code",
      messageKey: "codeBlock",
    },
  ],
  toMarkdown: (block, context) => {
    const code = context.text(block.content);
    const longestRun = Math.max(
      0,
      ...(code.match(/`+/g) ?? []).map((run) => run.length),
    );
    const fence = "`".repeat(Math.max(3, longestRun + 1));
    return `${fence}${block.props.language}\n${code}\n${fence}`;
  },
  toText: (block, context) => context.text(block.content),
  type: "codeBlock",
});

/** The built-in blocks: paragraph, headings, lists, quote and code. */
export const defaultBlocks = [
  paragraphBlock,
  headingBlock,
  bulletListItemBlock,
  numberedListItemBlock,
  quoteBlock,
  codeBlock,
] as const;
