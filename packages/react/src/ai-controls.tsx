import { type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { ShortcutsContext } from "./context.js";
import { useMessages } from "./messages.js";
import { type KeyboardEventLike, matchesShortcut } from "./shortcuts.js";
import type { AiController } from "./use-ai.js";

/** `true` while a request is waiting for or receiving events. */
export function isRunning(ai: AiController): boolean {
  return ai.status === "loading" || ai.status === "streaming";
}

/**
 * @internal The `aiClose` shortcut (Escape) closes an empty prompt or stops a
 * running stream. Returns a `keydown` handler for the AI container.
 */
export function useCloseHandler(ai: AiController) {
  const keys = useContext(ShortcutsContext).aiClose;
  return (
    event: KeyboardEventLike & {
      preventDefault(): void;
    },
  ) => {
    if (!matchesShortcut(event, keys)) {
      return;
    }
    if (ai.status === "idle" && ai.open) {
      event.preventDefault();
      ai.reject();
    } else if (isRunning(ai)) {
      event.preventDefault();
      ai.cancel();
    }
  };
}

interface AiComposerProps {
  readonly ai: AiController;
  /** Moves focus to the input when it becomes `true`. */
  readonly focus: boolean;
  /** Shows a Close button that closes the prompt. */
  readonly closable: boolean;
}

/**
 * @internal Instruction input. The `aiSubmit` shortcut (Enter) sends; other
 * keys, like Shift+Enter, type as usual. Disabled while a request is pending.
 */
export function AiComposer({
  ai,
  closable,
  focus,
}: AiComposerProps): ReactNode {
  const messages = useMessages().ai;
  const submitKeys = useContext(ShortcutsContext).aiSubmit;
  const [instruction, setInstruction] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const disabled = ai.status !== "idle";

  useEffect(() => {
    if (focus) {
      inputRef.current?.focus();
    }
  }, [
    focus,
  ]);

  const submit = () => {
    if (disabled || instruction.trim() === "") {
      return;
    }
    ai.start(instruction);
    setInstruction("");
  };

  return (
    <form
      className="bn-ai-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        aria-label={messages.placeholder}
        className="bn-ai-input"
        disabled={disabled}
        onChange={(event) => setInstruction(event.target.value)}
        onKeyDown={(event) => {
          if (
            !event.nativeEvent.isComposing &&
            matchesShortcut(event, submitKeys)
          ) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={messages.placeholder}
        ref={inputRef}
        rows={1}
        value={instruction}
      />
      <button
        className="bn-ai-button"
        data-bn-variant="primary"
        disabled={disabled || instruction.trim() === ""}
        type="submit"
      >
        {messages.submit}
      </button>
      {closable ? (
        <button
          className="bn-ai-button"
          onClick={ai.reject}
          type="button"
        >
          {messages.close}
        </button>
      ) : null}
    </form>
  );
}

/**
 * @internal Status of the current request (loading, writing, done, stopped,
 * error) with Stop while it runs, then Accept and Discard.
 */
export function AiStatusLine({ ai }: { readonly ai: AiController }): ReactNode {
  const messages = useMessages().ai;
  const { status } = ai;
  const running = isRunning(ai);
  const reviewing = !running && status !== "idle";
  const acceptRef = useRef<HTMLButtonElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);

  // Move focus to Accept (or Discard) when the stream stops.
  useEffect(() => {
    if (reviewing) {
      (acceptRef.current?.disabled === false
        ? acceptRef.current
        : rejectRef.current
      )?.focus();
    }
  }, [
    reviewing,
  ]);

  return (
    <div
      className="bn-ai-state"
      data-bn-ai-status={status}
    >
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
    </div>
  );
}

/** @internal Joins a base class with an optional consumer class. */
export function join(base: string, extra: string | undefined): string {
  return extra === undefined ? base : `${base} ${extra}`;
}
