import { expect, test } from "@playwright/test";

test("la racine redirige vers la langue du navigateur", async ({ browser }) => {
  for (const [locale, expected] of [["fr-FR", "/fr"], ["en-GB", "/en"], ["mg-MG", "/mg"], ["de-DE", "/fr"]] as const) {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page, `navigateur en ${locale}`).toHaveURL(new RegExp(`${expected}$`));
    await expect(page.locator("html")).toHaveAttribute("lang", expected.slice(1));
    await context.close();
  }
});

test("une zone protégée renvoie vers la connexion dans la même langue", async ({ page }) => {
  await page.goto("/mg/admin/orders");
  await expect(page).toHaveURL(/\/mg\/login\?next=%2Fadmin%2Forders$/);
  await page.goto("/en/account");
  await expect(page).toHaveURL(/\/en\/login\?next=%2Faccount$/);
});

test("une adresse inconnue affiche la page 404 de la boutique", async ({ page }) => {
  const response = await page.goto("/fr/cette-page-n-existe-pas");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
});
