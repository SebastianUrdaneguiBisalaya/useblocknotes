import type { JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  type Block,
  type BlockNotesDocument,
  type BlockProps,
  type InlineNode,
  type Mark,
  sortMarks,
} from "@useblocknotes/core";

/** Name of the title node, the first child of every editor document. */
export const TITLE_NODE = "title";

/** Group shared by every block node. */
export const BLOCK_GROUP = "blockNotesBlock";

const SIMPLE_MARKS: Readonly<Partial<Record<string, Mark>>> = {
  bold: {
    type: "bold",
  },
  code: {
    type: "code",
  },
  italic: {
    type: "italic",
  },
  strike: {
    type: "strike",
  },
  underline: {
    type: "underline",
  },
};

function toMark(name: string, href: string | null): Mark | null {
  if (name === "link") {
    return href === null
      ? null
      : {
          href,
          type: "link",
        };
  }
  return SIMPLE_MARKS[name] ?? null;
}

function inlineToJSON(node: InlineNode): JSONContent | null {
  if (node.type === "text" && "text" in node) {
    if (node.text === "") {
      return null;
    }
    return {
      text: node.text,
      type: "text",
      ...(node.marks !== undefined && node.marks.length > 0
        ? {
            marks: node.marks.map((mark) =>
              mark.type === "link"
                ? {
                    attrs: {
                      href: mark.href,
                    },
                    type: "link",
                  }
                : {
                    type: mark.type,
                  },
            ),
          }
        : {}),
    };
  }
  return "props" in node
    ? {
        attrs: {
          props: node.props,
        },
        type: node.type,
      }
    : null;
}

/** Converts a block to Tiptap JSON. */
export function blockToJSON(block: Block): JSONContent {
  const content = (block.content ?? []).flatMap((node) => {
    const json = inlineToJSON(node);
    return json === null
      ? []
      : [
          json,
        ];
  });
  return {
    attrs: {
      id: block.id,
      props: block.props,
    },
    type: block.type,
    ...(content.length > 0
      ? {
          content,
        }
      : {}),
  };
}

/** Converts a document to Tiptap JSON: a title node followed by the blocks. */
export function documentToJSON(document: BlockNotesDocument): JSONContent {
  return {
    content: [
      {
        type: TITLE_NODE,
        ...(document.title === ""
          ? {}
          : {
              content: [
                {
                  text: document.title,
                  type: "text",
                },
              ],
            }),
      },
      ...document.blocks.map(blockToJSON),
    ],
    type: "doc",
  };
}

function readProps(node: PMNode): BlockProps {
  const props: BlockProps | null | undefined = node.attrs["props"];
  return props ?? {};
}

/** Converts a block node of the editor to a block. */
export function nodeToBlock(node: PMNode): Block {
  const id: string | null | undefined = node.attrs["id"];
  const base = {
    id: id ?? "",
    props: readProps(node),
    type: node.type.name,
  };
  if (!node.type.isTextblock) {
    return base;
  }
  const content: InlineNode[] = [];
  node.forEach((child) => {
    if (child.isText) {
      const marks = sortMarks(
        child.marks.flatMap((mark) => {
          const href: string | null | undefined = mark.attrs["href"];
          const converted = toMark(mark.type.name, href ?? null);
          return converted === null
            ? []
            : [
                converted,
              ];
        }),
      );
      content.push({
        text: child.text ?? "",
        type: "text",
        ...(marks.length > 0
          ? {
              marks,
            }
          : {}),
      });
      return;
    }
    content.push({
      props: readProps(child),
      type: child.type.name,
    });
  });
  return {
    ...base,
    content,
  };
}

/** Converts the editor document to a document. */
export function nodeToDocument(doc: PMNode): BlockNotesDocument {
  let title = "";
  const blocks: Block[] = [];
  doc.forEach((node) => {
    if (node.type.name === TITLE_NODE) {
      title = node.textContent;
      return;
    }
    blocks.push(nodeToBlock(node));
  });
  return {
    blocks,
    title,
  };
}
