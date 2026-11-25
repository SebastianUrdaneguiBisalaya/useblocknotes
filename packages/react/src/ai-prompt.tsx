import { type ReactNode, useEffect, useRef, useState } from "react";
import type { AiController } from "./use-ai.js";

/** Props of the AI prompt. */
export interface AiPromptProps {
  readonly ai: AiController;
  /** Class of the prompt element (`.bn-ai-prompt`). */
  readonly className?: string | undefined;
}

/**
 * @internal Minimal AI prompt: an instruction input, then the request status
 * with Stop, or Accept and Discard once the stream stops.
 *
 * Escape closes the empty prompt or stops a running stream.
 */
export function AiPrompt({ ai, className }: AiPromptProps): ReactNode {
  const [instruction, setInstruction] = useState("");
  const { messages, status } = ai;
  const running = status === "loading" || status === "streaming";
  const reviewing = !running && status !== "idle";
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);

  // Move focus to the controls that are shown for the current status.
  useEffect(() => {
    if (status === "idle") {
      inputRef.current?.focus();
    } else if (reviewing) {
      (acceptRef.current?.disabled === false
        ? acceptRef.current
        : rejectRef.current
      )?.focus();
    }
  }, [
    status,
    reviewing,
  ]);

  return (
    <section
      aria-label={messages.label}
      className={
        className === undefined ? "bn-ai-prompt" : `bn-ai-prompt ${className}`
      }
      data-bn-ai-status={status}
      onKeyDown={(event) => {
        if (event.key !== "Escape") {
          return;
        }
        if (status === "idle") {
          event.preventDefault();
          ai.reject();
        } else if (running) {
          event.preventDefault();
          ai.cancel();
        }
      }}
    >
      {status === "idle" ? (
        <form
          className="bn-ai-form"
          onSubmit={(event) => {
            event.preventDefault();
            ai.start(instruction);
          }}
        >
          <input
            aria-label={messages.placeholder}
            className="bn-ai-input"
            onChange={(event) => setInstruction(event.target.value)}
            placeholder={messages.placeholder}
            ref={inputRef}
            type="text"
            value={instruction}
          />
          <button
            className="bn-ai-button"
            data-bn-variant="primary"
            disabled={instruction.trim() === ""}
            type="submit"
          >
            {messages.submit}
          </button>
          <button
            className="bn-ai-button"
            onClick={ai.reject}
            type="button"
          >
            {messages.close}
          </button>
        </form>
      ) : null}
      <p
        className="bn-ai-status"
        role="status"
      >
        {status === "idle" ? "" : messages[status]}
      </p>
      {running ? (
        <button
          className="bn-ai-button"
          onClick={ai.cancel}
          type="button"
        >
          {messages.cancel}
        </button>
      ) : null}
      {reviewing ? (
        <div className="bn-ai-actions">
          <button
            className="bn-ai-button"
            data-bn-variant="primary"
            disabled={!ai.hasChanges}
            onClick={ai.accept}
            ref={acceptRef}
            type="button"
          >
            {messages.accept}
          </button>
          <button
            className="bn-ai-button"
            onClick={ai.reject}
            ref={rejectRef}
            type="button"
          >
            {messages.reject}
          </button>
        </div>
      ) : null}
    </section>
  );
}
