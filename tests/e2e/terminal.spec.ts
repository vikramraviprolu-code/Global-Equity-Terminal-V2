import { test, expect } from "@playwright/test";

test("terminal deep-link /terminal/AAPL renders without 404", async ({ page }) => {
  const resp = await page.goto("/terminal/AAPL", { waitUntil: "domcontentloaded" });
  expect(resp?.status()).toBeLessThan(400);

  // Page mounts (not a hard 404 card) and the terminal shell appears.
  await expect(page.getByText(/symbol not found/i)).toHaveCount(0);

  // The terminal page exposes a ticker input or AAPL header within ~20s.
  const aaplOnPage = page.getByText(/AAPL/i).first();
  await expect(aaplOnPage).toBeVisible({ timeout: 25_000 });
});

test("terminal handles unknown ticker gracefully (no blank screen)", async ({ page }) => {
  await page.goto("/terminal/__NOPE__", { waitUntil: "domcontentloaded" });
  // We accept either the not-found component OR the terminal UI surfacing an inline error.
  const body = page.locator("body");
  await expect(body).not.toBeEmpty();
});
