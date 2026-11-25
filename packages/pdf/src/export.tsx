import {
  Document,
  type DocumentProps,
  Page,
  pdf,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  type Block,
  type BlockNotesDocument,
  type BlockRegistry,
  createRegistry,
  type Locale,
  type Result,
  resolveMessages,
  type ValidationIssue,
  validateDocument,
} from "@useblocknotes/core";
import type { ReactElement, ReactNode } from "react";
import {
  defaultPdfBlocks,
  defaultPdfStyles,
  type PdfBlockDefinition,
} from "./blocks.js";
import {
  PdfBlockContext,
  type PdfInlineDefinition,
  PdfRenderContext,
  type PdfStyle,
  type PdfStyles,
} from "./context.js";

/** Options of `exportPdf()` and `documentToPdf()`. */
export interface ExportPdfOptions {
  /**
   * Block types. Defaults to `defaultPdfBlocks` (the built-in blocks with PDF
   * renders). Blocks without `toPdf` are exported as a paragraph of their
   * `toText`.
   */
  readonly blocks?: readonly PdfBlockDefinition[];
  /** Custom inline element types. */
  readonly inlines?: readonly PdfInlineDefinition[];
  /**
   * Language of the PDF metadata and of the fallback title of an untitled
   * document. Defaults to `"en"`.
   */
  readonly locale?: Locale;
  /** Overrides of the default styles, merged per key. */
  readonly styles?: Partial<PdfStyles>;
}

/** Why `exportPdf()` failed. */
export type ExportPdfError =
  | {
      /** The document does not match the registered blocks. */
      readonly code: "invalid_document";
      readonly issues: readonly ValidationIssue[];
    }
  | {
      /** react-pdf failed to lay out or encode the document. */
      readonly code: "render_failed";
      readonly message: string;
    };

const LIST_TYPES: ReadonlySet<string> = new Set([
  "bulletListItem",
  "numberedListItem",
]);

/**
 * Numbers of numbered list items: consecutive items per indent level, reset
 * by a bulleted item at the same level or by any other block.
 *
 * @internal Exported for tests.
 */
export function listNumbers(
  blocks: readonly Block[],
): ReadonlyMap<string, number> {
  const numbers = new Map<string, number>();
  let counts: number[] = [];
  for (const block of blocks) {
    if (!LIST_TYPES.has(block.type)) {
      counts = [];
      continue;
    }
    const raw = block.props["indent"];
    const indent = typeof raw === "number" ? raw : 0;
    counts = counts.slice(0, indent + 1);
    while (counts.length <= indent) {
      counts.push(0);
    }
    if (block.type === "bulletListItem") {
      counts[indent] = 0;
      continue;
    }
    const next = (counts[indent] ?? 0) + 1;
    counts[indent] = next;
    numbers.set(block.id, next);
  }
  return numbers;
}

/**
 * The PDF node of one block: its `toPdf`, or a paragraph of its `toText`.
 *
 * @internal Exported for tests.
 */
export function blockToPdf(
  block: Block,
  registry: BlockRegistry<ReactNode>,
  styles: PdfStyles,
): ReactNode {
  const definition = registry.blocks.get(block.type);
  if (definition === undefined) {
    return null;
  }
  if (definition.toPdf !== undefined) {
    return definition.toPdf(block, registry.text);
  }
  return (
    <Text style={styles.paragraph}>
      {definition.toText(block, registry.text)}
    </Text>
  );
}

function resolveStyles(overrides: Partial<PdfStyles> = {}): PdfStyles {
  const merge = (key: keyof PdfStyles): PdfStyle => ({
    ...defaultPdfStyles[key],
    ...overrides[key],
  });
  return {
    block: merge("block"),
    code: merge("code"),
    heading1: merge("heading1"),
    heading2: merge("heading2"),
    heading3: merge("heading3"),
    inlineCode: merge("inlineCode"),
    link: merge("link"),
    listItem: merge("listItem"),
    listMarker: merge("listMarker"),
    page: merge("page"),
    paragraph: merge("paragraph"),
    quote: merge("quote"),
    title: merge("title"),
  };
}

function createPdfRegistry(
  options: ExportPdfOptions,
): BlockRegistry<ReactNode> {
  return createRegistry<ReactNode>({
    blocks: options.blocks ?? defaultPdfBlocks,
    inlines: options.inlines ?? [],
  });
}

function renderDocument(
  document: BlockNotesDocument,
  registry: BlockRegistry<ReactNode>,
  options: ExportPdfOptions,
): ReactElement<DocumentProps> {
  const styles = resolveStyles(options.styles);
  const locale = options.locale ?? "en";
  const title =
    document.title === ""
      ? resolveMessages(locale).placeholders.title
      : document.title;
  const numbers = listNumbers(document.blocks);
  return (
    <Document
      language={locale}
      title={title}
    >
      <PdfRenderContext
        value={{
          registry,
          styles,
        }}
      >
        <Page
          size="A4"
          style={styles.page}
        >
          <Text style={styles.title}>{title}</Text>
          {document.blocks.map((block) => (
            <PdfBlockContext
              key={block.id}
              value={{
                listNumber: numbers.get(block.id) ?? null,
              }}
            >
              <View
                style={styles.block}
                wrap={block.type !== "codeBlock"}
              >
                {blockToPdf(block, registry, styles)}
              </View>
            </PdfBlockContext>
          ))}
        </Page>
      </PdfRenderContext>
    </Document>
  );
}

/**
 * Builds the react-pdf element of a document without rendering it, for
 * example to show it in react-pdf's `<PDFViewer>`. Blocks of unregistered
 * types are skipped; use `exportPdf()` to validate first.
 *
 * @throws {RegistryError} If block or inline types are duplicated or reserved.
 */
export function documentToPdf(
  document: BlockNotesDocument,
  options: ExportPdfOptions = {},
): ReactElement<DocumentProps> {
  return renderDocument(document, createPdfRegistry(options), options);
}

/**
 * Exports a document to PDF, locally, in the browser or in Node. Each block
 * uses its `toPdf`; blocks without it become a paragraph of their `toText`.
 *
 * Returns a `Blob` (`application/pdf`): download it in the browser with
 * `URL.createObjectURL()`, or write `await blob.arrayBuffer()` to a file or
 * response in Node.
 *
 * @throws {RegistryError} If block or inline types are duplicated or reserved.
 *
 * @example
 * ```ts
 * const result = await exportPdf(editor.getDocument(), { locale: "es" });
 * if (result.ok) {
 *   const url = URL.createObjectURL(result.value);
 *   Object.assign(document.createElement("a"), { href: url, download: "notes.pdf" }).click();
 *   URL.revokeObjectURL(url);
 * }
 * ```
 */
export async function exportPdf(
  document: BlockNotesDocument,
  options: ExportPdfOptions = {},
): Promise<Result<Blob, ExportPdfError>> {
  const registry = createPdfRegistry(options);
  const validated = validateDocument(document, registry);
  if (!validated.ok) {
    return {
      error: {
        code: "invalid_document",
        issues: validated.error,
      },
      ok: false,
    };
  }
  try {
    const blob = await pdf(
      renderDocument(validated.value, registry, options),
    ).toBlob();
    return {
      ok: true,
      value: blob,
    };
  } catch (error) {
    return {
      error: {
        code: "render_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      ok: false,
    };
  }
}
