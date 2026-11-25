import { type ReactNode, useEffect, useRef } from "react";
import {
  AiComposer,
  AiStatusLine,
  escapeHandler,
  join,
} from "./ai-controls.js";
import type { AiController, AiHistoryEntry, AiMessages } from "./use-ai.js";

/** Props of the AI chat bar. */
export interface AiChatBarProps {
  readonly ai: AiController;
  /** Class of the chat bar (`.bn-ai-chat`). */
  readonly className?: string | undefined;
}

/** Failed requests keep showing the error; others show what the user did. */
function entryStatus(entry: AiHistoryEntry, messages: AiMessages): string {
  return entry.result === null || entry.status === "error"
    ? messages[entry.status]
    : messages[entry.result];
}

function HistoryEntry({
  entry,
  messages,
}: {
  readonly entry: AiHistoryEntry;
  readonly messages: AiMessages;
}): ReactNode {
  return (
    <li
      className="bn-ai-message"
      data-bn-ai-result={entry.result ?? undefined}
      data-bn-ai-status={entry.status}
    >
      {entry.selection === null ? null : (
        <p className="bn-ai-message-selection">
          {messages.selection}: {entry.selection.text}
        </p>
      )}
      <p className="bn-ai-message-text">{entry.instruction}</p>
      <p className="bn-ai-message-status">{entryStatus(entry, messages)}</p>
    </li>
  );
}

/**
 * @internal The AI prompt as a chat bar fixed at the bottom of the editor,
 * with the history of requests above the input.
 */
export function AiChatBar({ ai, className }: AiChatBarProps): ReactNode {
  const { history, messages } = ai;
  const historyRef = useRef<HTMLOListElement>(null);
  const last = history.at(-1);

  // Keep the latest request in view.
  useEffect(() => {
    const list = historyRef.current;
    if (last !== undefined && list !== null) {
      list.scrollTop = list.scrollHeight;
    }
  }, [
    last,
  ]);

  return (
    <section
      aria-label={messages.label}
      className={join("bn-ai-chat", className)}
      data-bn-ai-status={ai.status}
      onKeyDown={escapeHandler(ai)}
    >
      {history.length === 0 ? null : (
        <ol
          aria-label={messages.history}
          className="bn-ai-history"
          ref={historyRef}
        >
          {history.map((entry) => (
            <HistoryEntry
              entry={entry}
              key={entry.id}
              messages={messages}
            />
          ))}
        </ol>
      )}
      {ai.status === "idle" ? null : <AiStatusLine ai={ai} />}
      {ai.open && ai.status === "idle" && ai.selection !== null ? (
        <p className="bn-ai-selection">
          {messages.selection}: {ai.selection.text}
        </p>
      ) : null}
      <AiComposer
        ai={ai}
        closable={false}
        focus={ai.open && ai.status === "idle"}
      />
    </section>
  );
}
