import { Text, View } from "@react-pdf/renderer";
import {
  type Block,
  type BlockDefinition,
  type BlockProps,
  bulletListItemBlock,
  codeBlock,
  headingBlock,
  numberedListItemBlock,
  paragraphBlock,
  quoteBlock,
} from "@useblocknotes/core";
import type { ReactNode } from "react";
import { type PdfStyles, usePdfBlock, usePdfRender } from "./context.js";
import { PdfInline } from "./inline.js";

/** A block definition whose `toPdf` returns react-pdf nodes. */
export type PdfBlockDefinition = BlockDefinition<string, BlockProps, ReactNode>;

/** Default styles of the exported PDF. */
export const defaultPdfStyles: PdfStyles = {
  block: {
    marginBottom: 6,
  },
  code: {
    backgroundColor: "#f4f4f5",
    borderRadius: 4,
    fontFamily: "Courier",
    fontSize: 10,
    padding: 8,
  },
  heading1: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 8,
  },
  heading2: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 6,
  },
  heading3: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 4,
  },
  inlineCode: {
    fontFamily: "Courier",
  },
  link: {
    color: "#2563eb",
  },
  listItem: {
    flexDirection: "row",
    gap: 6,
  },
  listMarker: {
    minWidth: 14,
    textAlign: "right",
  },
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.5,
    padding: 48,
  },
  paragraph: {},
  quote: {
    borderLeftColor: "#a1a1aa",
    borderLeftWidth: 3,
    paddingLeft: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 16,
  },
};

// Only characters of the built-in PDF fonts' encoding (WinAnsi): "◦" or "▪"
// would print as other glyphs unless a custom font is registered.
const BULLETS = [
  "•",
  "–",
  "·",
];

function indentOf(block: Block): number {
  const indent = block.props["indent"];
  return typeof indent === "number" ? indent : 0;
}

function Paragraph({ block }: { readonly block: Block }): ReactNode {
  const { styles } = usePdfRender();
  return (
    <Text style={styles.paragraph}>
      <PdfInline content={block.content} />
    </Text>
  );
}

function Heading({ block }: { readonly block: Block }): ReactNode {
  const { styles } = usePdfRender();
  const level = block.props["level"];
  const style =
    level === 2
      ? styles.heading2
      : level === 3
        ? styles.heading3
        : styles.heading1;
  return (
    <Text style={style}>
      <PdfInline content={block.content} />
    </Text>
  );
}

function ListItem({
  block,
  marker,
}: {
  readonly block: Block;
  readonly marker: string;
}): ReactNode {
  const { styles } = usePdfRender();
  return (
    <View
      style={[
        styles.listItem,
        {
          marginLeft: indentOf(block) * 16,
        },
      ]}
    >
      <Text style={styles.listMarker}>{marker}</Text>
      <Text style={styles.paragraph}>
        <PdfInline content={block.content} />
      </Text>
    </View>
  );
}

function BulletListItem({ block }: { readonly block: Block }): ReactNode {
  return (
    <ListItem
      block={block}
      marker={BULLETS[indentOf(block) % BULLETS.length] ?? "•"}
    />
  );
}

function NumberedListItem({ block }: { readonly block: Block }): ReactNode {
  const { listNumber } = usePdfBlock();
  return (
    <ListItem
      block={block}
      marker={`${listNumber ?? 1}.`}
    />
  );
}

function Quote({ block }: { readonly block: Block }): ReactNode {
  const { styles } = usePdfRender();
  return (
    <View style={styles.quote}>
      <Text>
        <PdfInline content={block.content} />
      </Text>
    </View>
  );
}

function Code({ block }: { readonly block: Block }): ReactNode {
  const { registry, styles } = usePdfRender();
  return (
    <View style={styles.code}>
      <Text>{registry.text.text(block.content)}</Text>
    </View>
  );
}

/** Core's paragraph with rich text. */
export const paragraphPdf: PdfBlockDefinition = {
  ...paragraphBlock,
  toPdf: (block) => <Paragraph block={block} />,
};

/** Core's heading, sized by level. */
export const headingPdf: PdfBlockDefinition = {
  ...headingBlock,
  toPdf: (block) => <Heading block={block} />,
};

/** Core's bulleted list item, indented by its `indent`. */
export const bulletListItemPdf: PdfBlockDefinition = {
  ...bulletListItemBlock,
  toPdf: (block) => <BulletListItem block={block} />,
};

/** Core's numbered list item, numbered by consecutive run and indent. */
export const numberedListItemPdf: PdfBlockDefinition = {
  ...numberedListItemBlock,
  toPdf: (block) => <NumberedListItem block={block} />,
};

/** Core's quote, with a left border. */
export const quotePdf: PdfBlockDefinition = {
  ...quoteBlock,
  toPdf: (block) => <Quote block={block} />,
};

/** Core's code block, in a monospace font. */
export const codePdf: PdfBlockDefinition = {
  ...codeBlock,
  toPdf: (block) => <Code block={block} />,
};

/** The built-in blocks with PDF renders. The default of `exportPdf()`. */
export const defaultPdfBlocks: readonly PdfBlockDefinition[] = [
  paragraphPdf,
  headingPdf,
  bulletListItemPdf,
  numberedListItemPdf,
  quotePdf,
  codePdf,
];
