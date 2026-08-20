import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pkg: { version: string } = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves from a subpath, so all asset URLs must be relative,
  // and the deployed site is whatever `docs/` contains on the default branch.
  base: "./",
  build: {
    outDir: "docs",
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
