/**
 * Keys bound to an action, in ProseMirror notation: modifiers joined with `-`
 * before the key name, for example `"Mod-Shift-ArrowUp"` or `"Escape"`.
 * `Mod` is Cmd on macOS and Ctrl elsewhere; the other modifiers are `Shift`,
 * `Alt`, `Ctrl` and `Meta`. Key names are `KeyboardEvent.key` values
 * (`"Enter"`, `"Tab"`, `"ArrowDown"`, `"b"`), and `"Space"` for the space bar.
 *
 * Pass one key, several, or `false` to turn the action's keys off.
 */
export type Shortcut = string | readonly string[] | false;

/** Every action with keyboard shortcuts, and its keys. */
export interface Shortcuts {
  /** Opens the AI prompt. Default `Mod-j`. */
  readonly openAi: Shortcut;
  /** Moves the current block up. Default `Mod-Shift-ArrowUp`. */
  readonly moveBlockUp: Shortcut;
  /** Moves the current block down. Default `Mod-Shift-ArrowDown`. */
  readonly moveBlockDown: Shortcut;
  /** Indents a list item. Default `Tab`. */
  readonly indent: Shortcut;
  /** Outdents a list item. Default `Shift-Tab`. */
  readonly outdent: Shortcut;
  /** Toggles bold. Default `Mod-b`. */
  readonly toggleBold: Shortcut;
  /** Toggles italic. Default `Mod-i`. */
  readonly toggleItalic: Shortcut;
  /** Toggles underline. Default `Mod-u`. */
  readonly toggleUnderline: Shortcut;
  /** Toggles strikethrough. Default `Mod-Shift-s`. */
  readonly toggleStrike: Shortcut;
  /** Toggles inline code. Default `Mod-e`. */
  readonly toggleCode: Shortcut;
  /** Undoes the last change. Default `Mod-z`. */
  readonly undo: Shortcut;
  /** Redoes the last undone change. Default `Mod-y` and `Mod-Shift-z`. */
  readonly redo: Shortcut;
  /**
   * Block behavior of Enter: continues or ends lists, leaves code blocks and
   * starts paragraphs. Default `Enter`. When off, Enter only splits the block.
   */
  readonly enter: Shortcut;
  /**
   * Block behavior of Backspace at the start of a block: outdents list items
   * and turns blocks into paragraphs. Default `Backspace`. When off,
   * Backspace only joins blocks.
   */
  readonly backspace: Shortcut;
  /** Highlights the previous slash menu entry. Default `ArrowUp`. */
  readonly slashMenuUp: Shortcut;
  /** Highlights the next slash menu entry. Default `ArrowDown`. */
  readonly slashMenuDown: Shortcut;
  /** Runs the highlighted slash menu entry. Default `Enter` and `Tab`. */
  readonly slashMenuSelect: Shortcut;
  /** Closes the slash menu. Default `Escape`. */
  readonly slashMenuClose: Shortcut;
  /** Sends the instruction in the built-in AI prompt. Default `Enter`. */
  readonly aiSubmit: Shortcut;
  /**
   * In the built-in AI prompt: closes it while empty, or stops a running
   * stream. Default `Escape`.
   */
  readonly aiClose: Shortcut;
}

/** Action names of {@link Shortcuts}. */
export type ShortcutAction = keyof Shortcuts;

/**
 * The `shortcuts` option of `useBlockNotes()`: `false` turns every shortcut
 * off; an object changes only the actions it lists.
 */
export type ShortcutsOption = false | Partial<Shortcuts>;

/** Keys of every action after applying the `shortcuts` option. */
export type ResolvedShortcuts = {
  readonly [TAction in ShortcutAction]: readonly string[];
};

/** The built-in shortcuts. */
export const defaultShortcuts: Shortcuts = {
  aiClose: "Escape",
  aiSubmit: "Enter",
  backspace: "Backspace",
  enter: "Enter",
  indent: "Tab",
  moveBlockDown: "Mod-Shift-ArrowDown",
  moveBlockUp: "Mod-Shift-ArrowUp",
  openAi: "Mod-j",
  outdent: "Shift-Tab",
  redo: [
    "Mod-y",
    "Mod-Shift-z",
  ],
  slashMenuClose: "Escape",
  slashMenuDown: "ArrowDown",
  slashMenuSelect: [
    "Enter",
    "Tab",
  ],
  slashMenuUp: "ArrowUp",
  toggleBold: "Mod-b",
  toggleCode: "Mod-e",
  toggleItalic: "Mod-i",
  toggleStrike: "Mod-Shift-s",
  toggleUnderline: "Mod-u",
  undo: "Mod-z",
};

function toKeys(shortcut: Shortcut): readonly string[] {
  if (shortcut === false) {
    return [];
  }
  return typeof shortcut === "string"
    ? [
        shortcut,
      ]
    : shortcut;
}

/** Applies the `shortcuts` option to {@link defaultShortcuts}. */
export function resolveShortcuts(
  option: ShortcutsOption = {},
): ResolvedShortcuts {
  const keys = (action: ShortcutAction): readonly string[] =>
    option === false ? [] : toKeys(option[action] ?? defaultShortcuts[action]);
  return {
    aiClose: keys("aiClose"),
    aiSubmit: keys("aiSubmit"),
    backspace: keys("backspace"),
    enter: keys("enter"),
    indent: keys("indent"),
    moveBlockDown: keys("moveBlockDown"),
    moveBlockUp: keys("moveBlockUp"),
    openAi: keys("openAi"),
    outdent: keys("outdent"),
    redo: keys("redo"),
    slashMenuClose: keys("slashMenuClose"),
    slashMenuDown: keys("slashMenuDown"),
    slashMenuSelect: keys("slashMenuSelect"),
    slashMenuUp: keys("slashMenuUp"),
    toggleBold: keys("toggleBold"),
    toggleCode: keys("toggleCode"),
    toggleItalic: keys("toggleItalic"),
    toggleStrike: keys("toggleStrike"),
    toggleUnderline: keys("toggleUnderline"),
    undo: keys("undo"),
  };
}

/** The part of a keyboard event that shortcuts read. */
export interface KeyboardEventLike {
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

function isMac(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iP(hone|[oa]d)/.test(navigator.platform)
  );
}

interface ParsedKey {
  readonly key: string;
  readonly alt: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
}

function parse(shortcut: string, mac: boolean): ParsedKey {
  const parts = shortcut.split(/-(?!$)/);
  const name = parts.pop() ?? "";
  const mods = new Set(parts.map((part) => part.toLowerCase()));
  const mod = mods.has("mod");
  return {
    alt: mods.has("alt"),
    ctrl: mods.has("ctrl") || mods.has("control") || (mod && !mac),
    key: name === "Space" ? " " : name,
    meta: mods.has("meta") || mods.has("cmd") || (mod && mac),
    shift: mods.has("shift"),
  };
}

/**
 * `true` when `event` matches one of `keys`, with exactly the same modifiers.
 * Letters match in any case.
 */
export function matchesShortcut(
  event: KeyboardEventLike,
  keys: readonly string[],
): boolean {
  const mac = isMac();
  return keys.some((shortcut) => {
    const parsed = parse(shortcut, mac);
    const key =
      parsed.key.length === 1
        ? event.key.toLowerCase() === parsed.key.toLowerCase()
        : event.key === parsed.key;
    return (
      key &&
      event.altKey === parsed.alt &&
      event.ctrlKey === parsed.ctrl &&
      event.metaKey === parsed.meta &&
      event.shiftKey === parsed.shift
    );
  });
}
