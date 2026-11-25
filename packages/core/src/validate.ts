import * as z from "zod/mini";
import { type $ZodIssue, safeParse } from "zod/v4/core";
import type {
  Block,
  BlockNotesDocument,
  BlockProps,
  InlineNode,
  JsonValue,
} from "./document.js";
import type { BlockRegistry } from "./registry.js";
import type { Result } from "./result.js";

/** Location of a value inside the document, e.g. `["blocks", 0, "props", "level"]`. */
export type ValidationPath = readonly (string | number)[];

/** A problem found while validating a document or a block. */
export type ValidationIssue =
  | {
      /** The value does not have the document, block or inline shape. */
      readonly code: "invalid_structure";
      readonly path: ValidationPath;
      readonly message: string;
    }
  | {
      readonly code: "duplicate_block_id";
      readonly path: ValidationPath;
      readonly blockId: string;
    }
  | {
      readonly code: "unknown_block_type" | "unexpected_content";
      readonly path: ValidationPath;
      readonly blockId: string;
      readonly type: string;
    }
  | {
      readonly code: "invalid_block_props";
      readonly path: ValidationPath;
      readonly blockId: string;
      readonly type: string;
      readonly message: string;
    }
  | {
      readonly code: "unknown_inline_type";
      readonly path: ValidationPath;
      readonly blockId: string;
      readonly type: string;
    }
  | {
      readonly code: "invalid_inline_props";
      readonly path: ValidationPath;
      readonly blockId: string;
      readonly type: string;
      readonly message: string;
    };

const jsonSchema: z.ZodMiniType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);

const propsSchema = z.record(z.string(), jsonSchema);

const markSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum([
      "bold",
      "italic",
      "underline",
      "strike",
      "code",
    ]),
  }),
  z.object({
    href: z.string(),
    type: z.literal("link"),
  }),
]);

const inlineSchema = z.union([
  z.object({
    marks: z.exactOptional(z.array(markSchema)),
    text: z.string(),
    type: z.literal("text"),
  }),
  z.object({
    props: propsSchema,
    type: z.string().check(z.minLength(1)),
  }),
]);

const blockSchema = z.object({
  content: z.exactOptional(z.array(inlineSchema)),
  id: z.string().check(z.minLength(1)),
  props: propsSchema,
  type: z.string().check(z.minLength(1)),
});

const documentSchema = z.object({
  blocks: z.array(blockSchema),
  title: z.string(),
});

function toPath(path: readonly PropertyKey[]): (string | number)[] {
  return path.map((key) => (typeof key === "symbol" ? String(key) : key));
}

function structureIssues(
  issues: readonly $ZodIssue[],
  base: ValidationPath,
): ValidationIssue[] {
  return issues.map((issue) => ({
    code: "invalid_structure",
    message: issue.message,
    path: [
      ...base,
      ...toPath(issue.path),
    ],
  }));
}

/**
 * Validates one block's type, props and inline content against the registry.
 * Returns the block with parsed props (schema defaults and transforms applied).
 *
 * @internal Shared by `validateDocument()` and operations.
 */
export function checkBlock<TNode>(
  block: Block,
  registry: BlockRegistry<TNode>,
  path: ValidationPath,
): Result<Block, readonly ValidationIssue[]> {
  const definition = registry.blocks.get(block.type);
  if (definition === undefined) {
    return {
      error: [
        {
          blockId: block.id,
          code: "unknown_block_type",
          path: [
            ...path,
            "type",
          ],
          type: block.type,
        },
      ],
      ok: false,
    };
  }

  const issues: ValidationIssue[] = [];
  const props = safeParse(definition.schema, block.props);
  if (!props.success) {
    for (const issue of props.error.issues) {
      issues.push({
        blockId: block.id,
        code: "invalid_block_props",
        message: issue.message,
        path: [
          ...path,
          "props",
          ...toPath(issue.path),
        ],
        type: block.type,
      });
    }
  }

  const content: InlineNode[] = [];
  if (definition.content === "none") {
    if (block.content !== undefined && block.content.length > 0) {
      issues.push({
        blockId: block.id,
        code: "unexpected_content",
        path: [
          ...path,
          "content",
        ],
        type: block.type,
      });
    }
  } else {
    for (const [index, node] of (block.content ?? []).entries()) {
      if (node.type === "text" && "text" in node) {
        content.push(node);
        continue;
      }
      const nodePath = [
        ...path,
        "content",
        index,
      ];
      const inline = registry.inlines.get(node.type);
      if (inline === undefined || !("props" in node)) {
        issues.push({
          blockId: block.id,
          code: "unknown_inline_type",
          path: [
            ...nodePath,
            "type",
          ],
          type: node.type,
        });
        continue;
      }
      const inlineProps = safeParse(inline.schema, node.props);
      if (!inlineProps.success) {
        for (const issue of inlineProps.error.issues) {
          issues.push({
            blockId: block.id,
            code: "invalid_inline_props",
            message: issue.message,
            path: [
              ...nodePath,
              "props",
              ...toPath(issue.path),
            ],
            type: node.type,
          });
        }
        continue;
      }
      content.push({
        props: inlineProps.data,
        type: node.type,
      });
    }
  }

  if (issues.length > 0 || !props.success) {
    return {
      error: issues,
      ok: false,
    };
  }
  const parsed: BlockProps = props.data;
  return {
    ok: true,
    value:
      definition.content === "inline"
        ? {
            content,
            id: block.id,
            props: parsed,
            type: block.type,
          }
        : {
            id: block.id,
            props: parsed,
            type: block.type,
          },
  };
}

/**
 * Validates a document against the registered block and inline schemas.
 *
 * Checks the document shape, unique block ids, known block and inline types,
 * props, and that only `content: "inline"` blocks hold inline content.
 * On success, returns the document with parsed props.
 *
 * @example
 * ```ts
 * const result = validateDocument(JSON.parse(raw), registry);
 * if (!result.ok) console.error(result.error);
 * ```
 */
export function validateDocument<TNode>(
  input: JsonValue | BlockNotesDocument,
  registry: BlockRegistry<TNode>,
): Result<BlockNotesDocument, readonly ValidationIssue[]> {
  const parsed = safeParse(documentSchema, input);
  if (!parsed.success) {
    return {
      error: structureIssues(parsed.error.issues, []),
      ok: false,
    };
  }

  const issues: ValidationIssue[] = [];
  const blocks: Block[] = [];
  const ids = new Set<string>();
  for (const [index, block] of parsed.data.blocks.entries()) {
    const path = [
      "blocks",
      index,
    ];
    if (ids.has(block.id)) {
      issues.push({
        blockId: block.id,
        code: "duplicate_block_id",
        path: [
          ...path,
          "id",
        ],
      });
    }
    ids.add(block.id);
    const result = checkBlock(block, registry, path);
    if (result.ok) {
      blocks.push(result.value);
    } else {
      issues.push(...result.error);
    }
  }

  if (issues.length > 0) {
    return {
      error: issues,
      ok: false,
    };
  }
  return {
    ok: true,
    value: {
      blocks,
      title: parsed.data.title,
    },
  };
}
