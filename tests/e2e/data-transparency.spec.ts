import { test, expect } from "@playwright/test";

test("sources page explains keyed, zero-key, historical, and demo data semantics", async ({ page }) => {
  const resp = await page.goto("/sources", { waitUntil: "domcontentloaded" });
  expect(resp?.status()).toBeLessThan(400);

  await expect(page.getByRole("heading", { name: /data sources/i })).toBeVisible();
  await expect(page.getByText(/zero-key mode/i)).toBeVisible();
  await expect(page.getByText(/historical\/EOD/i)).toBeVisible();
  await expect(page.getByText(/demo\/mock/i)).toBeVisible();
  await expect(page.getByText(/never presented as real-time/i)).toBeVisible();
});
