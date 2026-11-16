import { expect, test } from "@playwright/test";
import { ADMIN, login, watchErrors } from "./helpers";

// Produits et rayon choisis parce qu'aucune autre spec ne les vérifie (base partagée, rechargée une fois au début).
// Thé noir Matinée : traduit en anglais ; en malgache, les caractéristiques manquent.

test.beforeEach(async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
});

test("traduction d'un produit : onglets de langue, compteur à traduire, nom anglais visible en boutique", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/admin/products?q=Thé noir Matinée");
  const row = page.getByRole("row", { name: /Thé noir Matinée/ });
  await expect(row).toContainText("À traduire : mg");
  await row.getByRole("link", { name: "Thé noir Matinée", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Thé noir Matinée" })).toBeVisible();

  const english = page.getByRole("tab", { name: /English/ });
  const malagasy = page.getByRole("tab", { name: /Malagasy/ });
  await expect(english).not.toContainText("à traduire");
  await expect(malagasy).toContainText("1 à traduire");

  // Clavier : les flèches passent d'un onglet à l'autre.
  await page.getByRole("tab", { name: "Français" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(english).toBeFocused();
  await expect(english).toHaveAttribute("aria-selected", "true");
  const name = page.getByLabel("Nom du produit (anglais)");
  await expect(name).toBeVisible();
  // Le français reste sous les yeux du traducteur.
  await expect(page.getByRole("tabpanel").getByText("Thé noir Matinée", { exact: true })).toBeVisible();

  // Le compteur suit la saisie.
  const tagline = page.getByLabel("Accroche (anglais)");
  await tagline.fill("");
  await expect(english).toContainText("1 à traduire");
  await tagline.fill("Whole leaf, 100 g tin");
  await expect(english).not.toContainText("à traduire");

  await name.fill("Morning black tea");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/admin\/products(\?|$)/);

  await page.goto("/en/products/the-noir-matinee");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Morning black tea");
  await page.goto("/mg/products/the-noir-matinee");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dite mainty Matinée");
  // En malgache, les caractéristiques non traduites restent en français.
  await expect(page.getByRole("region", { name: "Toetoetra" }).getByRole("listitem").first()).toHaveText("Thé noir en feuilles entières");
  check();
});

test("une erreur dans un onglet fermé ouvre cet onglet", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/admin/products/new");
  await page.getByRole("tab", { name: /Malagasy/ }).click();
  // Le nom français, requis, est vide dans l'onglet fermé : le navigateur bloque l'envoi et l'onglet s'ouvre.
  await page.getByRole("button", { name: "Créer le produit" }).click();
  await expect(page.getByRole("tab", { name: "Français" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Nom du produit", { exact: true })).toBeVisible();

  // Erreur renvoyée par le serveur sur un champ malgache (trop long) : l'onglet malgache s'ouvre et l'erreur se lit.
  await page.getByLabel("Nom du produit", { exact: true }).fill("Natte en vondro");
  await page.getByLabel("Description", { exact: true }).fill("Une natte tressée pour le sol, à poser partout.");
  await page.getByLabel(/Prix de vente/).fill("15 000");
  await page.getByLabel("Référence (SKU)").fill("AL-TEST-NATTE");
  await page.getByLabel("Catégorie").selectOption({ label: "Maison" });
  await page.getByRole("tab", { name: /Malagasy/ }).click();
  // maxlength protège la saisie au clavier ; on le retire pour simuler un envoi qui le contourne.
  const mgName = page.getByLabel("Nom du produit (malgache)");
  await mgName.evaluate((el) => el.removeAttribute("maxlength"));
  await mgName.fill("a".repeat(121));
  await page.getByRole("tab", { name: "Français" }).click();
  await page.getByRole("button", { name: "Créer le produit" }).click();
  await expect(page.getByRole("tab", { name: /Malagasy/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /Malagasy/ })).toContainText("à corriger");
  await expect(page.getByText("120 caractères au maximum.")).toBeVisible();
  await expect(page.getByLabel("Nom du produit", { exact: true })).toHaveValue("Natte en vondro");
  check();
});

test("rendre un produit personnalisable : validation, puis couleurs proposées sur la fiche", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/products/portefeuille-marius");
  await expect(page.getByRole("tab", { name: "Personnaliser" })).toHaveCount(0);

  await page.goto("/admin/products?q=Portefeuille Marius");
  await page.getByRole("link", { name: "Portefeuille Marius", exact: true }).click();
  await expect(page.getByLabel("Longueur maximale du texte")).toBeHidden();
  await page.getByLabel("Gabarit").selectOption({ label: "Carnet" });
  await page.getByLabel("Longueur maximale du texte").fill("20");
  await page.getByLabel(/Supplément d'impression/).fill("2 000");
  await page.getByLabel("Le client peut ajouter une image").check();

  // Aucune couleur cochée : refus du serveur, la saisie reste.
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Cochez au moins une couleur.")).toBeVisible();
  await expect(page.getByLabel("Gabarit")).toHaveValue("carnet");
  await expect(page.getByLabel("Longueur maximale du texte")).toHaveValue("20");
  await expect(page.getByLabel(/Supplément d'impression/)).toHaveValue("2 000");

  const colors = page.getByRole("group", { name: "Couleurs proposées" });
  await colors.getByLabel("Indigo").check();
  await colors.getByLabel("Latérite").check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/admin\/products(\?|$)/);

  await page.goto("/products/portefeuille-marius");
  await page.getByRole("tab", { name: "Personnaliser" }).click();
  const swatches = page.locator("input[name=couleur]");
  await expect(swatches).toHaveCount(2);
  expect(await swatches.evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value))).toEqual(["laterite", "indigo"]);
  // Texte autorisé (20 caractères) : le champ est proposé.
  await expect(page.getByLabel("Votre texte")).toBeVisible();
  await expect(page.getByText("0 / 20")).toBeVisible();
  check();
});

test("une catégorie reçoit un nom anglais, visible dans la navigation en anglais", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/admin/categories");
  await page.getByRole("link", { name: "Modifier Soin" }).click();
  await expect(page.getByRole("heading", { name: "Modifier « Soin »" })).toBeVisible();
  const english = page.getByRole("tab", { name: /English/ });
  await english.click();
  await page.getByLabel("Nom (anglais)").fill("Body care");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Catégorie modifiée.")).toBeVisible();

  await page.goto("/en");
  await expect(page.getByRole("navigation", { name: "Aisles" }).getByRole("link", { name: "Body care" })).toBeVisible();
  check();
});

test("les textes du back-office ne sont envoyés qu'aux pages du back-office", async ({ page }) => {
  // La clé figure dans les messages sérialisés pour le fournisseur client (charge RSC incluse dans le HTML).
  const marker = "fallbackNote";
  await page.goto("/admin/products/new");
  expect(await page.content()).toContain(marker);
  for (const url of ["/fr", "/en/products/the-noir-matinee", "/mg/products?category=soin"]) {
    await page.goto(url);
    // Témoin : les messages de la boutique, eux, sont bien là.
    const html = await page.content();
    expect(html, url).toContain("customizer");
    expect(html, url).not.toContain(marker);
  }
});
