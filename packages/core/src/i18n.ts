/** Locales with built-in messages. */
export type Locale = "en" | "es";

/** Keys of `messages.blocks`: labels of the built-in slash menu entries. */
export type BlockMessageKey =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletListItem"
  | "numberedListItem"
  | "quote"
  | "codeBlock";

/** Every UI string of the editor, grouped by feature. */
export interface Messages {
  /** Placeholders of empty nodes. */
  readonly placeholders: {
    /** Shown in the empty title. */
    readonly title: string;
    /** Shown in the empty block that has the cursor. */
    readonly block: string;
  };
  /** Slash menu. */
  readonly slashMenu: {
    /** Accessible name of the menu. */
    readonly label: string;
    /** Shown when no entry matches the query. */
    readonly empty: string;
  };
  /** Labels of the built-in blocks in the slash menu. */
  readonly blocks: {
    readonly [TKey in BlockMessageKey]: string;
  };
  /** Code block. */
  readonly code: {
    /** Accessible name of the language input. */
    readonly language: string;
    /** Placeholder of the language input. */
    readonly languagePlaceholder: string;
  };
  /** AI prompt, chat bar and "Ask AI" button. */
  readonly ai: {
    /** "Ask AI" button and slash menu entry. */
    readonly askAi: string;
    /** Accessible name of the AI prompt. */
    readonly label: string;
    /** Placeholder of the instruction input. */
    readonly placeholder: string;
    readonly submit: string;
    /** Stops a running request. */
    readonly cancel: string;
    readonly accept: string;
    readonly reject: string;
    readonly close: string;
    readonly loading: string;
    readonly streaming: string;
    readonly done: string;
    readonly cancelled: string;
    readonly error: string;
    /** Shown on a request whose batch was accepted. */
    readonly accepted: string;
    /** Shown on a request whose batch was discarded. */
    readonly rejected: string;
    /** Accessible name of the chat history. */
    readonly history: string;
    /** Label before the selected text a request applies to. */
    readonly selection: string;
  };
}

/** Overrides of any message: every group and key is optional. */
export type MessagesOverride = {
  readonly [TGroup in keyof Messages]?: Partial<Messages[TGroup]>;
};

/** English messages. */
export const enMessages: Messages = {
  ai: {
    accept: "Accept",
    accepted: "Accepted",
    askAi: "Ask AI",
    cancel: "Stop",
    cancelled: "Stopped",
    close: "Close",
    done: "Review the changes",
    error: "Something went wrong",
    history: "AI conversation",
    label: "AI assistant",
    loading: "Thinking…",
    placeholder: "Ask AI to write or edit…",
    reject: "Discard",
    rejected: "Discarded",
    selection: "Selection",
    streaming: "Writing…",
    submit: "Generate",
  },
  blocks: {
    bulletListItem: "Bulleted list",
    codeBlock: "Code",
    heading1: "Heading 1",
    heading2: "Heading 2",
    heading3: "Heading 3",
    numberedListItem: "Numbered list",
    paragraph: "Text",
    quote: "Quote",
  },
  code: {
    language: "Code language",
    languagePlaceholder: "Language",
  },
  placeholders: {
    block: "Write something, or press '/' for commands",
    title: "Untitled",
  },
  slashMenu: {
    empty: "No results",
    label: "Insert block",
  },
};

/** Spanish messages. */
export const esMessages: Messages = {
  ai: {
    accept: "Aceptar",
    accepted: "Aceptado",
    askAi: "Preguntar a la IA",
    cancel: "Detener",
    cancelled: "Detenido",
    close: "Cerrar",
    done: "Revisa los cambios",
    error: "Algo salió mal",
    history: "Conversación con la IA",
    label: "Asistente de IA",
    loading: "Pensando…",
    placeholder: "Pide a la IA que escriba o edite…",
    reject: "Descartar",
    rejected: "Descartado",
    selection: "Selección",
    streaming: "Escribiendo…",
    submit: "Generar",
  },
  blocks: {
    bulletListItem: "Lista con viñetas",
    codeBlock: "Código",
    heading1: "Título 1",
    heading2: "Título 2",
    heading3: "Título 3",
    numberedListItem: "Lista numerada",
    paragraph: "Texto",
    quote: "Cita",
  },
  code: {
    language: "Lenguaje del código",
    languagePlaceholder: "Lenguaje",
  },
  placeholders: {
    block: "Escribe algo o pulsa '/' para ver comandos",
    title: "Sin título",
  },
  slashMenu: {
    empty: "Sin resultados",
    label: "Insertar bloque",
  },
};

/** Built-in messages by locale. */
export const builtInMessages: Readonly<Record<Locale, Messages>> = {
  en: enMessages,
  es: esMessages,
};

/**
 * The messages of `locale` (English by default) with `overrides` applied.
 * Pure: returns a new object.
 *
 * @example
 * ```ts
 * const messages = resolveMessages("es", { ai: { askAi: "IA" } });
 * ```
 */
export function resolveMessages(
  locale: Locale = "en",
  overrides: MessagesOverride = {},
): Messages {
  const base = builtInMessages[locale];
  return {
    ai: {
      ...base.ai,
      ...overrides.ai,
    },
    blocks: {
      ...base.blocks,
      ...overrides.blocks,
    },
    code: {
      ...base.code,
      ...overrides.code,
    },
    placeholders: {
      ...base.placeholders,
      ...overrides.placeholders,
    },
    slashMenu: {
      ...base.slashMenu,
      ...overrides.slashMenu,
    },
  };
}
