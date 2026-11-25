import type { Editor } from "@tiptap/core";
import {
  type AiAdapter,
  type AiRequest,
  type AiSelection,
  type AiStreamError,
  type AiStreamState,
  type BlockNotesDocument,
  type BlockRegistry,
  processAiStream,
} from "@useblocknotes/core";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  acceptAiPreview,
  readSelection,
  rejectAiPreview,
  showAiPreview,
} from "./ai-session.js";
import { nodeToDocument } from "./convert.js";

/**
 * Phase of the AI request.
 *
 * - `idle`: no request; the prompt may be open for typing.
 * - `loading`: request sent, waiting for the first event.
 * - `streaming`: events are arriving and render live.
 * - `done`, `cancelled`, `error`: the stream stopped; accept or reject what
 *   was written.
 */
export type AiStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "done"
  | "cancelled"
  | "error";

/** Texts of the AI prompt and "Ask AI" button. */
export interface AiMessages {
  /** "Ask AI" button and slash menu entry. */
  readonly askAi: string;
  /** Accessible name of the AI prompt. */
  readonly label: string;
  /** Placeholder of the instruction input. */
  readonly placeholder: string;
  readonly submit: string;
  readonly cancel: string;
  readonly accept: string;
  readonly reject: string;
  readonly close: string;
  readonly loading: string;
  readonly streaming: string;
  readonly done: string;
  readonly cancelled: string;
  readonly error: string;
}

/** AI options of `useBlockNotes()`. */
export interface AiOptions {
  /**
   * Bridge to the host's AI provider. Enables `/ai`, the "Ask AI" button and
   * `Mod-J`. useblocknotes never calls an AI API itself.
   */
  readonly ai?: AiAdapter;
  /**
   * Builds the `context` string sent to the adapter. Defaults to the title and
   * the plain text of every block.
   */
  readonly aiContext?: (
    document: BlockNotesDocument,
    selection: AiSelection | null,
  ) => string;
  /** AI texts. */
  readonly aiMessages?: Partial<AiMessages>;
  /** Called when a request is sent to the adapter. */
  readonly onAiStart?: (request: AiRequest) => void;
  /** Called when the stream ends successfully, before accept or reject. */
  readonly onAiFinish?: (state: AiStreamState) => void;
  /** Called when the stream fails (not when the user cancels). */
  readonly onAiError?: (error: AiStreamError) => void;
}

/** AI state and actions of an editor, available as `editor.ai`. */
export interface AiController {
  /** `true` when an adapter was given. */
  readonly enabled: boolean;
  /** `true` while the AI prompt is shown. */
  readonly open: boolean;
  readonly status: AiStatus;
  /** Why the stream stopped, when `status` is `"error"`. */
  readonly error: AiStreamError | null;
  /** Selection the prompt was opened with, or `null`. */
  readonly selection: AiSelection | null;
  /** `true` when the pending batch has operations to accept. */
  readonly hasChanges: boolean;
  /** Resolved AI texts. */
  readonly messages: AiMessages;
  /** Opens the prompt for the current editor selection. */
  ask(): void;
  /** Sends `instruction` to the adapter and streams the result live. */
  start(instruction: string): void;
  /** Stops the stream. What was written stays pending. */
  cancel(): void;
  /** Applies the pending batch as a single undo step and closes the prompt. */
  accept(): void;
  /** Discards the pending batch and closes the prompt. */
  reject(): void;
}

const DEFAULT_MESSAGES: AiMessages = {
  accept: "Accept",
  askAi: "Ask AI",
  cancel: "Stop",
  cancelled: "Stopped",
  close: "Close",
  done: "Review the changes",
  error: "Something went wrong",
  label: "AI assistant",
  loading: "Thinking…",
  placeholder: "Ask AI to write or edit…",
  reject: "Discard",
  streaming: "Writing…",
  submit: "Generate",
};

interface Session {
  readonly base: BlockNotesDocument;
  readonly controller: AbortController;
  latest: AiStreamState | null;
}

interface View {
  readonly open: boolean;
  readonly status: AiStatus;
  readonly error: AiStreamError | null;
  readonly selection: AiSelection | null;
  readonly anchorBlockId: string | null;
  readonly hasChanges: boolean;
}

const CLOSED: View = {
  anchorBlockId: null,
  error: null,
  hasChanges: false,
  open: false,
  selection: null,
  status: "idle",
};

function defaultContext(
  document: BlockNotesDocument,
  registry: BlockRegistry<ReactNode>,
): string {
  return [
    `# ${document.title}`,
    ...document.blocks.map((block) => {
      const definition = registry.blocks.get(block.type);
      return definition === undefined
        ? registry.text.text(block.content)
        : definition.toText(block, registry.text);
    }),
  ].join("\n\n");
}

/**
 * @internal AI requests of `useBlockNotes()`. `baseRef` holds the document
 * without AI changes while a batch is pending, for `onChange`.
 */
export function useAi(
  tiptap: Editor | null,
  registry: BlockRegistry<ReactNode>,
  options: AiOptions,
  baseRef: RefObject<BlockNotesDocument | null>,
): AiController {
  const [view, setView] = useState<View>(CLOSED);
  const session = useRef<Session | null>(null);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const enabled = options.ai !== undefined;
  const custom = options.aiMessages;
  const messages = useMemo(
    () => ({
      ...DEFAULT_MESSAGES,
      ...custom,
    }),
    [
      custom,
    ],
  );

  // Abort the stream on unmount.
  useEffect(
    () => () => {
      const current = session.current;
      if (current !== null) {
        current.controller.abort();
        session.current = null;
        baseRef.current = null;
      }
    },
    [
      baseRef,
    ],
  );

  const actions = useMemo(() => {
    const finish = (accept: boolean) => {
      const current = session.current;
      if (current !== null && tiptap !== null) {
        current.controller.abort();
        session.current = null;
        baseRef.current = null;
        const operations = current.latest?.operations ?? [];
        if (accept && operations.length > 0) {
          acceptAiPreview(tiptap.view, current.base, operations, registry);
        } else {
          rejectAiPreview(tiptap.view, current.base);
        }
      }
      setView(CLOSED);
      tiptap?.commands.focus();
    };

    return {
      accept: () => finish(true),
      ask: () => {
        if (tiptap === null || !tiptap.isEditable || session.current !== null) {
          return;
        }
        const { anchorBlockId, selection } = readSelection(tiptap.state);
        setView({
          ...CLOSED,
          anchorBlockId,
          open: true,
          selection,
        });
      },
      cancel: () => session.current?.controller.abort(),
      reject: () => finish(false),
      start: (instruction: string, from: View) => {
        const adapter = latest.current.ai;
        if (
          tiptap === null ||
          adapter === undefined ||
          session.current !== null ||
          instruction.trim() === ""
        ) {
          return;
        }
        const base = nodeToDocument(tiptap.state.doc);
        const controller = new AbortController();
        const current: Session = {
          base,
          controller,
          latest: null,
        };
        session.current = current;
        baseRef.current = base;
        const isCurrent = () => session.current === current;

        const request: AiRequest = {
          anchorBlockId: from.anchorBlockId,
          context:
            latest.current.aiContext?.(base, from.selection) ??
            defaultContext(base, registry),
          instruction,
          selection: from.selection,
          signal: controller.signal,
        };
        setView({
          ...from,
          error: null,
          hasChanges: false,
          open: true,
          status: "loading",
        });
        latest.current.onAiStart?.(request);

        const settle = (
          result: Awaited<ReturnType<typeof processAiStream>>,
        ) => {
          if (!isCurrent()) {
            return;
          }
          if (result.ok) {
            setView((prev) => ({
              ...prev,
              status: "done",
            }));
            latest.current.onAiFinish?.(result.value);
            return;
          }
          const { error } = result;
          if (error.code === "aborted") {
            setView((prev) => ({
              ...prev,
              status: "cancelled",
            }));
            return;
          }
          setView((prev) => ({
            ...prev,
            error,
            status: "error",
          }));
          latest.current.onAiError?.(error);
        };

        let events: ReturnType<AiAdapter>;
        try {
          events = adapter(request);
        } catch (error) {
          settle({
            error: {
              code: "stream_failed",
              message: error instanceof Error ? error.message : String(error),
              state: {
                activeBlockId: null,
                document: base,
                operations: [],
              },
            },
            ok: false,
          });
          return;
        }

        void processAiStream(events, {
          document: base,
          onUpdate: (state) => {
            if (!isCurrent()) {
              return;
            }
            current.latest = state;
            showAiPreview(tiptap.view, state);
            const hasChanges = state.operations.length > 0;
            setView((prev) =>
              prev.status === "streaming" && prev.hasChanges === hasChanges
                ? prev
                : {
                    ...prev,
                    hasChanges,
                    status: "streaming",
                  },
            );
          },
          registry,
          signal: controller.signal,
        }).then(settle);
      },
    };
  }, [
    tiptap,
    registry,
    baseRef,
  ]);

  return useMemo<AiController>(
    () => ({
      accept: actions.accept,
      ask: actions.ask,
      cancel: actions.cancel,
      enabled,
      error: view.error,
      hasChanges: view.hasChanges,
      messages,
      open: view.open,
      reject: actions.reject,
      selection: view.selection,
      start: (instruction) => actions.start(instruction, view),
      status: view.status,
    }),
    [
      actions,
      enabled,
      messages,
      view,
    ],
  );
}
