import {
  bulletListItemPdf,
  codePdf,
  numberedListItemPdf,
  quotePdf,
} from "@useblocknotes/pdf";
import {
  bulletListItem,
  code,
  numberedListItem,
  quote,
  type ReactBlockDefinition,
} from "@useblocknotes/react";
import { chartBlock } from "./chart.js";
import { tableBlock } from "./table.js";
import { paragraphBlock, subtitleBlock, titleBlock } from "./text.js";

export { chartBlock } from "./chart.js";
export { tableBlock } from "./table.js";
export { paragraphBlock, subtitleBlock, titleBlock } from "./text.js";

/**
 * Every block of the playground, with editor and PDF renders. The five example
 * blocks plus the built-in lists, quote and code, each merging its PDF
 * definition (for `toPdf`) with its React one (for `render` and slash icons).
 */
export const playgroundBlocks: readonly ReactBlockDefinition[] = [
  titleBlock,
  subtitleBlock,
  paragraphBlock,
  tableBlock,
  chartBlock,
  {
    ...bulletListItemPdf,
    ...bulletListItem,
  },
  {
    ...numberedListItemPdf,
    ...numberedListItem,
  },
  {
    ...quotePdf,
    ...quote,
  },
  {
    ...codePdf,
    ...code,
  },
];
