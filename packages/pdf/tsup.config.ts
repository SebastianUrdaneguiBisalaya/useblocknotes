import { defineConfig } from "tsup";

export default defineConfig({
  bundle: true,

  clean: true,

  dts: {
    // tsup's dts build sets `baseUrl` internally, which TypeScript 6 deprecates.
    compilerOptions: {
      ignoreDeprecations: "6.0",
    },
    resolve: true,
  },
  entry: {
    index: "src/index.ts",
  },

  external: [
    "@react-pdf/renderer",
    "@useblocknotes/core",
    "react",
    "react/jsx-runtime",
  ],

  format: [
    "esm",
    "cjs",
  ],

  minify: false,

  outDir: "dist",

  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".cjs",
    };
  },

  // Runs in browsers and Node; react-pdf picks its own build per platform.
  platform: "neutral",

  skipNodeModulesBundle: true,

  sourcemap: true,

  splitting: false,

  target: "es2022",

  treeshake: true,

  tsconfig: "tsconfig.build.json",
});
