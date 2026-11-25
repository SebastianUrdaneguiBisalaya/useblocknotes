import { fileURLToPath } from "node:url";
import { defineMain } from "@storybook/react-vite/node";

const packages = fileURLToPath(new URL("../../packages", import.meta.url));

/** Workspace packages resolved to their source, so no build is needed. */
const alias = [
  {
    find: /^@useblocknotes\/react\/styles\.css$/,
    replacement: `${packages}/react/src/styles.css`,
  },
  {
    find: /^@useblocknotes\/(core|react|pdf)$/,
    replacement: `${packages}/$1/src/index.ts`,
  },
];

export default defineMain({
  addons: [],
  core: {
    // Fully offline: no telemetry, update checks or "what's new" requests.
    disableTelemetry: true,
    disableWhatsNewNotifications: true,
  },
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  stories: [
    "../src/**/*.stories.tsx",
  ],
  viteFinal: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias,
    },
  }),
});
