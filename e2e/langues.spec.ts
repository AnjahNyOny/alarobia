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

test("le titre et la description du site suivent la langue", async ({ page }) => {
  for (const [locale, title, description] of [
    ["fr", "Alarobia — Objets du quotidien, livrés à Madagascar", /livré partout à Madagascar/],
    ["en", "Alarobia — Everyday things, delivered across Madagascar", /delivered anywhere in Madagascar/],
    ["mg", "Alarobia — Entana isan'andro, aterina manerana an'i Madagasikara", /manerana an'i Madagasikara/],
  ] as const) {
    await page.goto(`/${locale}`);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", description);
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

test("changer de langue pendant la commande conserve le panier, le code promo et la saisie", async ({ page }) => {
  await page.goto("/fr/products/gourde-isotherme-foret");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible();
  await page.goto("/fr/cart");
  await page.getByLabel("Code promo").fill("BIENVENUE10");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("BIENVENUE10").first()).toBeVisible();

  await page.goto("/fr/checkout");
  await page.getByLabel("Nom complet").fill("Rakoto Jean");
  await page.getByLabel("Ville", { exact: true }).fill("Antsirabe");
  await page.getByLabel("Province", { exact: true }).selectOption("Antananarivo");
  await page.getByLabel("Note pour la livraison").fill("Sonner deux fois");

  await page.getByRole("contentinfo").getByRole("link", { name: "Malagasy" }).click();
  await expect(page).toHaveURL(/\/mg\/checkout$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "mg");
  // Les libellés de l'adresse passent en malgache, la saisie reste.
  await expect(page.getByLabel("Anarana feno")).toHaveValue("Rakoto Jean");
  await expect(page.getByLabel("Tanàna", { exact: true })).toHaveValue("Antsirabe");
  await expect(page.getByLabel("Faritany")).toHaveValue("Antananarivo");
  await expect(page.getByRole("radio", { name: /Antananarivo renivohitra/ })).toBeVisible();
  await expect(page.getByLabel("Hafatra ho an'ny mpanatitra")).toHaveValue("Sonner deux fois");
  // Le récapitulatif passe lui aussi en malgache, nom du produit compris.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hamita ny komandy");
  await expect(page.getByText("Tavoahangy mitahiry hafanana Forêt")).toBeVisible();
  await expect(page.getByText(/BIENVENUE10/)).toBeVisible();
});

test("les messages d'erreur suivent la langue de l'adresse", async ({ page }) => {
  for (const [locale, email, password, submit, message] of [
    ["en", "Email address", "Password", "Sign in", "Wrong email or password."],
    ["mg", "Adiresy mailaka", "Teny miafina", "Hiditra", "Diso ny mailaka na ny teny miafina."],
    ["fr", "Adresse e-mail", "Mot de passe", "Se connecter", "E-mail ou mot de passe incorrect."],
  ]) {
    await page.goto(`/${locale}/login`);
    await page.getByLabel(email).fill("personne@example.com");
    await page.getByLabel(password).fill("mauvais-mot-de-passe");
    await page.getByRole("button", { name: submit }).click();
    await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
  }
});

test("catalogue : rayons et recherche dans la langue du visiteur", async ({ page }) => {
  await page.goto("/en/products?q=basket");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “basket”");
  await expect(page.getByRole("link", { name: "Soa woven basket bag" })).toBeVisible();
  await page.getByRole("navigation", { name: "Choose an aisle" }).getByRole("link", { name: "Kitchen" }).click();
  await expect(page).toHaveURL(/\/en\/products\?category=cuisine$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kitchen");
  await expect(page).toHaveTitle("Kitchen — Alarobia");
  // Le filtre reste dans la langue en cours.
  await page.getByLabel("In stock").check();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/\/en\/products\?category=cuisine&.*stock=1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kitchen");
});

// Point de vigilance 5 : une traduction manquante retombe sur le français, sans trou à l'écran.
test("fiche produit en malgache : texte traduit, caractéristiques en français faute de traduction, livraison par zone", async ({ page }) => {
  await page.goto("/mg/products/tasse-en-gres-vato");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kaopy tanimanga Vato");
  await expect(page.getByRole("button", { name: "Ampidiro ao anaty harona" })).toBeVisible();
  const details = page.getByRole("region", { name: "Toetoetra" });
  await expect(details.getByRole("listitem").first()).toHaveText("Grès émaillé, 30 cl");
  const delivery = page.getByRole("region", { name: "Fanaterana" });
  await expect(delivery.getByRole("listitem").first()).toContainText("Antananarivo renivohitra");
  await expect(delivery.getByRole("listitem").first()).toContainText("3 000 Ar");
});
