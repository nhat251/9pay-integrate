import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    external: ["next", "react", "react-dom"],
    outDir: "dist",
  },
  {
    entry: {
      "next/index": "src/next/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: false,
    external: ["next", "react", "react-dom"],
    outDir: "dist",
  },
]);
