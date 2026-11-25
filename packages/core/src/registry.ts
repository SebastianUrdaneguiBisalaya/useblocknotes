import type {
  BlockDefinition,
  InlineDefinition,
  TextContext,
} from "./define.js";
import type { BlockProps, InlineNode, Mark, TextNode } from "./document.js";

/** Code of a {@link RegistryError}. */
export type RegistryErrorCode =
  | "duplicate_block_type"
  | "duplicate_inline_type"
  | "reserved_block_type"
  | "reserved_inline_type";

/**
 * Names used by the document itself and by text marks. Block and inline types
 * cannot use them, because editors keep blocks, inline elements and marks in
 * one namespace.
 */
export const RESERVED_TYPES: ReadonlySet<string> = new Set([
  "doc",
  "text",
  "title",
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
]);

/** Thrown by `createRegistry()` when the block or inline definitions are invalid. */
export class RegistryError extends Error {
  /** What is wrong with the definitions. */
  readonly code: RegistryErrorCode;
  /** The offending block or inline type. */
  readonly type: string;

  constructor(code: RegistryErrorCode, type: string) {
    super(`${code}: "${type}"`);
    this.name = "RegistryError";
    this.code = code;
    this.type = type;
  }
}

/** Options of `createRegistry()`. */
export interface RegistryOptions<TNode = null> {
  /** Block types. Use `defaultBlocks` to include paragraph and headings. */
  readonly blocks: readonly BlockDefinition<string, BlockProps, TNode>[];
  /** Custom inline element types. */
  readonly inlines?: readonly InlineDefinition<string, BlockProps, TNode>[];
}

/** Registered block and inline types, looked up by type. */
export interface BlockRegistry<TNode = null> {
  readonly blocks: ReadonlyMap<
    string,
    BlockDefinition<string, BlockProps, TNode>
  >;
  readonly inlines: ReadonlyMap<
    string,
    InlineDefinition<string, BlockProps, TNode>
  >;
  /** Converts inline content to text or Markdown with the registered inline types. */
  readonly text: TextContext;
}

function isText(node: InlineNode): node is TextNode {
  return node.type === "text" && "text" in node;
}

const MARKDOWN_SPECIAL = /[\\`*_~[\]]/g;

function wrap(text: string, mark: Mark): string {
  switch (mark.type) {
    case "bold":
      return `**${text}**`;
    case "italic":
      return `_${text}_`;
    case "strike":
      return `~~${text}~~`;
    case "code":
      return `\`${text}\``;
    case "link":
      return `[${text}](${mark.href})`;
    case "underline":
      return text;
  }
}

/** Fixed order so nesting is stable: code innermost, link outermost. */
const MARK_ORDER: readonly Mark["type"][] = [
  "code",
  "underline",
  "strike",
  "italic",
  "bold",
  "link",
];

function textToMarkdown(node: TextNode): string {
  const marks = node.marks ?? [];
  const isCode = marks.some((mark) => mark.type === "code");
  let out = isCode ? node.text : node.text.replace(MARKDOWN_SPECIAL, "\\$&");
  for (const type of MARK_ORDER) {
    const mark = marks.find((m) => m.type === type);
    if (mark !== undefined && out !== "") {
      out = wrap(out, mark);
    }
  }
  return out;
}

/**
 * Creates a registry from block and inline definitions.
 *
 * @throws {RegistryError} If two definitions share a type, or a type is in {@link RESERVED_TYPES}.
 *
 * @example
 * ```ts
 * const registry = createRegistry({ blocks: [...defaultBlocks, callout] });
 * ```
 */
export function createRegistry<TNode = null>(
  options: RegistryOptions<TNode>,
): BlockRegistry<TNode> {
  const blocks = new Map<string, BlockDefinition<string, BlockProps, TNode>>();
  for (const block of options.blocks) {
    if (RESERVED_TYPES.has(block.type)) {
      throw new RegistryError("reserved_block_type", block.type);
    }
    if (blocks.has(block.type)) {
      throw new RegistryError("duplicate_block_type", block.type);
    }
    blocks.set(block.type, block);
  }

  const inlines = new Map<
    string,
    InlineDefinition<string, BlockProps, TNode>
  >();
  for (const inline of options.inlines ?? []) {
    if (RESERVED_TYPES.has(inline.type)) {
      throw new RegistryError("reserved_inline_type", inline.type);
    }
    if (inlines.has(inline.type) || blocks.has(inline.type)) {
      throw new RegistryError("duplicate_inline_type", inline.type);
    }
    inlines.set(inline.type, inline);
  }

  const text: TextContext = {
    markdown(content) {
      return (content ?? [])
        .map((node) => {
          if (isText(node)) {
            return textToMarkdown(node);
          }
          const inline = inlines.get(node.type);
          return (inline?.toMarkdown ?? inline?.toText)?.(node) ?? "";
        })
        .join("");
    },
    text(content) {
      return (content ?? [])
        .map((node) =>
          isText(node)
            ? node.text
            : (inlines.get(node.type)?.toText(node) ?? ""),
        )
        .join("");
    },
  };

  return {
    blocks,
    inlines,
    text,
  };
}
