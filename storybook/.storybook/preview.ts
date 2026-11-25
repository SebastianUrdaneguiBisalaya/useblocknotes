import type { Preview } from "@storybook/react-vite";
import "@useblocknotes/react/styles.css";
import "../src/playground.css";

const preview: Preview = {
  parameters: {
    layout: "padded",
  },
};

export default preview;
