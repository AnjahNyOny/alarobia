import { expect, test, type Page } from "@playwright/test";
import { ADMIN, CLIENT, expectAccessible, login, CART_ADD_TIMEOUT } from "./helpers";

// Analyse axe (WCAG 2.0 et 2.1, A et AA) de chaque page, au repos et dans les états où se cachent les défauts :
// tiroir ouvert, personnalisation, formulaire refusé, onglet de langue. Les adresses portent toujours leur langue
// (une visite en /en ou /mg change la langue des adresses sans préfixe).
// Produit acheté : le sac à dos Transit (40 en stock), qu'aucun autre parcours ne vérifie.

const SAC = "/fr/products/sac-a-dos-transit";
const TASSE = "/fr/products/tasse-en-gres-vato";

/** Remplit l'adresse de livraison (par sélecteurs : ce fichier vérifie le rendu, pas la saisie au clavier). */
async function fillAddress(page: Page, email: string) {
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Nom complet").fill("Voahangy Rasoa");
  await page.getByLabel("Téléphone", { exact: true }).fill("034 22 333 44");
  await page.getByLabel("Adresse ou lot").fill("Lot IVG 8");
  await page.getByLabel("Quartier").fill("Isotry");
  await page.getByLabel("Ville", { exact: true }).fill("Antananarivo");
  await page.getByLabel("Province", { exact: true }).selectOption("Antananarivo");
}

test("boutique sans session : chaque page au repos", async ({ page }) => {
  const pages: [string, string][] = [
    ["accueil", "/fr"],
    ["catalogue", "/fr/products"],
    ["recherche avec résultats", "/fr/products?q=tasse"],
    ["recherche sans résultat", "/fr/products?q=zzzzintrouvable"],
    ["rayon", "/fr/products?category=cuisine"],
    ["fiche produit", SAC],
    ["fiche personnalisable", TASSE],
    ["panier vide", "/fr/cart"],
    ["connexion", "/fr/login"],
    ["inscription", "/fr/register"],
    ["aide", "/fr/help"],
    ["à propos", "/fr/about"],
    ["mentions légales", "/fr/legal"],
  ];
  for (const [name, path] of pages) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expectAccessible(page, name);
  }
  const missing = await page.goto("/fr/cette-page-n-existe-pas");
  expect(missing?.status()).toBe(404);
  await expectAccessible(page, "page 404");
});

test("connexion refusée : le message d'erreur est accessible", async ({ page }) => {
  await login(page, CLIENT.email, "mauvais");
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  await expectAccessible(page, "connexion refusée");
});

test("panier, commande refusée puis acceptée, confirmation Mobile Money", async ({ page }) => {
  await page.goto(SAC);
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible({ timeout: CART_ADD_TIMEOUT });
  await expectAccessible(page, "tiroir du panier ouvert");
  await page.keyboard.press("Escape");

  await page.goto("/fr/cart");
  await expectAccessible(page, "panier rempli");

  await page.goto("/fr/checkout");
  await expectAccessible(page, "commande");

  // Le navigateur bloquerait l'envoi (champs requis) : on le laisse passer pour voir les erreurs du serveur sur chaque champ.
  await page.locator("form", { has: page.getByRole("button", { name: "Valider la commande" }) }).evaluate((form: HTMLFormElement) => (form.noValidate = true));
  await page.getByRole("button", { name: "Valider la commande" }).click();
  await expect(page.getByLabel("Nom complet")).toHaveAttribute("aria-invalid", "true");
  // Chaque erreur est reliée à son champ.
  for (const label of ["Adresse e-mail", "Nom complet", "Adresse ou lot", "Quartier"]) {
    const field = page.getByLabel(label, { exact: true });
    await expect(field, label).toHaveAttribute("aria-invalid", "true");
    await expect(field, label).toHaveAccessibleDescription(/.+/);
  }
  await expectAccessible(page, "commande refusée");

  await fillAddress(page, "voahangy.a11y@example.com");
  await page.getByRole("radio", { name: /MVola/ }).check();
  await page.getByRole("button", { name: "Valider la commande" }).click();
  await page.waitForURL(/\/fr\/order\/c/);
  await expect(page.getByRole("region", { name: "Paiement MVola" })).toBeVisible();
  await expectAccessible(page, "confirmation de commande");
});

test("personnalisation de la tasse : 3D puis à plat", async ({ page }) => {
  await page.goto(TASSE);
  await page.getByRole("tab", { name: "Personnaliser" }).click();
  // Le cadre « 3d » existe avant la scène : on attend le canevas lui-même (CLAUDE.md, « Pièges connus »).
  // Aucune exclusion : axe ne voit du canevas que son élément, et le cadre doit porter un nom.
  await expect(page.locator('[data-view="3d"]')).toHaveAccessibleName(/.+/);
  // Le contenu d'un canevas WebGL échappe à axe ; son cadre porte un nom (role="img") et la vue à plat sert d'alternative.
  await expect(page.locator('[data-view="3d"] canvas')).toBeVisible();
  await page.getByLabel("Votre texte").fill("Anjah");
  await expectAccessible(page, "personnalisation en 3D");
  await page.getByRole("button", { name: "Voir à plat" }).click();
  await expect(page.locator('[data-view="flat"]')).toBeVisible();
  await expectAccessible(page, "personnalisation à plat");
});

test("espace client", async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.waitForURL("**/account");
  await expectAccessible(page, "compte");
  const order = await page.locator('a[href*="/account/orders/"]').first().getAttribute("href");
  expect(order).toBeTruthy();
  await page.goto(order!);
  await expectAccessible(page, "commande du client");
  await page.goto("/fr/account/profile");
  await expectAccessible(page, "profil");
  await page.goto("/fr/account/wishlist");
  await expectAccessible(page, "favoris");
});

// Back-office : un test par groupe de pages, pour que le nom du test en échec dise où chercher
// (et qu'aucun ne frôle le délai de 60 s quand la machine est chargée).
test.describe("back-office", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.waitForURL("**/admin");
  });

  async function checkPages(page: Page, pages: [string, string][]) {
    for (const [name, path] of pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectAccessible(page, `admin ${name}`);
    }
  }

  test("activité : tableau de bord, commandes et détail, clients et fiche, lettre d'information", async ({ page }) => {
    await checkPages(page, [
      ["tableau de bord", "/fr/admin"],
      ["commandes", "/fr/admin/orders"],
      ["clients", "/fr/admin/customers"],
      ["lettre d'information", "/fr/admin/newsletter"],
    ]);
    await page.goto("/fr/admin/orders");
    await page.goto((await page.locator('a[href*="/admin/orders/c"]').first().getAttribute("href"))!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessible(page, "admin détail d'une commande");

    await page.goto("/fr/admin/customers");
    await page.goto((await page.locator('a[href*="/admin/customers/c"]').first().getAttribute("href"))!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessible(page, "admin fiche client");
  });

  test("catalogue : produits, nouveau produit, catégories, avis", async ({ page }) => {
    await checkPages(page, [
      ["produits", "/fr/admin/products"],
      ["nouveau produit", "/fr/admin/products/new"],
      ["catégories", "/fr/admin/categories"],
      ["avis", "/fr/admin/reviews"],
    ]);
  });

  test("fiche produit, puis son onglet malgache", async ({ page }) => {
    await page.goto("/fr/admin/products?q=Tasse en grès Vato");
    await page.getByRole("link", { name: "Tasse en grès Vato", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tasse en grès Vato" })).toBeVisible();
    await expectAccessible(page, "admin fiche produit");
    await page.getByRole("tab", { name: /Malagasy/ }).click();
    await expect(page.getByRole("tab", { name: /Malagasy/ })).toHaveAttribute("aria-selected", "true");
    await expectAccessible(page, "admin fiche produit, onglet malgache");
  });

  test("boutique : livraison, codes promo, réglages", async ({ page }) => {
    await checkPages(page, [
      ["livraison", "/fr/admin/shipping"],
      ["codes promo", "/fr/admin/promotions"],
      ["réglages", "/fr/admin/settings"],
    ]);
  });
});

test("anglais et malgache : accueil, fiche personnalisable, commande", async ({ page }) => {
  // Un article dans le panier, sans quoi la commande renvoie au panier.
  await page.goto(SAC);
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible({ timeout: CART_ADD_TIMEOUT });
  try {
    for (const locale of ["en", "mg"] as const) {
      for (const path of ["", "/products/tasse-en-gres-vato", "/checkout"]) {
        await page.goto(`/${locale}${path}`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expectAccessible(page, `${locale}${path || " accueil"}`);
      }
    }
  } finally {
    await page.goto("/fr");
  }
});
