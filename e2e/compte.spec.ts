import { expect, test } from "@playwright/test";
import { login, watchErrors } from "./helpers";

test("inscription, favori, avis, puis accès refusé au back-office", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/register");
  await page.getByLabel("Nom complet").fill("Alice Martin");
  await page.getByLabel("Adresse e-mail").fill(`alice.${Date.now()}@example.com`);
  await page.getByLabel("Mot de passe").fill("motdepasse1");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/account");

  await page.goto("/products/bougie-veillee");
  await page.getByRole("button", { name: /Ajouter Bougie Veillée aux favoris/ }).click();
  await page.getByRole("button", { name: "5 étoiles sur 5" }).click();
  await page.getByLabel("Votre avis").fill("Parfum discret et très agréable, tient longtemps.");
  await page.getByRole("button", { name: "Publier mon avis" }).click();
  await expect(page.getByText("Merci, votre avis est publié.")).toBeVisible();

  await page.goto("/account/wishlist");
  await expect(page.getByRole("link", { name: "Bougie Veillée" })).toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/fr$/);
  check();
});

test("mot de passe incorrect : message générique, sans vider l'e-mail", async ({ page }) => {
  await login(page, "client@seve.example", "mauvais");
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  await expect(page.getByLabel("Adresse e-mail")).toHaveValue("client@seve.example");
});

test("un client ne peut pas lire la commande d'un autre", async ({ page }) => {
  await page.goto("/account/orders/inexistante");
  await expect(page).toHaveURL(/login/);
});
