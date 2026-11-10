import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pkg: { version: string } = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves from a subpath (and previews from /preview/ below it),
  // so all asset URLs must be relative. CI publishes `dist/` to the `livedemo`
  // branch — see .github/workflows/deploy.yml.
  base: "./",
  build: {
    outDir: "dist",
  },
  define: {
    // CI sets APP_VERSION for dev previews (e.g. 0.1.39-next.57).
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || pkg.version),
  },
});
