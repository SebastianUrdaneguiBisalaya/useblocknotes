import type {
  AiPopoverProps,
  AskAiButtonProps,
  BlockNotesComponents,
  SlashMenuProps,
} from "@useblocknotes/react";
import { type ReactNode, useState } from "react";

/** A slash menu with the query as a header and one card per entry. */
function CardSlashMenu({
  floating,
  highlight,
  items,
  query,
  select,
  selectedIndex,
}: SlashMenuProps): ReactNode {
  return (
    <div
      {...floating}
      className="sb-custom-menu"
    >
      <p className="sb-custom-menu-header">
        {query === "" ? "Insert a block" : `Results for “${query}”`}
      </p>
      {items.length === 0 ? <p>Nothing found</p> : null}
      <div
        className="sb-custom-menu-grid"
        role="listbox"
      >
        {items.map((item, index) => (
          <button
            aria-selected={index === selectedIndex}
            className="sb-custom-menu-item"
            data-active={index === selectedIndex ? "" : undefined}
            key={item.key}
            onMouseDown={(event) => {
              // Keep the editor focused.
              event.preventDefault();
              select(index);
            }}
            onMouseEnter={() => highlight(index)}
            role="option"
            type="button"
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A one-line AI prompt with its own buttons. */
function MinimalAiPopover({ ai, floating }: AiPopoverProps): ReactNode {
  const [instruction, setInstruction] = useState("");
  const running = ai.status === "loading" || ai.status === "streaming";
  return (
    <div
      {...floating}
      className="sb-custom-ai"
    >
      {ai.status === "idle" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (instruction.trim() !== "") {
              ai.start(instruction);
            }
          }}
        >
          <input
            aria-label="Instruction"
            // biome-ignore lint/a11y/noAutofocus: the prompt opens on request.
            autoFocus={true}
            onChange={(event) => setInstruction(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                ai.reject();
              }
            }}
            placeholder="✨ What should the AI write?"
            value={instruction}
          />
        </form>
      ) : (
        <div className="sb-block-actions">
          <span>{running ? "✨ Writing…" : `✨ ${ai.status}`}</span>
          {running ? (
            <button
              onClick={ai.cancel}
              type="button"
            >
              Stop
            </button>
          ) : (
            <>
              <button
                disabled={!ai.hasChanges}
                onClick={ai.accept}
                type="button"
              >
                Keep
              </button>
              <button
                onClick={ai.reject}
                type="button"
              >
                Undo
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** A round icon button instead of the "Ask AI" text button. */
function SparkleButton({ ai, floating }: AskAiButtonProps): ReactNode {
  return (
    <button
      {...floating}
      aria-label="Ask AI"
      className="sb-custom-ask"
      onClick={ai.ask}
      onMouseDown={(event) => event.preventDefault()}
      type="button"
    >
      ✨
    </button>
  );
}

/** Custom components for every replaceable part of the editor UI. */
export const customComponents: BlockNotesComponents = {
  aiPopover: MinimalAiPopover,
  askAiButton: SparkleButton,
  slashMenu: CardSlashMenu,
};
