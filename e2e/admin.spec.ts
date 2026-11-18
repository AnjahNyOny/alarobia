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
    ["/admin/shipping", "Livraison"],
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
  // exact : les champs traduits des onglets English et Malagasy s'appellent « Nom du produit (anglais) »…
  await page.getByLabel("Nom du produit", { exact: true }).fill("Plaid Test en laine");
  await page.getByLabel("Description", { exact: true }).fill("Un plaid de démonstration créé par le test automatique.");
  await page.getByLabel(/Prix de vente/).fill("59 900");
  await page.getByLabel("Référence (SKU)").fill("AL-TEST-001");
  await page.getByLabel("Quantité en stock").fill("7");
  await page.getByLabel("Catégorie").selectOption({ label: "Maison" });
  // Erreur de validation côté serveur : le message s'affiche et la saisie est conservée.
  await page.getByLabel(/Prix barré/).fill("10 000");
  await page.getByRole("button", { name: "Créer le produit" }).click();
  await expect(page.getByText("Le prix barré doit être supérieur au prix de vente.")).toBeVisible();
  await expect(page.getByLabel("Nom du produit", { exact: true })).toHaveValue("Plaid Test en laine");
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

test("zones de livraison : création, validation, visible à la commande, la dernière zone ouverte est protégée", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/admin/shipping");
  await page.getByLabel("Nom", { exact: true }).fill("Nosy Be");
  await page.getByLabel(/Tarif/).fill("20 000");
  await page.getByLabel("Délai minimal").fill("7");
  await page.getByLabel("Délai maximal").fill("4");
  await page.getByRole("button", { name: "Créer la zone" }).click();
  await expect(page.getByText("Le délai maximal ne peut pas être plus court que le délai minimal.")).toBeVisible();
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue("Nosy Be");
  await page.getByLabel("Délai minimal").fill("4");
  await page.getByLabel("Délai maximal").fill("7");
  await page.getByRole("button", { name: "Créer la zone" }).click();
  await expect(page.getByText("Zone créée.")).toBeVisible();
  await expect(page.getByRole("row", { name: /Nosy Be/ })).toContainText("20 000 Ar");

  // Côté boutique : la zone est proposée, sans traduction elle garde son nom français.
  await page.goto("/products/tasse-en-gres-vato");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible();
  await page.goto("/mg/checkout");
  await page.getByRole("radio", { name: /Nosy Be/ }).check();
  await expect(page.getByText("32 000 Ar")).toBeVisible();
  await page.goto("/fr/help");
  await expect(page.getByRole("row", { name: /Nosy Be/ })).toContainText("4 à 7 jours ouvrés");

  // Suppression : la zone disparaît ; on ne peut pas fermer la boutique par mégarde en supprimant la dernière zone ouverte.
  await page.goto("/admin/shipping");
  for (const name of ["Nosy Be", "Autres localités", "Grandes villes de province", "Environs d'Antananarivo"]) {
    await page.getByRole("button", { name: `Supprimer ${name}` }).click();
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(page.getByText("Zone supprimée.").last()).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Supprimer Antananarivo ville" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText(/C'est la seule zone ouverte/)).toBeVisible();
  await expect(page.getByRole("row", { name: /Antananarivo ville/ })).toHaveCount(1);
  check();
});

// Point de vigilance 8, côté vendeur : le filtre de la liste des produits ignore les majuscules.
test("la recherche des produits ignore les majuscules", async ({ page }) => {
  await page.goto("/admin/products?q=TASSE");
  await expect(page.getByRole("row", { name: /Tasse en grès Vato/ })).toBeVisible();
});
