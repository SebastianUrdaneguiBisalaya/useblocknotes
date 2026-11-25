import type { Styles } from "@react-pdf/renderer";
import type {
  BlockProps,
  BlockRegistry,
  InlineDefinition,
} from "@useblocknotes/core";
import { createContext, type ReactNode, useContext } from "react";

/** A react-pdf style object. */
export type PdfStyle = Styles[string];

/** Styles of the exported PDF. Every key can be overridden in `exportPdf()`. */
export interface PdfStyles {
  /** Each page: size-independent padding and base font. */
  readonly page: PdfStyle;
  /** Document title. */
  readonly title: PdfStyle;
  /** Wrapper of every block. */
  readonly block: PdfStyle;
  readonly paragraph: PdfStyle;
  readonly heading1: PdfStyle;
  readonly heading2: PdfStyle;
  readonly heading3: PdfStyle;
  /** Row of a list item: marker and text. */
  readonly listItem: PdfStyle;
  /** Bullet or number of a list item. */
  readonly listMarker: PdfStyle;
  readonly quote: PdfStyle;
  readonly code: PdfStyle;
  /** Inline `code` marks. */
  readonly inlineCode: PdfStyle;
  readonly link: PdfStyle;
}

/** What block PDF renders can read while the document is exported. */
export interface PdfRenderState {
  /** Registered blocks and inline elements of the export. */
  readonly registry: BlockRegistry<ReactNode>;
  /** Resolved styles. */
  readonly styles: PdfStyles;
}

/** @internal Provided by the exported document. */
export const PdfRenderContext = createContext<PdfRenderState | null>(null);

/** Per-block state, such as the number of a numbered list item. */
export interface PdfBlockState {
  /** Number of a numbered list item, or `null` for other blocks. */
  readonly listNumber: number | null;
}

/** @internal Provided around each block. */
export const PdfBlockContext = createContext<PdfBlockState>({
  listNumber: null,
});

/**
 * Reads the registry and styles of the running export. Use it inside
 * components returned by a block's `toPdf`.
 *
 * @throws {Error} Outside a document built by `exportPdf()` or `documentToPdf()`.
 */
export function usePdfRender(): PdfRenderState {
  const state = useContext(PdfRenderContext);
  if (state === null) {
    throw new Error("usePdfRender() must be used inside documentToPdf()");
  }
  return state;
}

/** Reads per-block state, such as the list number. */
export function usePdfBlock(): PdfBlockState {
  return useContext(PdfBlockContext);
}

/** An inline element definition whose `toPdf` returns react-pdf nodes. */
export type PdfInlineDefinition = InlineDefinition<
  string,
  BlockProps,
  ReactNode
>;
