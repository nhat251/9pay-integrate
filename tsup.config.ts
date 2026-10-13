import { defineConfig } from "tsup";

const external = ["next", "react", "react-dom", "@nestjs/common", "@nestjs/config"];

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    external,
    outDir: "dist",
  },
  {
    entry: {
      "next/index": "src/next/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: false,
    external,
    outDir: "dist",
  },
  {
    entry: {
      "nest/index": "src/nest/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: false,
    external,
    outDir: "dist",
  },
]);
