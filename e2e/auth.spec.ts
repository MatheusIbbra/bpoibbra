import { test, expect } from "@playwright/test";

test("pagina auth abre", async ({ page }) => {
  await page.goto("/auth");
  await expect(page).toHaveURL(/auth/);
});