---
"@useblocknotes/react": minor
---

Add light and dark themes to the base styles. Every color now uses `light-dark()` and follows the operating system by default; force a theme with the new `theme` prop of `<BlockNotesEditor />` (`"system" | "light" | "dark"`) or the `--bn-color-scheme` variable. New variables: `--bn-background`, `--bn-error-color` and `--bn-color-scheme`.

`.bn-root` now sets its own text color (`--bn-text-color`) and background (`--bn-background`) instead of inheriting them from the page. Set `--bn-text-color: inherit` and `--bn-background: transparent` to keep the previous behavior.
