import {
  type BlockNotesCommands,
  type BlockNotesInstance,
  matchesShortcut,
} from "@useblocknotes/react";
import { type ReactNode, useEffect } from "react";

/**
 * Hotkeys of the host app, standing in for a library like `useHotkeys`. The
 * editor is created with `shortcuts: false`, so only these keys run actions.
 */
const HOTKEYS: readonly (readonly [
  string,
  keyof BlockNotesCommands,
])[] = [
  [
    "Alt-a",
    "openAi",
  ],
  [
    "Alt-ArrowUp",
    "moveBlockUp",
  ],
  [
    "Alt-ArrowDown",
    "moveBlockDown",
  ],
  [
    "Alt-b",
    "toggleBold",
  ],
  [
    "Alt-z",
    "undo",
  ],
];

/** Binds {@link HOTKEYS} on the window and lists them. */
export function ExternalHotkeys({
  editor,
}: {
  readonly editor: BlockNotesInstance;
}): ReactNode {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // `code` keeps letters stable when Alt changes `key` (for example on macOS).
      const named = {
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        key: event.code.startsWith("Key")
          ? event.code.slice(3).toLowerCase()
          : event.key,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      };
      const hotkey = HOTKEYS.find(([keys]) =>
        matchesShortcut(named, [
          keys,
        ]),
      );
      if (hotkey !== undefined && editor.commands[hotkey[1]]()) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    editor,
  ]);
  return (
    <aside className="sb-hotkeys">
      <p>
        Editor shortcuts are off (<code>shortcuts: false</code>). These host
        hotkeys call <code>editor.commands</code>:
      </p>
      <ul>
        {HOTKEYS.map(([keys, command]) => (
          <li key={keys}>
            <kbd>{keys}</kbd> → <code>{command}()</code>
          </li>
        ))}
      </ul>
    </aside>
  );
}
