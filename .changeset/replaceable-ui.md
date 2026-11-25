---
"@useblocknotes/react": minor
---

Add the `components` prop to `<BlockNotesEditor />` to replace or hide the slash menu, AI popover, AI chat bar and "Ask AI" button. Custom components receive the state and actions as props, plus `floating` (to use the editor's positioning) and `reference` (to use your own). Also export the built-in components, `useSlashMenu()` and `editor.slashMenu`.
