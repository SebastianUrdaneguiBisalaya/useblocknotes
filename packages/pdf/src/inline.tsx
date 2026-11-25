import { Link, Text } from "@react-pdf/renderer";
import type { InlineNode, Mark, TextNode } from "@useblocknotes/core";
import type { ReactNode } from "react";
import { type PdfStyle, type PdfStyles, usePdfRender } from "./context.js";

function isText(node: InlineNode): node is TextNode {
  return node.type === "text" && "text" in node;
}

/**
 * Text style of a mark, or `null` for links (rendered as `<Link>`) and
 * decorations (combined in {@link decoration}).
 */
function markStyle(mark: Mark, styles: PdfStyles): PdfStyle | null {
  switch (mark.type) {
    case "bold":
      return {
        fontWeight: "bold",
      };
    case "italic":
      return {
        fontStyle: "italic",
      };
    case "underline":
    case "strike":
      return null;
    case "code":
      return styles.inlineCode;
    case "link":
      return null;
  }
}

/** Underline and strike combined into one `textDecoration`. */
function decoration(marks: readonly Mark[]): PdfStyle | null {
  const underline = marks.some((mark) => mark.type === "underline");
  const strike = marks.some((mark) => mark.type === "strike");
  if (underline && strike) {
    return {
      textDecoration: "underline line-through",
    };
  }
  if (underline || strike) {
    return {
      textDecoration: underline ? "underline" : "line-through",
    };
  }
  return null;
}

function TextRun({
  node,
  styles,
}: {
  readonly node: TextNode;
  readonly styles: PdfStyles;
}): ReactNode {
  const marks = node.marks ?? [];
  const style = [
    ...marks.map((mark) => markStyle(mark, styles)),
    decoration(marks),
  ].flatMap((value) =>
    value === null
      ? []
      : [
          value,
        ],
  );
  const text = <Text style={style}>{node.text}</Text>;
  const link = marks.find((mark) => mark.type === "link");
  return link === undefined ? (
    text
  ) : (
    <Link
      src={link.href}
      style={styles.link}
    >
      {text}
    </Link>
  );
}

/** Props of {@link PdfInline}. */
export interface PdfInlineProps {
  /** Inline content of a block. */
  readonly content: readonly InlineNode[] | undefined;
}

/**
 * Renders inline content (text with marks and links, and inline elements)
 * as react-pdf nodes. Place it inside a `<Text>`. Inline elements use their
 * `toPdf`, falling back to `toText`.
 *
 * @example
 * ```tsx
 * toPdf: (block) => <Text><PdfInline content={block.content} /></Text>
 * ```
 */
export function PdfInline({ content }: PdfInlineProps): ReactNode {
  const { registry, styles } = usePdfRender();
  return (content ?? []).map((node, index) => {
    const key = `${index}`;
    if (isText(node)) {
      return (
        <TextRun
          key={key}
          node={node}
          styles={styles}
        />
      );
    }
    const inline = registry.inlines.get(node.type);
    if (inline === undefined) {
      return null;
    }
    return <Text key={key}>{inline.toPdf?.(node) ?? inline.toText(node)}</Text>;
  });
}
