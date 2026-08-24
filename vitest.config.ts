import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    server: {
      deps: {
        // The package ships extensionless ESM relative imports; Node's
        // resolver rejects them, Vite's handles them.
        inline: [/@tredespace\/ui/],
      },
    },
  },
});
