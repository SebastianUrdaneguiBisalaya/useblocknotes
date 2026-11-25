---
"@useblocknotes/react": minor
---

Add the `shortcuts` option to `useBlockNotes()` to change or turn off every keyboard shortcut (`false` turns them all off), including the slash menu and AI prompt keys, and `editor.commands` to run the same actions from your own hotkey library. Also export `defaultShortcuts`, `resolveShortcuts()` and `matchesShortcut()`, and fix Enter in the open slash menu, which created a new paragraph instead of running the highlighted entry.

The undo and redo defaults no longer include the Cyrillic `Mod-я` variants; add them back with `shortcuts: { undo: ["Mod-z", "Mod-я"] }` if needed.
