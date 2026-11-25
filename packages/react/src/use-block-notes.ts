import type { Editor } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import {
  type BlockNotesDocument,
  type BlockRegistry,
  createRegistry,
  diffDocuments,
  type Locale,
  type Messages,
  type MessagesOverride,
  type Operation,
  type OperationError,
  type Result,
  resolveMessages,
  type ValidationIssue,
  validateDocument,
} from "@useblocknotes/core";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { defaultBlocks } from "./blocks.js";
import { type BlockNotesCommands, createCommands } from "./commands.js";
import { documentToJSON, nodeToDocument } from "./convert.js";
import { createExtensions } from "./extensions.js";
import {
  type ResolvedShortcuts,
  resolveShortcuts,
  type ShortcutsOption,
} from "./shortcuts.js";
import { createSlashMenuStore, type SlashMenuStore } from "./slash-menu.js";
import { applyOperationsToTransaction } from "./transaction.js";
import type { ReactBlockDefinition, ReactInlineDefinition } from "./types.js";
import { type AiController, type AiOptions, useAi } from "./use-ai.js";

/** Thrown by `useBlockNotes()` when `initialDocument` fails validation. */
export class InvalidDocumentError extends Error {
  /** What is wrong with the document. */
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(`Invalid document: ${issues.length} issue(s)`);
    this.name = "InvalidDocumentError";
    this.issues = issues;
  }
}

/**
 * Options of `useBlockNotes()`. Read once, on mount, except `editable`,
 * `locale`, `messages` and callbacks.
 */
export interface UseBlockNotesOptions extends AiOptions {
  /** Block types. Defaults to `defaultBlocks` (paragraph and headings). */
  readonly blocks?: readonly ReactBlockDefinition[];
  /** Custom inline element types. */
  readonly inlines?: readonly ReactInlineDefinition[];
  /** Document to start with. Validated against the registry. */
  readonly initialDocument?: BlockNotesDocument;
  /** `false` for read-only mode. Can change at any time. Defaults to `true`. */
  readonly editable?: boolean;
  /** Language of the built-in UI texts. Can change at any time. Defaults to `"en"`. */
  readonly locale?: Locale;
  /**
   * Overrides any UI text of `locale`, by group and key. Can change at any
   * time.
   *
   * @example
   * ```ts
   * { locale: "es", messages: { ai: { askAi: "Pregúntale a la IA" } } }
   * ```
   */
  readonly messages?: MessagesOverride;
  /**
   * Called with the operations of every batch of edits (manual, pasted,
   * dragged or applied with `applyOperations()`) and the resulting document,
   * after `changeDebounceMs` without edits, on blur, on `flushChanges()` and on
   * unmount. Always reads the latest callback.
   */
  readonly onChange?: (
    operations: readonly Operation[],
    document: BlockNotesDocument,
    meta: ChangeMeta,
  ) => void;
  /**
   * Version of the document the host last saved (for example a revision
   * number). Forwarded in `onChange` so the host can detect conflicts. Update
   * it after each save.
   */
  readonly baseVersion?: string | number;
  /** Milliseconds without edits before `onChange` fires. Defaults to 500. */
  readonly changeDebounceMs?: number;
  /**
   * Keyboard shortcuts. `false` turns them all off (for example to bind the
   * actions with your own hotkey library through `editor.commands`); an
   * object changes only the actions it lists, with a key, several keys or
   * `false`. Read once, on mount. Defaults to `defaultShortcuts`.
   *
   * @example
   * ```ts
   * { shortcuts: { openAi: "Mod-k", moveBlockUp: false } }
   * ```
   */
  readonly shortcuts?: ShortcutsOption;
}

/** Extra data passed to `onChange`. */
export interface ChangeMeta {
  /** The `baseVersion` option when the batch was emitted, or `null`. */
  readonly baseVersion: string | number | null;
}

/** An editor instance returned by `useBlockNotes()`. */
export interface BlockNotesInstance {
  /** The underlying Tiptap editor. `null` until it mounts on the client. */
  readonly tiptap: Editor | null;
  /** Registered block and inline types. */
  readonly registry: BlockRegistry<ReactNode>;
  /** AI state and actions. */
  readonly ai: AiController;
  /** UI texts resolved from `locale` and `messages`. */
  readonly messages: Messages;
  /**
   * Live state of the slash menu. Read it with `useSlashMenu()` to render a
   * slash menu outside `<BlockNotesEditor />`.
   */
  readonly slashMenu: SlashMenuStore;
  /** Keys of every shortcut, after applying the `shortcuts` option. */
  readonly shortcuts: ResolvedShortcuts;
  /** Actions that have shortcuts, to run them from your own hotkeys. */
  readonly commands: BlockNotesCommands;
  /**
   * Returns the current document. While an AI batch is pending, returns the
   * document without it.
   */
  getDocument(): BlockNotesDocument;
  /** Emits pending changes to `onChange` now instead of waiting. */
  flushChanges(): void;
  /**
   * Validates and applies operations as a single undo step. All-or-nothing:
   * returns the first error and changes nothing if any operation fails.
   */
  applyOperations(
    operations: readonly Operation[],
  ): Result<BlockNotesDocument, OperationError>;
}

const EMPTY_DOCUMENT: BlockNotesDocument = {
  blocks: [],
  title: "",
};

const DEFAULT_DEBOUNCE_MS = 500;

/**
 * Messages of `locale` with `overrides`, keeping the same object while their
 * content does not change (so inline `messages` objects are fine).
 */
function useResolvedMessages(
  locale: Locale | undefined,
  overrides: MessagesOverride | undefined,
): Messages {
  const next = resolveMessages(locale, overrides);
  const key = JSON.stringify(next);
  const [resolved, setResolved] = useState({
    key,
    messages: next,
  });
  if (resolved.key !== key) {
    setResolved({
      key,
      messages: next,
    });
  }
  return resolved.key === key ? resolved.messages : next;
}

/**
 * Creates a useblocknotes editor. Render it with `<BlockNotesEditor />`.
 *
 * @throws {InvalidDocumentError} If `initialDocument` fails validation.
 * @throws {RegistryError} If block or inline types are duplicated or reserved.
 *
 * @example
 * ```tsx
 * const editor = useBlockNotes({ blocks: [...defaultBlocks, chart], initialDocument });
 * return <BlockNotesEditor editor={editor} />;
 * ```
 */
export function useBlockNotes(
  options: UseBlockNotesOptions = {},
): BlockNotesInstance {
  const { editable = true } = options;
  const messages = useResolvedMessages(options.locale, options.messages);
  // Read by extensions, which are created once.
  const messagesRef = useRef(messages);
  // Set by `useAi()`; read by the slash entry and the `Mod-J` shortcut.
  const askAiRef = useRef<() => void>(() => {});
  // Document without the pending AI batch, while there is one.
  const aiBaseRef = useRef<BlockNotesDocument | null>(null);
  const [setup] = useState(() => {
    const registry = createRegistry<ReactNode>({
      blocks: options.blocks ?? defaultBlocks,
      inlines: options.inlines ?? [],
    });
    const validated = validateDocument(
      options.initialDocument ?? EMPTY_DOCUMENT,
      registry,
    );
    if (!validated.ok) {
      throw new InvalidDocumentError(validated.error);
    }
    const slashMenu = createSlashMenuStore();
    const shortcuts = resolveShortcuts(options.shortcuts);
    return {
      aiEnabled: options.ai !== undefined,
      document: validated.value,
      extensions: createExtensions(registry, {
        ai:
          options.ai === undefined
            ? null
            : {
                ask: () => askAiRef.current(),
              },
        messages: () => messagesRef.current,
        shortcuts,
        slashMenu,
      }),
      registry,
      shortcuts,
      slashMenu,
    };
  });

  const tiptap = useEditor({
    content: documentToJSON(setup.document),
    editable,
    extensions: setup.extensions,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
  });

  const latest = useRef({
    baseVersion: options.baseVersion,
    debounce: options.changeDebounceMs ?? DEFAULT_DEBOUNCE_MS,
    onChange: options.onChange,
  });
  useEffect(() => {
    latest.current = {
      baseVersion: options.baseVersion,
      debounce: options.changeDebounceMs ?? DEFAULT_DEBOUNCE_MS,
      onChange: options.onChange,
    };
  });

  const flushRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (tiptap === null) {
      return;
    }
    // Last document reported to (or loaded by) the host.
    let saved = nodeToDocument(tiptap.state.doc);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      const current = aiBaseRef.current ?? nodeToDocument(tiptap.state.doc);
      const operations = diffDocuments(saved, current);
      if (operations.length === 0) {
        return;
      }
      saved = current;
      latest.current.onChange?.(operations, current, {
        baseVersion: latest.current.baseVersion ?? null,
      });
    };
    const schedule = () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(flush, latest.current.debounce);
    };

    tiptap.on("update", schedule);
    tiptap.on("blur", flush);
    flushRef.current = flush;
    return () => {
      tiptap.off("update", schedule);
      tiptap.off("blur", flush);
      flush();
      flushRef.current = null;
    };
  }, [
    tiptap,
  ]);

  // Redraw placeholders when the texts change. Tiptap's placeholder plugin
  // only rebuilds nodes touched by a change, so touch every empty node.
  useEffect(() => {
    if (messagesRef.current === messages) {
      return;
    }
    messagesRef.current = messages;
    if (tiptap === null || tiptap.isDestroyed) {
      return;
    }
    const tr = tiptap.state.tr;
    tr.doc.forEach((node, pos) => {
      if (node.content.size === 0) {
        tr.setNodeMarkup(pos, undefined, node.attrs);
      }
    });
    tiptap.view.dispatch(tr.setMeta("addToHistory", false));
  }, [
    tiptap,
    messages,
  ]);

  const ai = useAi(tiptap, setup.registry, options, aiBaseRef);
  useEffect(() => {
    askAiRef.current = ai.ask;
  }, [
    ai.ask,
  ]);

  // Read-only while an AI batch is pending.
  const isEditable = editable && ai.status === "idle";
  useEffect(() => {
    if (tiptap !== null && tiptap.isEditable !== isEditable) {
      tiptap.setEditable(isEditable);
    }
  }, [
    tiptap,
    isEditable,
  ]);

  return useMemo<BlockNotesInstance>(
    () => ({
      ai,
      applyOperations(operations) {
        if (tiptap === null || aiBaseRef.current !== null) {
          return {
            error: {
              code: "invalid_operation",
              index: 0,
              message:
                tiptap === null
                  ? "The editor is not mounted yet"
                  : "An AI batch is pending: accept or reject it first",
              path: [],
            },
            ok: false,
          };
        }
        const tr = tiptap.state.tr;
        const result = applyOperationsToTransaction(tr, operations, {
          registry: setup.registry,
        });
        if (result.ok) {
          tiptap.view.dispatch(tr);
        }
        return result;
      },
      commands: createCommands(
        () => tiptap,
        () => (setup.aiEnabled ? askAiRef.current : null),
      ),
      flushChanges() {
        flushRef.current?.();
      },
      getDocument() {
        return tiptap === null
          ? setup.document
          : (aiBaseRef.current ?? nodeToDocument(tiptap.state.doc));
      },
      messages,
      registry: setup.registry,
      shortcuts: setup.shortcuts,
      slashMenu: setup.slashMenu,
      tiptap,
    }),
    [
      ai,
      messages,
      tiptap,
      setup,
    ],
  );
}
