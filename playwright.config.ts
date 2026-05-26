import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const requireExternalSandbox = process.env.E2E_REQUIRE_BASE_URL === "1";

if (requireExternalSandbox && !process.env.E2E_BASE_URL) {
  throw new Error(
    "E2E_REQUIRE_BASE_URL=1 requires E2E_BASE_URL. For Lovable/TanStack SSR, run Playwright against a deployed Lovable preview or sandbox URL instead of vite preview.",
  );
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Lovable/TanStack SSR output does not reliably run under `vite preview`.
        // For local smoke tests use the dev server; for production-like testing set
        // E2E_BASE_URL to a Lovable preview/sandbox deployment URL.
        command: `npm run dev -- --host 0.0.0.0 --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
