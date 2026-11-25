import type { Block, BlockNotesDocument } from "./document.js";
import type { BlockRegistry } from "./registry.js";

/** Options of `outline()`. */
export interface OutlineOptions {
  /** Maximum characters of each block's line, before `…`. Defaults to 80. */
  readonly maxLineLength?: number;
}

/** Options of `pick()`. */
export interface PickOptions {
  /** Blocks to include before and after each picked block. Defaults to 0. */
  readonly neighbors?: number;
}

const DEFAULT_LINE_LENGTH = 80;

const LIST_TYPES: ReadonlySet<string> = new Set([
  "bulletListItem",
  "numberedListItem",
]);

function blockText<TNode>(
  block: Block,
  registry: BlockRegistry<TNode>,
): string {
  const definition = registry.blocks.get(block.type);
  return definition === undefined
    ? registry.text.text(block.content)
    : definition.toText(block, registry.text);
}

function blockMarkdown<TNode>(
  block: Block,
  registry: BlockRegistry<TNode>,
): string {
  const definition = registry.blocks.get(block.type);
  if (definition === undefined) {
    return registry.text.markdown(block.content);
  }
  return (definition.toMarkdown ?? definition.toText)(block, registry.text);
}

/** First line of `text`, with whitespace collapsed and cut at `max`. */
function line(text: string, max: number): string {
  const first = (text.split("\n", 1)[0] ?? "").replace(/\s+/g, " ").trim();
  const multiline = text.trim().includes("\n");
  if (first.length > max) {
    return `${first.slice(0, Math.max(0, max - 1))}…`;
  }
  return multiline ? `${first}…` : first;
}

function headingLevel(block: Block): number | null {
  const level = block.props["level"];
  return block.type === "heading" && typeof level === "number" ? level : null;
}

/**
 * A compact view of a document for AI context: the title, then one line per
 * block with its id. Headings show their level as `#` marks so sections are
 * visible; other blocks show their type and the start of their text.
 *
 * Pure: uses each block's `toText`.
 *
 * @example
 * ```ts
 * outline(document, registry);
 * // # Notes
 * // [b1] ## Goals
 * // [b2] paragraph: Ship the first version by…
 * ```
 */
export function outline<TNode>(
  document: BlockNotesDocument,
  registry: BlockRegistry<TNode>,
  options: OutlineOptions = {},
): string {
  const max = Math.max(1, options.maxLineLength ?? DEFAULT_LINE_LENGTH);
  const lines = document.blocks.map((block) => {
    const text = line(blockText(block, registry), max);
    const level = headingLevel(block);
    if (level !== null) {
      return `[${block.id}] ${"#".repeat(level + 1)} ${text}`;
    }
    return text === ""
      ? `[${block.id}] ${block.type}`
      : `[${block.id}] ${block.type}: ${text}`;
  });
  return [
    `# ${document.title}`,
    ...lines,
  ].join("\n");
}

/**
 * The blocks with the given ids, in document order, plus `neighbors` blocks
 * before and after each one. Unknown ids are ignored.
 *
 * Pure: returns the document's own block objects.
 *
 * @example
 * ```ts
 * toMarkdown(pick(document, selection.blockIds, { neighbors: 1 }), registry);
 * ```
 */
export function pick(
  document: BlockNotesDocument,
  blockIds: readonly string[],
  options: PickOptions = {},
): Block[] {
  const neighbors = Math.max(0, Math.floor(options.neighbors ?? 0));
  const wanted = new Set(blockIds);
  const keep = new Set<number>();
  for (const [index, block] of document.blocks.entries()) {
    if (wanted.has(block.id)) {
      for (let at = index - neighbors; at <= index + neighbors; at++) {
        keep.add(at);
      }
    }
  }
  return document.blocks.filter((_, index) => keep.has(index));
}

/**
 * Markdown of a document (with its title as `#`) or of a list of blocks.
 * Consecutive list items stay in one list and empty blocks are skipped. Uses
 * each block's `toMarkdown`, falling back to `toText`.
 *
 * Pure.
 *
 * @example
 * ```ts
 * const markdown = toMarkdown(document, registry);
 * ```
 */
export function toMarkdown<TNode>(
  input: BlockNotesDocument | readonly Block[],
  registry: BlockRegistry<TNode>,
): string {
  const isDocument = "blocks" in input;
  const blocks = isDocument ? input.blocks : input;
  const parts: string[] =
    isDocument && input.title !== ""
      ? [
          `# ${input.title}`,
        ]
      : [];
  let previous: Block | null = null;
  for (const block of blocks) {
    const markdown = blockMarkdown(block, registry);
    if (markdown === "") {
      continue;
    }
    const sameList =
      previous !== null &&
      LIST_TYPES.has(previous.type) &&
      LIST_TYPES.has(block.type);
    if (parts.length > 0) {
      parts.push(sameList ? "\n" : "\n\n");
    }
    parts.push(markdown);
    previous = block;
  }
  return parts.join("");
}
