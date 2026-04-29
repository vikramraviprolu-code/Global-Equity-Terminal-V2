import { test, expect, type Page } from "@playwright/test";

// Track console errors per page; benign network noise gets filtered.
async function attachConsoleSpy(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = msg.text();
    // Ignore common noise that does not affect the regression signal.
    if (/(Failed to load resource|favicon|net::ERR_|429|503)/.test(t)) return;
    errors.push(t);
  });
  return errors;
}

const PUBLIC_ROUTES: { path: string; h1: RegExp }[] = [
  { path: "/", h1: /(equity|stock|terminal|invest|research)/i },
  { path: "/app", h1: /global equity screener/i },
  { path: "/compare", h1: /compare stocks/i },
  { path: "/watchlist", h1: /watchlists?/i },
  { path: "/events", h1: /events calendar/i },
  { path: "/data-quality", h1: /data quality/i },
  { path: "/sources", h1: /data sources/i },
  { path: "/changelog", h1: /changelog/i },
  { path: "/settings", h1: /settings/i },
];

for (const r of PUBLIC_ROUTES) {
  test(`renders public route ${r.path}`, async ({ page }) => {
    const errors = await attachConsoleSpy(page);
    const resp = await page.goto(r.path, { waitUntil: "domcontentloaded" });
    expect(resp?.status(), `HTTP status for ${r.path}`).toBeLessThan(400);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("h1").first()).toContainText(r.h1);
    expect(errors, `console errors on ${r.path}`).toEqual([]);
  });
}
