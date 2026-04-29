import { test, expect } from "@playwright/test";

test("/portfolio redirects unauthenticated user to /auth", async ({ page }) => {
  await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
  // Either redirected to /auth or auth gate is rendered inline.
  await page.waitForLoadState("networkidle").catch(() => {});
  const url = page.url();
  const onAuth = /\/auth/.test(url);
  const inlineAuthGate = await page.getByText(/sign in|log in|please sign/i).first().isVisible().catch(() => false);
  expect(onAuth || inlineAuthGate).toBeTruthy();
});

test("/alerts is auth-gated", async ({ page }) => {
  await page.goto("/alerts", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const url = page.url();
  const onAuth = /\/auth/.test(url);
  const inlineAuthGate = await page.getByText(/sign in|log in|please sign/i).first().isVisible().catch(() => false);
  expect(onAuth || inlineAuthGate).toBeTruthy();
});

test("/auth shows sign-in form", async ({ page }) => {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  // Email input + submit button are the universal anchors for any auth UI.
  await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 15_000 });
});
