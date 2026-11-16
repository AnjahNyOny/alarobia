import { expect, test, type Page } from "@playwright/test";
import { ADMIN, expectAccessible, login } from "./helpers";

// Même analyse axe qu'en `accessibilite.spec.ts`, sur téléphone (Pixel 7), plus la taille des cibles tactiles :
// la règle `target-size` d'axe (WCAG 2.2, critère 2.5.8 : 24 × 24 px CSS, ou assez d'espace autour) n'est pas
// dans les critères 2.0 et 2.1, on la demande à part sur chaque écran.
// Produit mis au panier : le sac à dos Transit, qu'aucun autre parcours ne vérifie.

async function check(page: Page, where: string) {
  await expectAccessible(page, where);
  await expectAccessible(page, `${where}, cibles tactiles`, { rules: ["target-size"] });
}

test("boutique sur téléphone : écrans principaux et menu ouvert", async ({ page }) => {
  await page.goto("/fr");
  await check(page, "accueil");

  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await expect(page.getByRole("dialog").getByRole("navigation", { name: "Menu" })).toBeVisible();
  await check(page, "menu de la boutique ouvert");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/fr/products");
  await page.getByText("Filtrer", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Appliquer" })).toBeVisible();
  await check(page, "catalogue, filtres dépliés");

  await page.goto("/fr/products/tasse-en-gres-vato");
  await check(page, "fiche personnalisable");
  await page.getByRole("tab", { name: "Personnaliser" }).click();
  await expect(page.locator('[data-view="3d"] canvas')).toBeVisible();
  await check(page, "fiche personnalisable, onglet Personnaliser");

  await page.goto("/fr/products/sac-a-dos-transit");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible();
  await page.goto("/fr/cart");
  await check(page, "panier rempli");
  await page.goto("/fr/checkout");
  await check(page, "commande");
});

test("back-office sur téléphone : tableau de bord et menu ouvert", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await check(page, "tableau de bord");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await expect(page.getByRole("dialog").getByRole("navigation", { name: "Administration" })).toBeVisible();
  await check(page, "menu du back-office ouvert");
});
