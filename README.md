# useblocknotes

An open-source (MIT) Notion-style block editor built on [Tiptap](https://tiptap.dev) core, with AI responses streamed live into the editor.

- **Blocks as JSON.** A document is `{ title, blocks }`. Every block has a stable `id`, a `type` and typed props validated with [Zod](https://zod.dev).
- **Your own blocks.** Add block types with `defineBlock()`: a schema, a React render, plain text and Markdown for AI context, and an optional PDF render. They appear in the `/` slash menu.
- **AI, streamed live.** Users ask AI with `/ai`, `Mod-J` or "Ask AI" on a selection. The response is written into the document as it streams, highlighted, and accepted or rejected as one undo step.
- **Bring your own AI provider.** The library never calls an AI SDK or API. You give it an adapter, an async function that yields stream events, and you choose the model, the server and the keys.
- **Operations.** Every edit, manual or from AI, is an operation (`insert`, `update`, `delete`, `move`, `set_title`) that you can save, replay or send to a server.
- **Local PDF export**, in the browser or in Node.
- **English and Spanish built in.** Every UI string can be overridden.
- **No imposed styles.** Optional base styles with light and dark themes, driven by CSS variables.

Out of scope for now: real-time collaboration, persistence, authentication and AI provider calls. These stay in the host app.

## Packages

| Package | Description |
| --- | --- |
| [`@useblocknotes/core`](packages/core) | Framework-free logic: document model, operations, block registry, AI stream processing, context functions and i18n. |
| [`@useblocknotes/react`](packages/react) | `<BlockNotesEditor />` and `useBlockNotes()` for React 19. |
| [`@useblocknotes/pdf`](packages/pdf) | Optional `exportPdf()` built on `@react-pdf/renderer`. |

## Installation

```sh
npm install @useblocknotes/core @useblocknotes/react zod
# Optional PDF export
npm install @useblocknotes/pdf
```

`react` and `react-dom` 19 and `zod` 4 are peer dependencies, so your app keeps a single copy of each.

## Quick start

```tsx
import { BlockNotesEditor, useBlockNotes } from "@useblocknotes/react";
import "@useblocknotes/react/styles.css"; // optional base styles

export function Notes() {
  const editor = useBlockNotes({
    initialDocument: { title: "Notes", blocks: [] },
    onChange: (operations, document) => save(document),
  });
  return <BlockNotesEditor editor={editor} />;
}
```

Type `/` to open the slash menu. Without the stylesheet the editor is unstyled: style the `bn-*` classes and `data-bn-*` attributes yourself, or pass `className`.

## Document model

```ts
const document: BlockNotesDocument = {
  title: "Notes",
  blocks: [
    { id: "b1", type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Goals" }] },
    {
      id: "b2",
      type: "paragraph",
      props: {},
      content: [
        { type: "text", text: "Ship " },
        { type: "text", text: "v1", marks: [{ type: "bold" }] },
      ],
    },
  ],
};
```

- `content` holds inline content (text with `bold`, `italic`, `underline`, `strike`, `code` and `link` marks, plus custom inline elements) and is present only on blocks with `content: "inline"`.
- Built-in blocks: `paragraph`, `heading`, `bulletListItem`, `numberedListItem`, `quote` and `code`.
- `validateDocument(raw, registry)` checks a document from storage or the network and returns a typed result.
- `createBlockId()` creates a unique id for new blocks.

## Defining a block

A block is a type, a Zod schema for its props, whether it holds inline content, a plain text form, and a render. This callout holds editable text and has a `tone` prop:

```tsx
import { type BlockRenderProps, defineBlock } from "@useblocknotes/core";
import { BlockContent, defaultBlocks, useBlockNotes } from "@useblocknotes/react";
import type { ReactNode } from "react";
import * as z from "zod";

const calloutSchema = z.object({ tone: z.enum(["info", "warning"]) });
type CalloutProps = z.infer<typeof calloutSchema>;

function Callout({ block }: BlockRenderProps<"callout", CalloutProps>): ReactNode {
  return (
    <div className="callout" data-tone={block.props.tone}>
      {/* The editable inline content of the block */}
      <BlockContent />
    </div>
  );
}

export const callout = defineBlock<"callout", CalloutProps, ReactNode>({
  type: "callout",
  schema: calloutSchema,
  content: "inline",
  render: (props) => <Callout {...props} />,
  toText: (block, context) => context.text(block.content),
  toMarkdown: (block, context) => `> ${context.markdown(block.content)}`,
  slash: [{ label: "Callout", keywords: ["note", "info"], defaultProps: { tone: "info" } }],
});

const editor = useBlockNotes({ blocks: [...defaultBlocks, callout] });
```

- `content: "none"` blocks keep all their data in props. Their render gets `editable` and `updateProps(props)` to change them, for example a chart or a table.
- `toText` is used for AI context, search and the PDF fallback. `toMarkdown` defaults to `toText`.
- `toPdf` renders the block in PDF exports. Without it, the block is exported as a paragraph of its `toText`.
- Custom inline elements (for example citations or mentions) are defined the same way with `defineInline()` and passed in `inlines`.

## Connecting an AI adapter

The editor calls your adapter with a request and renders the events it yields:

```ts
interface AiRequest {
  instruction: string; // what the user asked for
  selection: { blockIds: string[]; text: string } | null;
  anchorBlockId: string | null; // block that had the cursor
  context: string; // document outline and the selection as Markdown
  signal: AbortSignal; // aborted when the user cancels
}

type AiStreamEvent =
  | { type: "operation"; operation: InsertOperation | UpdateOperation | DeleteOperation | MoveOperation }
  | { type: "text_delta"; blockId: string; delta: string };
```

`operation` events change blocks; `text_delta` events append text to a block, usually one the stream just inserted. Every event is validated at runtime, so you can yield parsed JSON as is. Invalid events stop the stream with a typed error, and the document is never left half-applied: the user accepts or rejects the whole response.

### With the Vercel AI SDK

Stream text from your server with the [AI SDK](https://ai-sdk.dev) and map it to events on the client. The AI SDK runs in your app; useblocknotes does not depend on it.

```ts
// app/api/ai/route.ts (server)
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function POST(request: Request) {
  const { instruction, context } = await request.json();
  const result = streamText({
    model: openai("gpt-4.1-mini"),
    system: `You write content for a document. Reply in plain text.\n\n${context}`,
    prompt: instruction,
    abortSignal: request.signal,
  });
  return result.toTextStreamResponse();
}
```

```ts
// adapter.ts (client)
import { type AiAdapter, createBlockId } from "@useblocknotes/core";

export const aiAdapter: AiAdapter = async function* ({ instruction, context, anchorBlockId, selection, signal }) {
  const response = await fetch("/api/ai", {
    method: "POST",
    body: JSON.stringify({ instruction, context }),
    signal,
  });
  if (!response.ok || response.body === null) throw new Error("AI request failed");

  // Write the answer into a new paragraph after the selection or the cursor.
  const blockId = createBlockId();
  const afterId = selection?.blockIds.at(-1) ?? anchorBlockId;
  yield {
    type: "operation",
    operation: { op: "insert", afterId, block: { id: blockId, type: "paragraph", props: {}, content: [] } },
  };

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield { type: "text_delta", blockId, delta: value };
  }
};
```

```tsx
const editor = useBlockNotes({ ai: aiAdapter });
```

To let the model create several blocks, headings or lists, ask it for structured output (for example one JSON event per line) and yield each parsed line.

### With any async iterable

An adapter is any function that returns an async iterable, so it also works with server-sent events, WebSockets, a job queue or a local model. This adapter reads newline-delimited JSON events from your own endpoint:

```ts
import type { AiAdapter } from "@useblocknotes/core";

export const aiAdapter: AiAdapter = async function* (request) {
  const response = await fetch("/api/ai-events", {
    method: "POST",
    body: JSON.stringify({ instruction: request.instruction, context: request.context }),
    signal: request.signal,
  });
  if (!response.ok || response.body === null) throw new Error("AI request failed");

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim() !== "") yield JSON.parse(line);
  }
};
```

```jsonl
{"type":"operation","operation":{"op":"insert","afterId":"b2","block":{"id":"ai-1","type":"heading","props":{"level":2},"content":[]}}}
{"type":"text_delta","blockId":"ai-1","delta":"Summary"}
{"type":"operation","operation":{"op":"update","id":"b2","content":[{"type":"text","text":"Rewritten paragraph."}]}}
```

### AI options

| Option | Description |
| --- | --- |
| `ai` | The adapter. Enables `/ai`, `Mod-J` and the "Ask AI" button. |
| `aiContext(document, selection)` | Builds the `context` string. Defaults to `outline()` of the document plus the selected blocks and one neighbor on each side as Markdown. |
| `onAiStart(request)` | Called when a request is sent to the adapter. |
| `onAiFinish(state)` | Called when the stream ends, before the user accepts or rejects. |
| `onAiError(error)` | Called when the stream fails (not when the user cancels). |

`<BlockNotesEditor aiMode="popover" | "chat" />` shows the prompt next to the cursor or as a chat bar at the bottom with the request history. In-flight streams are aborted when the editor unmounts.

## Operations and events

Every change is an operation:

| Operation | Shape | Effect |
| --- | --- | --- |
| `insert` | `{ op: "insert", afterId, block }` | Inserts `block` after `afterId`, or at the start when `afterId` is `null`. |
| `update` | `{ op: "update", id, type?, props?, content? }` | Without `type`, merges `props` and replaces `content` when given. With `type`, replaces the block and keeps its id. |
| `delete` | `{ op: "delete", id }` | Deletes a block. |
| `move` | `{ op: "move", id, afterId }` | Moves a block after `afterId`, or to the start. |
| `set_title` | `{ op: "set_title", title }` | Sets the document title. |

`applyOperations(document, operations, { registry })` is pure and all-or-nothing. It returns `{ ok: true, value }` with the new document, or `{ ok: false, error }` with a typed error (`invalid_operation`, `unknown_block`, `unknown_anchor`, `duplicate_block_id`, `invalid_move`, `invalid_block`) and the index of the operation that failed. It never throws for invalid input. `diffDocuments(before, after)` returns the operations that turn one document into the other.

### Editor events and methods

| Option or method | Description |
| --- | --- |
| `onChange(operations, document, { baseVersion })` | Called with each batch of edits (typed, pasted, dragged or applied) after `changeDebounceMs` (500 ms by default) without edits, on blur, on `flushChanges()` and on unmount. |
| `baseVersion` | The version the host last saved, forwarded in `onChange` to detect conflicts. |
| `editor.getDocument()` | The current document, without a pending AI response. |
| `editor.applyOperations(operations)` | Applies operations from outside (for example from a server) as one undo step. Returns the same typed result. |
| `editor.flushChanges()` | Emits pending changes to `onChange` now. |
| `editor.commands` | Runs the actions that have keyboard shortcuts from your own UI or hotkey library. |

## Context functions

Pure helpers in `@useblocknotes/core` to build prompts or summaries:

```ts
import { outline, pick, toMarkdown } from "@useblocknotes/core";

outline(document, registry);
// # Notes
// [b1] ## Goals
// [b2] paragraph: Ship v1

toMarkdown(document, registry); // the whole document as Markdown
toMarkdown(pick(document, ["b2"], { neighbors: 1 }), registry); // a block and its neighbors
```

`editor.registry` holds the registered blocks. Outside React, build one with `createRegistry({ blocks })`.

## Localization

All UI strings come from `locale` and `messages`. English (`"en"`) and Spanish (`"es"`) are built in, and any string can be overridden by group and key:

```tsx
useBlockNotes({
  locale: "es",
  messages: { ai: { askAi: "Pregúntale a la IA" } },
});
```

Both options can change at any time. `useMessages()` returns the resolved strings inside custom components. `enMessages`, `esMessages` and `resolveMessages()` are exported from `@useblocknotes/core` to start a new language.

## PDF export

```ts
import { exportPdf } from "@useblocknotes/pdf";

const result = await exportPdf(editor.getDocument(), { locale: "es" });
if (result.ok) {
  const url = URL.createObjectURL(result.value);
  Object.assign(document.createElement("a"), { href: url, download: "notes.pdf" }).click();
  URL.revokeObjectURL(url);
}
```

Export runs locally with `@react-pdf/renderer`, in the browser or in Node, with no external service. Each block uses its `toPdf`, or a paragraph of its `toText`. Pass your custom blocks with `blocks: [...defaultPdfBlocks, callout]`. See the [`@useblocknotes/pdf` README](packages/pdf/README.md).

## Styling

Import `@useblocknotes/react/styles.css` for base styles with light and dark themes, or skip it and style everything yourself. Every value is a `--bn-*` CSS variable, and components accept `className`. The built-in slash menu and AI components can be replaced with your own. See the [`@useblocknotes/react` README](packages/react/README.md).

## Dependencies and licenses

Every runtime dependency is free and open source, and compatible with closed-source apps.

| Package | Used by | License |
| --- | --- | --- |
| [`@tiptap/core`, `@tiptap/react`, `@tiptap/pm`, `@tiptap/extensions`, `@tiptap/suggestion` and the `@tiptap/extension-*` marks](https://github.com/ueberdosis/tiptap) | `react` | MIT |
| [ProseMirror](https://prosemirror.net) (through `@tiptap/pm`) | `react` | MIT |
| [`@floating-ui/dom`](https://github.com/floating-ui/floating-ui) | `react` | MIT |
| [`@react-pdf/renderer`](https://github.com/diegomura/react-pdf) | `pdf` | MIT |
| [`react`, `react-dom`](https://github.com/facebook/react) (peer) | `react`, `pdf` | MIT |
| [`zod`](https://github.com/colinhacks/zod) (peer) | all | MIT |

No paid, Pro or cloud packages are used (no `@tiptap-pro/*`, Tiptap Cloud or `@blocknote/xl-*`).

## Storybook

`storybook/` is an offline playground with example blocks (a chart and a table), a mock AI adapter and every editor option:

```sh
bun install
bun run storybook
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities as described in [SECURITY.md](SECURITY.md). This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
