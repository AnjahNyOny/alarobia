import { expect, test } from "@playwright/test";
import { ADMIN, login, watchErrors } from "./helpers";

test("annonce : une version par langue, le français sert de repli", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto("/fr/admin/settings");
  const french = page.getByLabel("Bandeau d'annonce");
  const english = page.getByLabel(/^En anglais/);
  const save = async () => {
    await page.getByRole("button", { name: "Enregistrer les réglages" }).click();
    await expect(page.getByText("Réglages enregistrés.")).toBeVisible();
  };
  const frenchText = await french.inputValue();
  // Texte d'origine de l'annonce anglaise, remis à la fin pour les autres parcours (base partagée).
  const originalEnglish = await english.inputValue();
  expect(frenchText).not.toBe("");

  try {
    await english.fill("Test banner in English");
    await save();
    await page.goto("/en");
    await expect(page.getByText("Test banner in English")).toBeVisible();
    await page.goto("/fr");
    await expect(page.getByText(frenchText, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Test banner in English")).toHaveCount(0);

    // Champ vidé : l'anglais retombe sur le français.
    await page.goto("/fr/admin/settings");
    await english.fill("");
    await save();
    await page.goto("/en");
    await expect(page.getByText(frenchText, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Test banner in English")).toHaveCount(0);
  } finally {
    await page.goto("/fr/admin/settings");
    await english.fill(originalEnglish);
    await save();
  }
  check();
});

test("réglages et livraison : l'interface passe en anglais et en malgache", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto("/en/admin/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save settings" })).toBeVisible();
  await page.goto("/en/admin/shipping");
  await expect(page.getByRole("heading", { level: 1, name: "Delivery" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create zone" })).toBeVisible();
  await page.goto("/mg/admin/shipping");
  await expect(page.getByRole("heading", { level: 1, name: "Fanaterana" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hamorona ny faritra" })).toBeVisible();
  check();
});
