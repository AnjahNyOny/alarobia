import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test("mobile : pas de défilement horizontal, menu utilisable", async ({ page }) => {
  const check = watchErrors(page);
  for (const url of ["/", "/produits", "/produits/perfecto-sully-en-cuir", "/panier", "/aide"]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `défilement horizontal sur ${url}`).toBeLessThanOrEqual(0);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page.getByRole("link", { name: "Mode", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mode" })).toBeVisible();
  check();
});
