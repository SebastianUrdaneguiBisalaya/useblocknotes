# @useblocknotes/react

React 19 components and hooks for useblocknotes.

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
