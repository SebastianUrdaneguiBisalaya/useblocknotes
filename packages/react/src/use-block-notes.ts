import type { Editor } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import {
  type BlockNotesDocument,
  type BlockRegistry,
  createRegistry,
  type Operation,
  type OperationError,
  type Result,
  type ValidationIssue,
  validateDocument,
} from "@useblocknotes/core";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { defaultBlocks } from "./blocks.js";
import { documentToJSON, nodeToDocument } from "./convert.js";
import { createExtensions, type Placeholders } from "./extensions.js";
import { applyOperationsToTransaction } from "./transaction.js";
import type { ReactBlockDefinition, ReactInlineDefinition } from "./types.js";

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

/** Options of `useBlockNotes()`. Read once, on mount, except `editable`. */
export interface UseBlockNotesOptions {
  /** Block types. Defaults to `defaultBlocks` (paragraph and headings). */
  readonly blocks?: readonly ReactBlockDefinition[];
  /** Custom inline element types. */
  readonly inlines?: readonly ReactInlineDefinition[];
  /** Document to start with. Validated against the registry. */
  readonly initialDocument?: BlockNotesDocument;
  /** `false` for read-only mode. Can change at any time. Defaults to `true`. */
  readonly editable?: boolean;
  /** Placeholder texts. */
  readonly placeholders?: Partial<Placeholders>;
}

/** An editor instance returned by `useBlockNotes()`. */
export interface BlockNotesInstance {
  /** The underlying Tiptap editor. `null` until it mounts on the client. */
  readonly tiptap: Editor | null;
  /** Registered block and inline types. */
  readonly registry: BlockRegistry<ReactNode>;
  /** Returns the current document. */
  getDocument(): BlockNotesDocument;
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

const DEFAULT_PLACEHOLDERS: Placeholders = {
  block: "Write something, or press '/' for commands",
  title: "Untitled",
};

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
    return {
      document: validated.value,
      extensions: createExtensions(registry, {
        ...DEFAULT_PLACEHOLDERS,
        ...options.placeholders,
      }),
      registry,
    };
  });

  const tiptap = useEditor({
    content: documentToJSON(setup.document),
    editable,
    extensions: setup.extensions,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
  });

  useEffect(() => {
    if (tiptap !== null && tiptap.isEditable !== editable) {
      tiptap.setEditable(editable);
    }
  }, [
    tiptap,
    editable,
  ]);

  return useMemo<BlockNotesInstance>(
    () => ({
      applyOperations(operations) {
        if (tiptap === null) {
          return {
            error: {
              code: "invalid_operation",
              index: 0,
              message: "The editor is not mounted yet",
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
      getDocument() {
        return tiptap === null
          ? setup.document
          : nodeToDocument(tiptap.state.doc);
      },
      registry: setup.registry,
      tiptap,
    }),
    [
      tiptap,
      setup,
    ],
  );
}
