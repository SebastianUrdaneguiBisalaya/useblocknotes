import { describe, expect, test } from "bun:test";
import {
  builtInMessages,
  defaultBlocks,
  enMessages,
  esMessages,
  type Messages,
  resolveMessages,
} from "../src/index.js";

function keys(messages: Messages): string[] {
  return Object.entries(messages).flatMap(([group, values]) =>
    Object.keys(values).map((key) => `${group}.${key}`),
  );
}

describe("resolveMessages", () => {
  test("defaults to English", () => {
    expect(resolveMessages()).toEqual(enMessages);
  });

  test("selects the locale and overrides single keys", () => {
    const messages = resolveMessages("es", {
      ai: {
        askAi: "IA",
      },
    });
    expect(messages.ai.askAi).toBe("IA");
    expect(messages.ai.accept).toBe(esMessages.ai.accept);
    expect(messages.slashMenu).toEqual(esMessages.slashMenu);
  });

  test("does not mutate the built-in dictionaries", () => {
    resolveMessages("en", {
      placeholders: {
        title: "Changed",
      },
    });
    expect(enMessages.placeholders.title).toBe("Untitled");
  });
});

describe("built-in dictionaries", () => {
  test("every locale has every key, none empty", () => {
    for (const messages of Object.values(builtInMessages)) {
      expect(keys(messages)).toEqual(keys(enMessages));
      for (const group of Object.values(messages)) {
        for (const value of Object.values(group)) {
          expect(value).not.toBe("");
        }
      }
    }
  });

  test("every built-in slash entry has a message key", () => {
    const entries = defaultBlocks.flatMap((block) => block.slash ?? []);
    expect(entries.map((entry) => entry.messageKey)).toEqual([
      "paragraph",
      "heading1",
      "heading2",
      "heading3",
      "bulletListItem",
      "numberedListItem",
      "quote",
      "codeBlock",
    ]);
  });
});
