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
  })),
  toMarkdown: (block, context) =>
    `${"#".repeat(block.props.level)} ${context.markdown(block.content)}`,
  toText: (block, context) => context.text(block.content),
  type: "heading",
});

/** The built-in blocks: paragraph and headings. */
export const defaultBlocks = [
  paragraphBlock,
  headingBlock,
] as const;
