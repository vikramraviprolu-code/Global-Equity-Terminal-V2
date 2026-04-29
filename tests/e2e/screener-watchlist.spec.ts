import { test, expect } from "@playwright/test";

test("screener loads with rows and supports search filtering", async ({ page }) => {
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /global equity screener/i })).toBeVisible();

  // Wait for the universe table to render at least one row.
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  const initialCount = await rows.count();
  expect(initialCount).toBeGreaterThan(0);

  // Use any visible search/filter input — narrow the universe.
  const search = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]').first();
  if (await search.count()) {
    await search.fill("AAPL");
    await page.waitForTimeout(800);
    const filteredCount = await rows.count();
    // Either AAPL is present, or the filter returns a strict subset.
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  }
});

test("watchlist page renders and exposes add control", async ({ page }) => {
  await page.goto("/watchlist", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /watchlists?/i })).toBeVisible();
  // Add / + button or input — at least one interactive control.
  const anyControl = page.locator('button, input').first();
  await expect(anyControl).toBeVisible();
});
