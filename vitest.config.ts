import { defineConfig } from "vitest/config";
import path from "node:path";

// Standalone config — Vitest must not load the app's TanStack vite.config.ts.
export default defineConfig({
  configFile: false as unknown as undefined,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    globals: true,
    css: false,
  },
});
