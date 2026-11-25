import { Text } from "@react-pdf/renderer";
import { type Block, defineBlock } from "@useblocknotes/core";
import { PdfInline, usePdfRender } from "@useblocknotes/pdf";
import { BlockContent } from "@useblocknotes/react";
import type { ReactNode } from "react";
import * as z from "zod";

const noProps = z.object({});

/** Props of the text blocks: none, all data is inline content. */
export type TextProps = z.infer<typeof noProps>;

function TitlePdf({ block }: { readonly block: Block }): ReactNode {
  return (
    <Text
      style={{
        fontSize: 22,
        fontWeight: "bold",
        marginTop: 8,
      }}
    >
      <PdfInline content={block.content} />
    </Text>
  );
}

function SubtitlePdf({ block }: { readonly block: Block }): ReactNode {
  return (
    <Text
      style={{
        color: "#52525b",
        fontSize: 14,
      }}
    >
      <PdfInline content={block.content} />
    </Text>
  );
}

function ParagraphPdf({ block }: { readonly block: Block }): ReactNode {
  const { styles } = usePdfRender();
  return (
    <Text style={styles.paragraph}>
      <PdfInline content={block.content} />
    </Text>
  );
}

/**
 * A section title. Its type is `headline` because `title` is reserved for the
 * document title.
 */
export const titleBlock = defineBlock<"headline", TextProps, ReactNode>({
  content: "inline",
  render: () => (
    <BlockContent
      as="h1"
      className="sb-title"
    />
  ),
  schema: noProps,
  slash: [
    {
      defaultProps: {},
      icon: "H",
      keywords: [
        "title",
        "headline",
      ],
      label: "Title",
    },
  ],
  toMarkdown: (block, context) => `# ${context.markdown(block.content)}`,
  toPdf: (block) => <TitlePdf block={block} />,
  toText: (block, context) => context.text(block.content),
  type: "headline",
});

/** A muted line under a title. */
export const subtitleBlock = defineBlock<"subtitle", TextProps, ReactNode>({
  content: "inline",
  render: () => (
    <BlockContent
      as="p"
      className="sb-subtitle"
    />
  ),
  schema: noProps,
  slash: [
    {
      defaultProps: {},
      icon: "S",
      keywords: [
        "subtitle",
        "subheading",
      ],
      label: "Subtitle",
    },
  ],
  toMarkdown: (block, context) => `_${context.markdown(block.content)}_`,
  toPdf: (block) => <SubtitlePdf block={block} />,
  toText: (block, context) => context.text(block.content),
  type: "subtitle",
});

/** A paragraph of rich text. Replaces the built-in one in the playground. */
export const paragraphBlock = defineBlock<"paragraph", TextProps, ReactNode>({
  content: "inline",
  render: () => <BlockContent as="p" />,
  schema: noProps,
  slash: [
    {
      defaultProps: {},
      icon: "T",
      keywords: [
        "paragraph",
        "text",
      ],
      label: "Paragraph",
    },
  ],
  toMarkdown: (block, context) => context.markdown(block.content),
  toPdf: (block) => <ParagraphPdf block={block} />,
  toText: (block, context) => context.text(block.content),
  type: "paragraph",
});
