# @useblocknotes/react

React 19 components and hooks for [useblocknotes](https://github.com/SebastianUrdaneguiBisalaya/useblocknotes), a Notion-style block editor built on Tiptap core with AI responses streamed live into the editor.

## Installation

```sh
npm install @useblocknotes/react @useblocknotes/core react react-dom zod
```

`@useblocknotes/core`, `react` and `react-dom` 19, and `zod` 4 are peer dependencies. Tiptap and ProseMirror (MIT) are installed as dependencies.

## Usage

```tsx
import type { BlockNotesDocument } from "@useblocknotes/core";
import { BlockNotesEditor, defaultBlocks, useBlockNotes } from "@useblocknotes/react";
import "@useblocknotes/react/styles.css"; // optional base styles

export function Notes({ document }: { readonly document: BlockNotesDocument }) {
  const editor = useBlockNotes({
    blocks: [...defaultBlocks, callout],
    initialDocument: document,
    ai: aiAdapter,
    onChange: (operations, document, { baseVersion }) => save(operations, document),
  });
  return <BlockNotesEditor editor={editor} aiMode="popover" />;
}
```

See the [root README](../../README.md) for defining blocks, writing an AI adapter and the operations reference.

### `useBlockNotes(options)`

| Option | Description |
| --- | --- |
| `blocks` | Block types. Defaults to `defaultBlocks`: paragraph, headings, bulleted and numbered lists, quote and code. |
| `inlines` | Custom inline element types. |
| `initialDocument` | Document to start with. An invalid document throws `InvalidDocumentError`. |
| `editable` | `false` for read-only mode. Can change at any time. |
| `locale`, `messages` | Language of the UI (`"en"` or `"es"`) and overrides of any string. Can change at any time. |
| `onChange(operations, document, meta)` | Batches of edits, debounced by `changeDebounceMs` (500 ms). `meta.baseVersion` is the `baseVersion` option. |
| `baseVersion`, `changeDebounceMs` | Version forwarded in `onChange`, and the debounce delay. |
| `ai`, `aiContext`, `onAiStart`, `onAiFinish`, `onAiError` | The AI adapter, how its context is built, and AI callbacks. |
| `shortcuts` | Keyboard shortcuts. See [Keyboard shortcuts](#keyboard-shortcuts). |

It returns the editor instance: `getDocument()`, `applyOperations()`, `flushChanges()`, `commands`, `ai` (AI state and actions), `registry`, `messages` and `tiptap` (the underlying Tiptap editor, `null` until it mounts).

### `<BlockNotesEditor />`

| Prop | Description |
| --- | --- |
| `editor` | The instance returned by `useBlockNotes()`. |
| `aiMode` | `"popover"` (next to the cursor, the default) or `"chat"` (a bar at the bottom with the request history). |
| `theme` | `"system"` (default), `"light"` or `"dark"`. See [Light and dark themes](#light-and-dark-themes). |
| `components` | Replaces or hides the built-in slash menu and AI UI. See [Custom UI components](#custom-ui-components). |
| `className`, `contentClassName`, `aiPopoverClassName`, `aiChatClassName`, `askAiClassName` | Class names of each part. |

### Blocks with inline content

Custom blocks render `<BlockContent />` where their editable text goes:

```tsx
render: () => <BlockContent as="blockquote" className="callout" />,
```

Blocks with `content: "none"` render their own UI and change their props with `updateProps()`. `useBlockView()` returns the state of the current block inside its render.

## Light and dark themes

The optional base styles (`import "@useblocknotes/react/styles.css"`) include a light and a dark theme. Every color uses CSS [`light-dark()`](https://developer.mozilla.org/docs/Web/CSS/color_value/light-dark), so it follows the `color-scheme` of `.bn-root`. This needs Chrome 123+, Safari 17.5+ or Firefox 120+.

The theme is chosen in this order:

1. The `theme` prop: `"light"` or `"dark"` sets `data-bn-theme` on `.bn-root` and forces that theme.
2. With `theme="system"` (the default), the `--bn-color-scheme` variable on `.bn-root` or an ancestor, for example `dark` or `light`.
3. Otherwise the operating system preference (`prefers-color-scheme`).

```tsx
<BlockNotesEditor editor={editor} theme={isDark ? "dark" : "light"} />
```

```css
/* Or follow your app's own dark mode class */
.dark {
  --bn-color-scheme: dark;
}
```

The editor paints its own background (`--bn-background`). Set `--bn-background: transparent` to show the page behind it.

Override any color for both themes with `light-dark()`, or with a single value for both:

```css
.bn-root {
  --bn-accent-color: light-dark(#7c3aed, #a78bfa);
}
```

| Variable | Light | Dark |
| --- | --- | --- |
| `--bn-text-color` | `#18181b` | `#f4f4f5` |
| `--bn-background` | `#ffffff` | `#18181b` |
| `--bn-accent-color` | `#2563eb` | `#60a5fa` |
| `--bn-accent-contrast` (text on the accent) | `#ffffff` | `#0b1220` |
| `--bn-error-color` | `#dc2626` | `#f87171` |
| `--bn-menu-background` | `#ffffff` | `#27272a` |
| `--bn-menu-shadow` | `0 8px 24px rgb(0 0 0 / 12%)` | `0 8px 24px rgb(0 0 0 / 48%)` |

Muted text, borders, hover and code backgrounds are mixed from the text or accent color, so they follow the theme too (`--bn-muted-color`, `--bn-code-background`, `--bn-menu-border-color`, `--bn-menu-active-background`, `--bn-ai-highlight`, `--bn-ai-message-background`). `--bn-menu-color` defaults to `--bn-text-color` and `--bn-ai-error-color` to `--bn-error-color`.

## Keyboard shortcuts

Every shortcut can be changed or turned off with the `shortcuts` option of `useBlockNotes()`, read once on mount. Pass `false` to turn them all off, or an object to change only some actions: one key, several keys, or `false` for none.

```tsx
const editor = useBlockNotes({
  shortcuts: {
    openAi: "Mod-k",
    moveBlockUp: false,
    toggleBold: ["Mod-b", "Mod-Shift-b"],
  },
});
```

Keys use ProseMirror notation: modifiers joined with `-` before a `KeyboardEvent.key` name, for example `Mod-Shift-ArrowUp`. `Mod` is Cmd on macOS and Ctrl elsewhere; the other modifiers are `Shift`, `Alt`, `Ctrl` and `Meta`. Modifiers must match exactly, so `Enter` does not match Shift+Enter.

| Action | Default | Command |
| --- | --- | --- |
| `openAi` | `Mod-j` | `openAi()` |
| `moveBlockUp` / `moveBlockDown` | `Mod-Shift-ArrowUp` / `Mod-Shift-ArrowDown` | `moveBlockUp()` / `moveBlockDown()` |
| `indent` / `outdent` (list items) | `Tab` / `Shift-Tab` | `indent()` / `outdent()` |
| `toggleBold`, `toggleItalic`, `toggleUnderline` | `Mod-b`, `Mod-i`, `Mod-u` | same name |
| `toggleStrike`, `toggleCode` | `Mod-Shift-s`, `Mod-e` | same name |
| `undo` / `redo` | `Mod-z` / `Mod-y`, `Mod-Shift-z` | `undo()` / `redo()` |
| `enter` | `Enter`: continues or ends lists, leaves code blocks, starts paragraphs. When off, Enter only splits the block. | |
| `backspace` | `Backspace` at the start of a block: outdents list items, turns blocks into paragraphs. When off, Backspace only joins blocks. | |
| `slashMenuUp` / `slashMenuDown` | `ArrowUp` / `ArrowDown` | `select()`, `highlight()` and `close()` in the slash menu state |
| `slashMenuSelect` | `Enter`, `Tab` | |
| `slashMenuClose` | `Escape` | |
| `aiSubmit` | `Enter` in the built-in AI prompt | `editor.ai.start()` |
| `aiClose` | `Escape` in the built-in AI prompt: closes it while empty, or stops a running stream | `editor.ai.reject()`, `editor.ai.cancel()` |

### Using your own hotkey library

Turn the editor's shortcuts off and run the same actions through `editor.commands`. Each command returns `true` when it did something, and does nothing before the editor mounts or while it is read-only.

```tsx
const editor = useBlockNotes({ shortcuts: false });

useHotkeys("mod+j", () => editor.commands.openAi());
useHotkeys("mod+shift+up", () => editor.commands.moveBlockUp());
```

`editor.shortcuts` holds the resolved keys, and `matchesShortcut(event, keys)` checks a keyboard event against them, for example in a custom AI prompt.

## Custom UI components

The slash menu, the AI popover, the AI chat bar and the "Ask AI" button can be replaced with your own components through the `components` prop of `<BlockNotesEditor />`. Omit a key to keep the built-in component, or pass `null` to render nothing. The editor keeps the logic (filtering, the slash menu keys, AI state, accept and reject) and passes it as props.

```tsx
import {
  BlockNotesEditor,
  type SlashMenuProps,
  useBlockNotes,
} from "@useblocknotes/react";

function MySlashMenu({ items, selectedIndex, select, highlight, floating }: SlashMenuProps) {
  return (
    <ul {...floating} role="listbox">
      {items.map((item, index) => (
        <li
          aria-selected={index === selectedIndex}
          key={item.key}
          onMouseDown={(event) => {
            event.preventDefault(); // keep the editor focused
            select(index);
          }}
          onMouseEnter={() => highlight(index)}
          role="option"
        >
          {item.icon} {item.label}
        </li>
      ))}
    </ul>
  );
}

<BlockNotesEditor
  editor={editor}
  components={{
    slashMenu: MySlashMenu,
    aiPopover: MyAiPopover,
    aiChatBar: MyAiChatBar,
    askAiButton: null, // hidden
  }}
/>;
```

| Key | Props | Rendered |
| --- | --- | --- |
| `slashMenu` | `SlashMenuProps`: `items`, `query`, `selectedIndex`, `select(index)`, `highlight(index)`, `close()`, `reference`, `floating` | While the `/` menu is open |
| `aiPopover` | `AiPopoverProps`: `ai`, `reference`, `floating`, `className` | While the AI prompt is open and `aiMode` is `"popover"` |
| `aiChatBar` | `AiChatBarProps`: `ai`, `className` | While an AI adapter is set and `aiMode` is `"chat"` |
| `askAiButton` | `AskAiButtonProps`: `ai`, `reference`, `floating`, `className` | While text is selected and the AI prompt is closed |

`ai` is the editor's `AiController` (`status`, `selection`, `history`, `hasChanges`, `ask()`, `start()`, `cancel()`, `accept()`, `reject()`). Read UI texts with `useMessages()`.

### Positioning

Floating components get two props:

- `floating`: `{ ref, style }`. Spread it on your root element and the editor positions it like the built-in one.
- `reference`: a virtual element (`getBoundingClientRect()`, `contextElement`) for the cursor, the selection or the AI block. Ignore `floating` and pass `reference` to your own positioning library, for example Floating UI or a Radix `Popover.Anchor virtualRef`.

A pointer down outside the editor closes the slash menu. If your slash menu renders in a portal, add `data-bn-slash-menu` to its root so clicks inside it do not close it.

### Rendering outside the editor

`useSlashMenu(editor)` returns the same slash menu state (without `floating`), or `null` while it is closed. Use it with `components={{ slashMenu: null }}` to render the menu anywhere in your tree. The built-in components (`SlashMenu`, `AiPopover`, `AiChatBar`, `AskAiButton`) are exported too, so you can wrap them.
