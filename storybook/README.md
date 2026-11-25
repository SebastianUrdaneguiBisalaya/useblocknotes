# useblocknotes playground

An offline [Storybook](https://storybook.js.org) to try `@useblocknotes/core`, `@useblocknotes/react` and `@useblocknotes/pdf`. It is private and never published.

```sh
bun install
bun run storybook        # http://localhost:6006
bun run build-storybook  # static build in storybook/dist
```

The workspace packages are resolved to their source (see `.storybook/main.ts`), so there is nothing to build first. Telemetry, update checks and "what's new" requests are disabled, and the AI adapter is a mock: everything works without a network connection.

## Stories

- **AI popover** and **AI chat bar**: both AI modes with the mock adapter.
- **PDF export**: exports the current document with `exportPdf()` and previews it.
- **Spanish** and **Read only**: built-in locale and read-only mode.

Every story has controls for the AI mode, locale and read-only mode, and logs `onChange`, `onAiStart`, `onAiFinish` and `onAiError` in the Actions panel.

## Example blocks

Defined with `defineBlock()` in `src/blocks`, each with an editor render and a PDF render:

| Block | Type | Content |
| --- | --- | --- |
| Title | `headline` (`title` is reserved for the document title) | inline |
| Subtitle | `subtitle` | inline |
| Paragraph | `paragraph` | inline |
| Table | `table` | props: `rows` |
| Chart | `chart` (rendered with [Recharts](https://recharts.org)) | props: `kind`, `data` |

The built-in lists, quote and code blocks are also registered.

## Mock AI adapter

`createMockAdapter()` in `src/mock-adapter.ts` streams scripted events with a small delay, so live preview, cancel, accept and reject can be tried offline:

- With a selection, it rewrites the selected blocks.
- Without one, it writes after the cursor: a table or a chart when the instruction mentions "table" or "chart", paragraphs otherwise.
- An instruction containing "error" ends with an invalid event, to try `onAiError`.
