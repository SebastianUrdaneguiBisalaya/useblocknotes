import { createContext, useContext } from "react";
import { type ResolvedShortcuts, resolveShortcuts } from "./shortcuts.js";

/** Per-block view state that renders can read. */
export interface BlockViewState {
  /** Number of a numbered list item, or `null` for other blocks. */
  readonly listNumber: number | null;
}

/** @internal Provided by each block node view. */
export const BlockViewContext = createContext<BlockViewState>({
  listNumber: null,
});

/**
 * Reads view state of the block being rendered, such as its list number.
 * Use it inside a block's `render`.
 */
export function useBlockView(): BlockViewState {
  return useContext(BlockViewContext);
}

/** @internal Provided by `<BlockNotesEditor />` with the editor's shortcuts. */
export const ShortcutsContext = createContext<ResolvedShortcuts>(
  resolveShortcuts(),
);
