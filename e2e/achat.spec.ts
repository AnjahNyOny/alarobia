import { expect, test } from "@playwright/test";
import { ADMIN, login, watchErrors } from "./helpers";

test.describe.configure({ mode: "serial" });

test("achat invité : panier, code promo, validation du formulaire, confirmation", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/products/casque-studio-one");
  await page.getByRole("button", { name: "Augmenter la quantité" }).click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible();
  await page.getByRole("link", { name: "Voir le panier" }).click();
  await page.waitForURL("**/cart");

  await page.getByLabel("Code promo").fill("NIMPORTE");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("n'existe pas")).toBeVisible();
  await page.getByLabel("Code promo").fill("bienvenue10");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("BIENVENUE10").first()).toBeVisible();

  await page.getByRole("link", { name: "Passer la commande" }).click();
  await page.waitForURL("**/checkout");
  await page.getByLabel("Adresse e-mail").fill("test.invite@example.com");
  await page.getByLabel("Nom complet").fill("Test Invité");
  await page.getByLabel("Adresse", { exact: true }).fill("1 rue du Test");
  await page.getByLabel("Code postal").fill("75001");
  await page.getByLabel("Ville").fill("Paris");
  await page.getByLabel("Téléphone").fill("abc");
  await page.getByRole("button", { name: /Payer et commander/ }).click();
  await expect(page.getByText("Numéro de téléphone invalide.")).toBeVisible();
  // La saisie est conservée après l'erreur : seul le champ fautif est à corriger.
  await expect(page.getByLabel("Ville")).toHaveValue("Paris");

  await page.getByLabel("Téléphone").fill("06 11 22 33 44");
  await page.getByText("Express", { exact: true }).click();
  await page.getByRole("button", { name: /Payer et commander/ }).click();
  await page.waitForURL(/\/order\/c/);
  await expect(page.getByRole("heading", { name: /votre commande est enregistrée/ })).toBeVisible();
  // 2 × 350 000 Ar − 10 % + 10 000 Ar d'express
  await expect(page.getByText("640 000 Ar")).toBeVisible();
  check();
});

test("le stock a baissé et l'administrateur expédie la commande", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto("/admin/orders?q=test.invite");
  await page.getByRole("link", { name: /^SV-/ }).first().click();
  await page.waitForURL(/\/admin\/orders\/c/);
  await page.getByLabel("Statut").selectOption("SHIPPED");
  await page.getByLabel("Numéro de suivi").fill("6A00011122233");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Commande mise à jour.")).toBeVisible();

  await page.goto("/admin/products?q=Casque Studio");
  await expect(page.getByRole("row", { name: /Casque Studio One/ })).toContainText("18");
  check();
});
