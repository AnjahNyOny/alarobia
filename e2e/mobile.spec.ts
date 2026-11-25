import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test("mobile : pas de défilement horizontal, menu utilisable", async ({ page }) => {
  const check = watchErrors(page);
  for (const url of ["/", "/products", "/products/veste-sully-en-cuir", "/cart", "/help"]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `défilement horizontal sur ${url}`).toBeLessThanOrEqual(0);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page.getByRole("link", { name: "Maison", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Maison" })).toBeVisible();
  check();
});

test("mobile : le tableau des zones de livraison tient dans l'écran", async ({ page }) => {
  await page.goto("/help");
  const table = page.locator("#livraison table");
  await expect(table).toBeVisible();
  const box = await table.evaluate((el) => {
    const c = el.parentElement!;
    return { container: c.scrollWidth - c.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(box.container, "défilement horizontal du tableau").toBeLessThanOrEqual(0);
  expect(box.page, "défilement horizontal de la page").toBeLessThanOrEqual(0);
});
