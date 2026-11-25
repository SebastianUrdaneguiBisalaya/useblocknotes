# @useblocknotes/core

Framework-free logic of [useblocknotes](https://github.com/SebastianUrdaneguiBisalaya/useblocknotes): the document model, operations, block registry, AI stream processing, context functions and i18n. It has no React or DOM dependency and runs in the browser, Node, Bun and workers.

Use it directly on a server (to validate, apply or summarize documents) or through [`@useblocknotes/react`](../react).

## Installation

```sh
npm install @useblocknotes/core zod
```

`zod` 4 is a peer dependency.

## Document

```ts
import type { BlockNotesDocument } from "@useblocknotes/core";

const document: BlockNotesDocument = {
  title: "Notes",
  blocks: [{ id: "b1", type: "paragraph", props: {}, content: [{ type: "text", text: "Hello" }] }],
};
```

A document is plain, serializable JSON. Every block has a stable `id`, a `type` and `props`. Blocks with `content: "inline"` also hold `content`: text nodes with `bold`, `italic`, `underline`, `strike`, `code` and `link` marks, plus custom inline elements.

## Blocks and registry

```ts
import { createRegistry, defaultBlocks, defineBlock } from "@useblocknotes/core";
import * as z from "zod";

const callout = defineBlock({
  type: "callout",
  schema: z.object({ tone: z.enum(["info", "warning"]) }),
  content: "inline",
  toText: (block, context) => context.text(block.content),
});

const registry = createRegistry({ blocks: [...defaultBlocks, callout] });
```

- `defaultBlocks`: `paragraph`, `heading` (levels 1 to 3), `bulletListItem`, `numberedListItem`, `quote` and `code`.
- `defineBlock()` and `defineInline()` only type the definition. The render type is a generic (`ReactNode` in `@useblocknotes/react`).
- `createRegistry()` throws a `RegistryError` when a type is duplicated or reserved (`RESERVED_TYPES`).

## Validation

```ts
import { validateDocument } from "@useblocknotes/core";

const result = validateDocument(JSON.parse(raw), registry);
if (result.ok) use(result.value);
else console.error(result.error); // ValidationIssue[] with paths
```

It checks the shape, unique ids, known block and inline types, every block's props against its schema, and that only inline blocks hold content.

## Operations

```ts
import { applyOperations, diffDocuments } from "@useblocknotes/core";

const result = applyOperations(document, [
  { op: "insert", afterId: "b1", block: { id: "b2", type: "heading", props: { level: 2 }, content: [] } },
  { op: "update", id: "b1", content: [{ type: "text", text: "Hi" }] },
  { op: "move", id: "b2", afterId: null },
  { op: "delete", id: "b1" },
  { op: "set_title", title: "Renamed" },
], { registry });

if (result.ok) save(result.value);
else console.error(result.error.code, result.error.index);

const operations = diffDocuments(before, after); // applying them to `before` yields `after`
```

`applyOperations()` is pure and all-or-nothing: it never mutates the input and returns the first error without applying anything. Errors are a discriminated union: `invalid_operation`, `unknown_block`, `unknown_anchor`, `duplicate_block_id`, `invalid_move` and `invalid_block`.

## AI streams

`processAiStream()` consumes the async iterable returned by an `AiAdapter`, validates each event and applies it to a preview of the document. `@useblocknotes/react` uses it internally; call it yourself to run AI edits outside the editor, for example on a server.

```ts
import { processAiStream } from "@useblocknotes/core";

const result = await processAiStream(adapter(request), {
  document,
  registry,
  signal,
  onUpdate: (state) => preview(state.document),
});
if (result.ok) accept(result.value.operations); // apply them with applyOperations()
```

Events are `{ type: "operation", operation }` (`insert`, `update`, `delete` or `move`) and `{ type: "text_delta", blockId, delta }`. Errors are typed (`invalid_event`, `rejected_operation`, `unknown_block`, `aborted`, `stream_failed`) and carry the last valid state. See [Connecting an AI adapter](../../README.md#connecting-an-ai-adapter).

## Context functions

```ts
import { outline, pick, toMarkdown } from "@useblocknotes/core";

outline(document, registry, { maxLineLength: 80 }); // title plus one line per block with its id
toMarkdown(document, registry); // Markdown of the document
toMarkdown(pick(document, ["b2"], { neighbors: 1 }), registry); // Markdown of some blocks
```

All three are pure and use each block's `toText` and `toMarkdown`.

## i18n

```ts
import { resolveMessages } from "@useblocknotes/core";

const messages = resolveMessages("es", { ai: { askAi: "Pregúntale a la IA" } });
```

`enMessages` and `esMessages` hold every UI string. `Locale` is `"en" | "es"`.

## License

[MIT](LICENSE)
