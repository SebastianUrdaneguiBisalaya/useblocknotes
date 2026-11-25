import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Playground } from "../playground.js";

const meta = {
  args: {
    aiMode: "popover",
    customUi: false,
    editable: true,
    externalHotkeys: false,
    locale: "en",
    onAiError: fn(),
    onAiFinish: fn(),
    onAiStart: fn(),
    onChange: fn(),
    pdf: false,
  },
  argTypes: {
    aiMode: {
      control: "inline-radio",
      options: [
        "popover",
        "chat",
      ],
    },
    locale: {
      control: "inline-radio",
      options: [
        "en",
        "es",
      ],
    },
  },
  component: Playground,
  title: "Playground",
} satisfies Meta<typeof Playground>;

export default meta;

type Story = StoryObj<typeof meta>;

/** AI prompt in a popover next to the cursor (`/ai`, `Mod-J` or "Ask AI"). */
export const AiPopover: Story = {};

/** AI prompt in a bar fixed at the bottom, with the request history. */
export const AiChatBar: Story = {
  args: {
    aiMode: "chat",
  },
};

/** Exports the current document to PDF, locally, and previews it. */
export const PdfExport: Story = {
  args: {
    pdf: true,
  },
};

/**
 * Custom slash menu, AI popover and "Ask AI" button passed with the
 * `components` prop. The editor keeps the logic and positioning.
 */
export const CustomUi: Story = {
  args: {
    customUi: true,
  },
};

/**
 * Editor shortcuts turned off with `shortcuts: false`, and host hotkeys
 * (Alt-based) calling `editor.commands`, as a hotkey library would.
 */
export const ExternalHotkeys: Story = {
  args: {
    externalHotkeys: true,
  },
};

/** Built-in Spanish texts. */
export const Spanish: Story = {
  args: {
    locale: "es",
  },
};

/** Read-only mode: no drag handles, slash menu or inputs. */
export const ReadOnly: Story = {
  args: {
    editable: false,
  },
};
