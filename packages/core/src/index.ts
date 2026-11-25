export {
  defaultBlocks,
  headingBlock,
  paragraphBlock,
} from "./blocks.js";
export type {
  BlockContent,
  BlockDefinition,
  BlockRenderProps,
  InlineDefinition,
  SlashMenuEntry,
  TextContext,
} from "./define.js";
export { defineBlock, defineInline } from "./define.js";
export type {
  Block,
  BlockNotesDocument,
  BlockProps,
  InlineElementNode,
  InlineNode,
  JsonPrimitive,
  JsonValue,
  Mark,
  TextNode,
} from "./document.js";
export type {
  BlockRegistry,
  RegistryErrorCode,
  RegistryOptions,
} from "./registry.js";
export { createRegistry, RegistryError } from "./registry.js";
export type { Result } from "./result.js";
export type { ValidationIssue, ValidationPath } from "./validate.js";
export { validateDocument } from "./validate.js";
