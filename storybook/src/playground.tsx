import type {
  AiRequest,
  AiStreamError,
  AiStreamState,
  BlockNotesDocument,
  Locale,
  Operation,
} from "@useblocknotes/core";
import { exportPdf } from "@useblocknotes/pdf";
import {
  type AiMode,
  type BlockNotesComponents,
  BlockNotesEditor,
  type BlockNotesInstance,
  type BlockNotesTheme,
  useBlockNotes,
} from "@useblocknotes/react";
import { type ReactNode, useEffect, useState } from "react";
import { playgroundBlocks } from "./blocks/index.js";
import { customComponents } from "./custom-ui.js";
import { ExternalHotkeys } from "./external-hotkeys.js";
import { createMockAdapter } from "./mock-adapter.js";
import { sampleDocument } from "./sample-document.js";

const mockAdapter = createMockAdapter();

const NO_COMPONENTS: BlockNotesComponents = {};

/** Props of {@link Playground}. */
export interface PlaygroundProps {
  readonly aiMode: AiMode;
  readonly locale: Locale;
  readonly editable: boolean;
  /** Shows the PDF export panel. */
  readonly pdf: boolean;
  /** Replaces the slash menu, AI popover and "Ask AI" button with custom ones. */
  readonly customUi: boolean;
  /**
   * Turns the editor shortcuts off and binds host hotkeys to
   * `editor.commands`. Read on mount.
   */
  readonly externalHotkeys: boolean;
  /** Color theme of the base styles. */
  readonly theme: BlockNotesTheme;
  readonly onChange: (
    operations: readonly Operation[],
    document: BlockNotesDocument,
  ) => void;
  readonly onAiStart: (request: AiRequest) => void;
  readonly onAiFinish: (state: AiStreamState) => void;
  readonly onAiError: (error: AiStreamError) => void;
}

/** An editor with the example blocks and the mock AI adapter. */
export function Playground({
  aiMode,
  customUi,
  externalHotkeys,
  pdf,
  theme,
  ...options
}: PlaygroundProps): ReactNode {
  const editor = useBlockNotes({
    ...options,
    ...(externalHotkeys
      ? {
          shortcuts: false,
        }
      : {}),
    ai: mockAdapter,
    blocks: playgroundBlocks,
    initialDocument: sampleDocument,
  });
  return (
    <div
      className="sb-playground"
      data-sb-theme={theme}
    >
      {externalHotkeys ? <ExternalHotkeys editor={editor} /> : null}
      <BlockNotesEditor
        aiMode={aiMode}
        components={customUi ? customComponents : NO_COMPONENTS}
        editor={editor}
        theme={theme}
      />
      {pdf ? (
        <PdfPanel
          editor={editor}
          locale={options.locale}
        />
      ) : null}
    </div>
  );
}

type PdfState =
  | {
      readonly status: "idle" | "exporting";
    }
  | {
      readonly status: "done";
      readonly url: string;
    }
  | {
      readonly status: "error";
      readonly message: string;
    };

/** Exports the current document with `exportPdf()` and previews it. */
function PdfPanel({
  editor,
  locale,
}: {
  readonly editor: BlockNotesInstance;
  readonly locale: Locale;
}): ReactNode {
  const [state, setState] = useState<PdfState>({
    status: "idle",
  });
  const url = state.status === "done" ? state.url : null;
  useEffect(
    () => () => {
      if (url !== null) {
        URL.revokeObjectURL(url);
      }
    },
    [
      url,
    ],
  );
  const run = async (): Promise<void> => {
    setState({
      status: "exporting",
    });
    const result = await exportPdf(editor.getDocument(), {
      blocks: playgroundBlocks,
      locale,
    });
    setState(
      result.ok
        ? {
            status: "done",
            url: URL.createObjectURL(result.value),
          }
        : {
            message:
              result.error.code === "invalid_document"
                ? `${result.error.issues.length} invalid block(s)`
                : result.error.message,
            status: "error",
          },
    );
  };
  return (
    <section
      aria-label="PDF export"
      className="sb-pdf"
    >
      <div className="sb-block-actions">
        <button
          disabled={state.status === "exporting"}
          onClick={() => {
            void run();
          }}
          type="button"
        >
          {state.status === "exporting" ? "Exporting…" : "Export PDF"}
        </button>
        {url === null ? null : (
          <a
            download="playground.pdf"
            href={url}
          >
            Download
          </a>
        )}
      </div>
      {state.status === "error" ? <p role="alert">{state.message}</p> : null}
      {url === null ? null : (
        <iframe
          src={url}
          title="PDF preview"
        />
      )}
    </section>
  );
}
