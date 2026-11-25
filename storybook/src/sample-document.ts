import type { BlockNotesDocument } from "@useblocknotes/core";

/** The document every story starts with, using the five example blocks. */
export const sampleDocument: BlockNotesDocument = {
  blocks: [
    {
      content: [
        {
          text: "Quarterly review",
          type: "text",
        },
      ],
      id: "title",
      props: {},
      type: "headline",
    },
    {
      content: [
        {
          text: "Everything here runs offline, including AI and PDF export.",
          type: "text",
        },
      ],
      id: "subtitle",
      props: {},
      type: "subtitle",
    },
    {
      content: [
        {
          text: "Type ",
          type: "text",
        },
        {
          marks: [
            {
              type: "code",
            },
          ],
          text: "/",
          type: "text",
        },
        {
          text: " for blocks or ",
          type: "text",
        },
        {
          marks: [
            {
              type: "code",
            },
          ],
          text: "/ai",
          type: "text",
        },
        {
          text: " to ask the mock AI. Select text and click ",
          type: "text",
        },
        {
          marks: [
            {
              type: "bold",
            },
          ],
          text: "Ask AI",
          type: "text",
        },
        {
          text: " to rewrite it.",
          type: "text",
        },
      ],
      id: "intro",
      props: {},
      type: "paragraph",
    },
    {
      id: "table",
      props: {
        rows: [
          [
            "Region",
            "Q1",
            "Q2",
          ],
          [
            "North",
            "120",
            "140",
          ],
          [
            "South",
            "90",
            "115",
          ],
        ],
      },
      type: "table",
    },
    {
      id: "chart",
      props: {
        data: [
          {
            label: "Q1",
            value: 210,
          },
          {
            label: "Q2",
            value: 255,
          },
          {
            label: "Q3",
            value: 230,
          },
        ],
        kind: "bar",
      },
      type: "chart",
    },
    {
      content: [
        {
          text: "Try “add a table” or “draw a chart” as AI instructions.",
          type: "text",
        },
      ],
      id: "outro",
      props: {},
      type: "paragraph",
    },
  ],
  title: "Playground",
};
