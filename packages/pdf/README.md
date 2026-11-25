# @useblocknotes/pdf

Optional PDF export for [useblocknotes](https://github.com/SebastianUrdaneguiBisalaya/useblocknotes) documents, built on [`@react-pdf/renderer`](https://github.com/diegomura/react-pdf) (MIT). Export runs locally, in the browser or in Node, with no external service.

## Installation

```sh
npm install @useblocknotes/pdf @useblocknotes/core react zod
```

`@useblocknotes/core`, `react` 19 and `zod` 4 are peer dependencies.

## Export a document

```ts
import { exportPdf } from "@useblocknotes/pdf";

const result = await exportPdf(editor.getDocument(), { locale: "es" });
if (result.ok) {
  const url = URL.createObjectURL(result.value);
  Object.assign(document.createElement("a"), { href: url, download: "notes.pdf" }).click();
  URL.revokeObjectURL(url);
} else {
  console.error(result.error); // { code: "invalid_document", issues } or { code: "render_failed", message }
}
```

`exportPdf()` validates the document, renders it and returns a `Blob` (`application/pdf`). In Node, write `Buffer.from(await result.value.arrayBuffer())` to a file or a response.

| Option | Description |
| --- | --- |
| `blocks` | Block types. Defaults to `defaultPdfBlocks`: the built-in blocks with PDF renders. |
| `inlines` | Custom inline element types. |
| `locale` | Language of the PDF metadata and of the fallback title of an untitled document. Defaults to `"en"`. |
| `styles` | Overrides of `defaultPdfStyles`, merged per key (`page`, `title`, `paragraph`, `heading1`, `listItem`, `code`, `link` and more). |

`documentToPdf(document, options)` builds the react-pdf element without rendering it, for example to preview it in react-pdf's `<PDFViewer>`.

## Custom blocks

Each block is exported with its `toPdf`. Blocks without `toPdf` become a paragraph of their `toText`, so every block appears in the PDF.

```tsx
import { Text, View } from "@react-pdf/renderer";
import type { Block } from "@useblocknotes/core";
import {
  defaultPdfBlocks,
  exportPdf,
  type PdfBlockDefinition,
  PdfInline,
  usePdfRender,
} from "@useblocknotes/pdf";

function CalloutPdf({ block }: { readonly block: Block }) {
  const { styles } = usePdfRender();
  return (
    <View style={{ padding: 8, backgroundColor: "#eff6ff" }}>
      <Text style={styles.paragraph}>
        <PdfInline content={block.content} />
      </Text>
    </View>
  );
}

// `callout` is the block definition used in the editor.
const calloutPdf: PdfBlockDefinition = { ...callout, toPdf: (block) => <CalloutPdf block={block} /> };

await exportPdf(document, { blocks: [...defaultPdfBlocks, calloutPdf] });
```

- `PdfInline` renders inline content with its marks and custom inline elements.
- `usePdfRender()` returns the registry and the resolved styles.
- `usePdfBlock()` returns per-block state, such as the number of a numbered list item.
- `paragraphPdf`, `headingPdf`, `bulletListItemPdf`, `numberedListItemPdf`, `quotePdf` and `codePdf` are exported to reuse or wrap.

## License

[MIT](LICENSE)
