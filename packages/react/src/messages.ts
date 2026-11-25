import { enMessages, type Messages } from "@useblocknotes/core";
import { createContext, useContext } from "react";

/** @internal Provided by `<BlockNotesEditor />` with the resolved messages. */
export const MessagesContext = createContext<Messages>(enMessages);

/**
 * Reads the editor's resolved UI messages (from `locale` and `messages`).
 * Use it in custom block renders to localize their texts.
 */
export function useMessages(): Messages {
  return useContext(MessagesContext);
}
