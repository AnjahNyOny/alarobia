import path from "node:path";
import { expect, test } from "@playwright/test";
import { ADMIN, login, watchErrors } from "./helpers";

test.beforeEach(async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
});

test("toutes les pages du back-office s'affichent", async ({ page }) => {
  const check = watchErrors(page);
  for (const [url, title] of [
    ["/admin", "Tableau de bord"],
    ["/admin/orders", "Commandes"],
    ["/admin/products", "Produits"],
    ["/admin/products/new", "Nouveau produit"],
    ["/admin/categories", "Catégories"],
    ["/admin/customers", "Clients"],
    ["/admin/promotions", "Codes promo"],
    ["/admin/reviews", "Avis clients"],
    ["/admin/settings", "Réglages"],
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  }
  check();
});

test("création d'un produit avec photo, visible en boutique", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/admin/products/new");
  await page.getByLabel("Nom du produit").fill("Plaid Test en laine");
  await page.getByLabel("Description").fill("Un plaid de démonstration créé par le test automatique.");
  await page.getByLabel(/Prix de vente/).fill("59 900");
  await page.getByLabel("Référence (SKU)").fill("SV-TEST-001");
  await page.getByLabel("Quantité en stock").fill("7");
  await page.getByLabel("Catégorie").selectOption({ label: "Maison" });
  // Erreur de validation côté serveur : le message s'affiche et la saisie est conservée.
  await page.getByLabel(/Prix barré/).fill("10 000");
  await page.getByRole("button", { name: "Créer le produit" }).click();
  await expect(page.getByText("Le prix barré doit être supérieur au prix de vente.")).toBeVisible();
  await expect(page.getByLabel("Nom du produit")).toHaveValue("Plaid Test en laine");
  await page.getByLabel(/Prix barré/).fill("");

  await page.locator("input[type=file]").setInputFiles(path.join(process.cwd(), "public/products/plante.jpg"));
  await expect(page.getByText("Principale")).toBeVisible();
  await page.getByRole("button", { name: "Créer le produit" }).click();
  await page.waitForURL(/\/admin\/products(\?|$)/);

  await page.goto("/products/plaid-test-en-laine");
  await expect(page.getByRole("heading", { level: 1, name: "Plaid Test en laine" })).toBeVisible();
  await expect(page.getByText("59 900 Ar").first()).toBeVisible();
  check();
});
