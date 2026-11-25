# @useblocknotes/react

React 19 components and hooks for useblocknotes.

## Custom UI components

The slash menu, the AI popover, the AI chat bar and the "Ask AI" button can be replaced with your own components through the `components` prop of `<BlockNotesEditor />`. Omit a key to keep the built-in component, or pass `null` to render nothing. The editor keeps the logic (filtering, arrow keys, Enter and Tab in the slash menu, AI state, accept and reject) and passes it as props.

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
