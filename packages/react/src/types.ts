import type {
  BlockDefinition,
  BlockProps,
  InlineDefinition,
} from "@useblocknotes/core";
import type { ReactNode } from "react";

/** A block definition whose `render`, `toPdf` and slash icons return React nodes. */
export type ReactBlockDefinition = BlockDefinition<
  string,
  BlockProps,
  ReactNode
>;

/** An inline element definition whose `render` returns React nodes. */
export type ReactInlineDefinition = InlineDefinition<
  string,
  BlockProps,
  ReactNode
>;
