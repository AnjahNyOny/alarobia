import { expect, test, type Locator, type Page } from "@playwright/test";
import { ADMIN, CART_ADD_TIMEOUT, expectFocusShown, tabTo } from "./helpers";

// Parcours au clavier seul : Tab, Maj+Tab, Entrée, Espace, flèches, Échap et la frappe de texte.
// Les sélecteurs ne servent qu'à vérifier où est le focus ; aucun click() ni fill() pour agir.
// `page.goto` place seulement le visiteur au début d'un parcours. Chaque élément traversé par `tabTo`
// doit montrer son focus (contour ou ombre calculés sur `:focus-visible`).
// Produit acheté : le sac à dos Transit (40 en stock), qu'aucun autre parcours ne vérifie.

const focused = (locator: Locator) => expect(locator).toBeFocused();

/** Le focus est-il à l'intérieur de `container` ? */
const focusInside = (container: Locator) => container.evaluate((el) => el.contains(document.activeElement));

/** Attend (au plus 1 s) que le focus soit entré dans `container` : Base UI le déplace à l'image suivante. */
const expectFocusInside = (container: Locator, message = "le focus entre dans la fenêtre") =>
  expect.poll(() => focusInside(container), { message, timeout: 2000 }).toBe(true);

/**
 * Retient le texte de la fenêtre au moment où elle entre dans la page. Après un ajout, le tiroir doit s'ouvrir sur le panier
 * à jour : s'il s'ouvrait d'abord sur l'état d'avant (panier vide), Base UI viserait pour le focus un lien aussitôt remplacé,
 * et le focus resterait derrière le tiroir.
 */
const recordDialogOpening = (page: Page) =>
  page.addInitScript(() => {
    new MutationObserver((mutations) => {
      for (const mutation of mutations)
        for (const node of mutation.addedNodes) {
          const dialog = node instanceof Element ? (node.matches('[role="dialog"]') ? node : node.querySelector('[role="dialog"]')) : null;
          if (dialog) document.documentElement.dataset.dialogOnOpen = dialog.textContent ?? "";
        }
    }).observe(document, { childList: true, subtree: true });
  });
const dialogOnOpen = (page: Page) => page.evaluate(() => document.documentElement.dataset.dialogOnOpen ?? null);

/**
 * Tabule `n` fois en vérifiant que le focus reste dans `container` (piège de focus d'un tiroir ou d'un menu).
 * Aux deux bouts, Base UI fait passer le focus par une sentinelle placée hors de la fenêtre, qui le renvoie
 * à l'autre bout à l'image suivante : on attend donc qu'il soit revenu. La limite est large (2 s) parce que, machine chargée, c'est la lecture du focus
 * par Playwright qui tarde, pas le focus : un focus réellement sorti le reste et fait échouer le test quand même.
 */
async function expectTrapped(page: Page, container: Locator, n = 25) {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(i % 3 === 2 ? "Shift+Tab" : "Tab");
    await expect.poll(() => focusInside(container), { message: `tabulation ${i + 1} : le focus est sorti`, timeout: 2000 }).toBe(true);
  }
}

test.describe("lien d'évitement", () => {
  test("boutique : premier arrêt, visible, mène au contenu principal", async ({ page }) => {
    await page.goto("/fr/products");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Aller au contenu" });
    await focused(skip);
    await expect(skip).toBeInViewport();
    expect((await skip.boundingBox())?.width ?? 0).toBeGreaterThan(20);
    await expectFocusShown(page, "lien d'évitement");
    await page.keyboard.press("Enter");
    expect(await focusInside(page.getByRole("main"))).toBe(true);
    // La tabulation suivante reste dans le contenu, au lieu de repasser par l'en-tête.
    await page.keyboard.press("Tab");
    expect(await focusInside(page.getByRole("main"))).toBe(true);
  });

  test("back-office : premier arrêt, visible, mène au contenu principal", async ({ page }) => {
    await page.goto("/fr/login?next=%2Fadmin");
    await tabTo(page, page.getByLabel("Adresse e-mail"), { step: "connexion" });
    await page.keyboard.type(ADMIN.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(ADMIN.password);
    await page.keyboard.press("Enter");
    await page.waitForURL("**/fr/admin");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Aller au contenu" });
    await focused(skip);
    await expect(skip).toBeInViewport();
    await expectFocusShown(page, "lien d'évitement du back-office");
    await page.keyboard.press("Enter");
    expect(await focusInside(page.getByRole("main"))).toBe(true);
  });
});

test("achat complet au clavier : recherche, fiche, panier, commande, confirmation", async ({ page }) => {
  await page.goto("/fr");
  await tabTo(page, page.getByRole("searchbox", { name: "Rechercher un objet" }).first(), { step: "accueil" });
  await page.keyboard.type("transit");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/fr\/products\?q=transit/);

  await tabTo(page, page.getByRole("main").getByRole("link", { name: /Sac à dos Transit/ }).first(), { step: "résultats" });
  await page.keyboard.press("Enter");
  await page.waitForURL("**/products/sac-a-dos-transit");

  const add = page.getByRole("button", { name: "Ajouter au panier" });
  await tabTo(page, add, { step: "fiche produit" });
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Votre panier" })).toBeVisible({ timeout: CART_ADD_TIMEOUT });
  await expectFocusInside(drawer, "le focus entre dans le tiroir");
  await tabTo(page, drawer.getByRole("link", { name: "Voir le panier" }), { step: "tiroir" });
  await page.keyboard.press("Enter");
  await page.waitForURL("**/fr/cart");

  await tabTo(page, page.getByRole("link", { name: "Passer la commande" }), { step: "panier" });
  await page.keyboard.press("Enter");
  await page.waitForURL("**/fr/checkout");

  const type = async (label: string, text: string) => {
    await tabTo(page, page.getByLabel(label, { exact: true }), { step: `commande, ${label}` });
    await page.keyboard.type(text);
  };
  await type("Adresse e-mail", "rindra.clavier@example.com");
  await type("Nom complet", "Rindra Clavier");
  // Un numéro français : refusé par le serveur, le focus doit aller sur le champ fautif.
  await type("Téléphone", "06 11 22 33 44");
  await type("Adresse ou lot", "Lot III A 7");
  await type("Quartier", "Ampefiloha");
  await type("Ville", "Antananarivo");
  // Liste de provinces : la frappe choisit l'option sans ouvrir la liste.
  await type("Province", "Antananarivo");
  await expect(page.getByLabel("Province", { exact: true })).toHaveValue("Antananarivo");

  // Zones et moyens de paiement : un groupe de boutons radio, on entre par Tab et on choisit aux flèches.
  // Les zones sont prises telles qu'elles sont : dans la suite complète, admin.spec.ts a supprimé toutes celles
  // du seed sauf « Antananarivo ville ». Les flèches sont alors vérifiées sur les seuls moyens de paiement.
  const zones = page.getByRole("group", { name: "Zone de livraison" }).getByRole("radio");
  await tabTo(page, zones.first(), { step: "zone de livraison" });
  if ((await zones.count()) > 1) {
    await page.keyboard.press("ArrowDown");
    await expect(zones.nth(1)).toBeChecked();
    await focused(zones.nth(1));
    await expectFocusShown(page, "zone choisie aux flèches");
    await page.keyboard.press("ArrowUp");
    await expect(zones.first()).toBeChecked();
  }

  const cod = page.getByRole("radio", { name: /Paiement à la livraison/ });
  await page.keyboard.press("Tab");
  await expectFocusShown(page, "moyen de paiement");
  for (let i = 0; i < 5 && !(await cod.isChecked()); i++) await page.keyboard.press("ArrowDown");
  await expect(cod).toBeChecked();
  await focused(cod);

  await tabTo(page, page.getByRole("button", { name: "Valider la commande" }), { step: "envoi" });
  await page.keyboard.press("Enter");
  const phone = page.getByLabel("Téléphone", { exact: true });
  await expect(page.getByText("Indiquez un numéro malgache, par exemple 034 12 345 67.")).toBeVisible();
  // Après le refus, le focus est sur le champ fautif : on corrige sans chercher.
  await focused(phone);
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("034 11 222 33");

  await tabTo(page, page.getByRole("button", { name: "Valider la commande" }), { step: "nouvel envoi" });
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/fr\/order\/c/);
  await expect(page.getByRole("heading", { level: 1, name: /votre commande est enregistrée/ })).toBeVisible();
  await tabTo(page, page.getByRole("main").getByRole("link").first(), { step: "confirmation" });
});

test.describe("tiroir et menus", () => {
  test("tiroir du panier : le focus y entre, y reste, Échap ferme et rend le focus au bouton", async ({ page }) => {
    await recordDialogOpening(page);
    await page.goto("/fr/products/sac-a-dos-transit");
    const cart = page.getByRole("button", { name: /^Panier/ });
    await tabTo(page, cart, { step: "bouton du panier" });
    await page.keyboard.press("Enter");
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expectFocusInside(drawer, "le focus entre dans le tiroir");
    await expectTrapped(page, drawer);
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await focused(cart);

    // Ouvert par « Ajouter au panier » : le focus revient sur ce bouton.
    const add = page.getByRole("button", { name: "Ajouter au panier" });
    await tabTo(page, add, { step: "ajout au panier" });
    await page.keyboard.press("Enter");
    await expect(drawer.getByRole("heading", { name: "Votre panier" })).toBeVisible({ timeout: CART_ADD_TIMEOUT });
    expect(await dialogOnOpen(page), "le tiroir s'ouvre sur le panier à jour, pas sur le panier vide").toContain("Sac à dos Transit");
    await expectFocusInside(drawer, "le focus entre dans le tiroir");
    await expectTrapped(page, drawer);
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await focused(add);
  });

  test.describe("écran étroit", () => {
    test.use({ viewport: { width: 800, height: 900 } });

    test("menu de la boutique : le focus y entre, y reste, Échap ferme et rend le focus au bouton", async ({ page }) => {
      await page.goto("/fr");
      const opener = page.getByRole("button", { name: "Ouvrir le menu" });
      await tabTo(page, opener, { step: "bouton du menu" });
      await page.keyboard.press("Enter");
      const menu = page.getByRole("dialog");
      await expect(menu).toBeVisible();
      await expectFocusInside(menu);
      await expectTrapped(page, menu);
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
      await focused(opener);
    });

    test("menu du back-office : le focus y entre, y reste, Échap ferme et rend le focus au bouton", async ({ page }) => {
      await page.goto("/fr/login?next=%2Fadmin");
      await tabTo(page, page.getByLabel("Adresse e-mail"));
      await page.keyboard.type(ADMIN.email);
      await page.keyboard.press("Tab");
      await page.keyboard.type(ADMIN.password);
      await page.keyboard.press("Enter");
      await page.waitForURL("**/fr/admin");
      const opener = page.getByRole("button", { name: "Ouvrir le menu" });
      await tabTo(page, opener, { step: "bouton du menu" });
      await page.keyboard.press("Enter");
      const menu = page.getByRole("dialog");
      await expect(menu).toBeVisible();
      await expectFocusInside(menu);
      await expectTrapped(page, menu);
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
      await focused(opener);
    });
  });
});

test("personnalisation de la tasse au clavier", async ({ page }) => {
  await recordDialogOpening(page);
  await page.goto("/fr/products/tasse-en-gres-vato");
  const photos = page.getByRole("tab", { name: "Photos" });
  const custom = page.getByRole("tab", { name: "Personnaliser" });
  await tabTo(page, photos, { step: "onglets" });
  await page.keyboard.press("ArrowRight");
  await focused(custom);
  await expect(custom).toHaveAttribute("aria-selected", "true");
  await expectFocusShown(page, "onglet Personnaliser");
  await expect(page.locator('[data-view="3d"] canvas')).toBeVisible();

  // Couleur : groupe radio, flèches.
  const white = page.getByRole("radio", { name: "Blanc" });
  await tabTo(page, white, { step: "couleur" });
  await page.keyboard.press("ArrowRight");
  await expect(white).not.toBeChecked();
  await expectFocusShown(page, "couleur choisie aux flèches");

  await tabTo(page, page.getByLabel("Votre texte"), { step: "texte" });
  await page.keyboard.type("Fara");

  // Écriture : groupe radio, flèches.
  const fonts = page.getByRole("group", { name: "Écriture" }).getByRole("radio");
  await tabTo(page, fonts.first(), { step: "écriture" });
  await page.keyboard.press("ArrowRight");
  await expect(fonts.nth(1)).toBeChecked();

  // Curseurs : les flèches changent la valeur.
  const size = page.getByLabel("Taille du texte");
  await tabTo(page, size, { step: "taille du texte" });
  const before = Number(await size.inputValue());
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  expect(Number(await size.inputValue())).toBe(before + 2);
  const height = page.getByLabel("Hauteur du texte");
  await tabTo(page, height, { step: "hauteur du texte" });
  const top = Number(await height.inputValue());
  await page.keyboard.press("ArrowLeft");
  expect(Number(await height.inputValue())).toBe(top - 1);

  // Rotation de la scène : boutons ordinaires (Maj+Tab : ils sont avant les réglages).
  const left = page.getByRole("button", { name: "Tourner vers la gauche" });
  await tabTo(page, left, { back: true, step: "rotation" });
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await focused(page.getByRole("button", { name: "Tourner vers la droite" }));
  await page.keyboard.press("Space");

  // Bascule 3D / à plat.
  const toFlat = page.getByRole("button", { name: "Voir à plat" });
  await tabTo(page, toFlat, { step: "vue à plat" });
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-view="flat"]')).toBeVisible();
  // Le bouton change de libellé sans perdre le focus.
  await focused(page.getByRole("button", { name: "Voir en 3D" }));

  const add = page.getByRole("button", { name: "Ajouter au panier" });
  await tabTo(page, add, { step: "ajout" });
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText(/Personnalisé : .*« Fara »/)).toBeVisible({ timeout: CART_ADD_TIMEOUT });
  // Même enchaînement que sur une fiche ordinaire : le tiroir s'ouvre sur la tasse ajoutée, le focus y entre, Échap le rend au bouton.
  expect(await dialogOnOpen(page), "le tiroir s'ouvre sur le panier à jour, pas sur le panier vide").toContain("« Fara »");
  await expectFocusInside(drawer, "le focus entre dans le tiroir");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await focused(add);
});

test("back-office au clavier : barre latérale, onglets de langue, enregistrement, paiement reçu", async ({ page }) => {
  await page.goto("/fr/login?next=%2Fadmin");
  await tabTo(page, page.getByLabel("Adresse e-mail"), { step: "connexion" });
  await page.keyboard.type(ADMIN.email);
  await page.keyboard.press("Tab");
  await page.keyboard.type(ADMIN.password);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/fr/admin");

  const sidebar = page.getByRole("navigation", { name: "Administration" });
  await tabTo(page, sidebar.getByRole("link", { name: "Produits" }), { step: "barre latérale" });
  await page.keyboard.press("Enter");
  await page.waitForURL("**/fr/admin/products");
  await expect(page.getByRole("heading", { level: 1, name: "Produits" })).toBeVisible();

  // Recherche dans la liste, puis ouverture du produit.
  await tabTo(page, page.getByRole("main").getByRole("searchbox").first(), { step: "recherche produit" });
  await page.keyboard.type("Tabouret haut Oslo");
  await page.keyboard.press("Enter");
  await page.waitForURL(/q=Tabouret/);
  const link = page.getByRole("main").getByRole("link", { name: "Tabouret haut Oslo", exact: true });
  await tabTo(page, link, { step: "liste des produits" });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Tabouret haut Oslo" })).toBeVisible();

  // Onglets de langue : Tab entre sur l'onglet ouvert, les flèches passent aux autres.
  const french = page.getByRole("tab", { name: /Français/ });
  await tabTo(page, french, { step: "onglets de langue" });
  await page.keyboard.press("ArrowRight");
  const english = page.getByRole("tab", { name: /English/ });
  await focused(english);
  await expect(english).toHaveAttribute("aria-selected", "true");
  await expectFocusShown(page, "onglet anglais");
  await page.keyboard.press("End");
  await focused(page.getByRole("tab", { name: /Malagasy/ }));
  await page.keyboard.press("Home");
  await focused(french);

  await tabTo(page, page.getByRole("button", { name: "Enregistrer" }), { step: "enregistrer" });
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/fr\/admin\/products(\?|$)/);
  // La confirmation est annoncée : les toasts sont dans une région live.
  const toast = page.getByText("Produit enregistré.");
  await expect(toast).toBeVisible();
  expect(await toast.evaluate((el) => !!el.closest('[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"]'))).toBe(true);

  // Paiement reçu sur une commande Mobile Money en attente. On vise une ligne dont le paiement est à confirmer :
  // la première commande en attente peut être celle, payable à la livraison, d'un parcours d'achat lancé avant.
  await page.goto("/fr/admin/orders?status=PENDING");
  const order = page.getByRole("main").getByRole("row").filter({ hasText: /Pas encore payé|Référence à vérifier/ }).first().getByRole("link", { name: /^AL-/ });
  await tabTo(page, order, { step: "liste des commandes", max: 80 });
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/fr\/admin\/orders\/c/);
  const paid = page.getByRole("button", { name: "Paiement reçu" });
  await tabTo(page, paid, { step: "paiement reçu", max: 80 });
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expectFocusInside(dialog);
  await tabTo(page, dialog.getByRole("button", { name: "Paiement reçu" }), { step: "confirmation" });
  await page.keyboard.press("Enter");
  const done = page.getByText("Paiement confirmé : la commande est à préparer.");
  await expect(done).toBeVisible();
  expect(await done.evaluate((el) => !!el.closest('[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"]'))).toBe(true);
  // Le bouton a disparu : le focus va sur le texte qui confirme le nouvel état, au lieu de retomber sur la page.
  await focused(page.getByRole("main").getByText(/^Paiement confirmé/));
});

test("connexion refusée : le message est annoncé et le focus n'est pas perdu", async ({ page }) => {
  await page.goto("/fr/login");
  await tabTo(page, page.getByLabel("Adresse e-mail"), { step: "connexion" });
  await page.keyboard.type("client@alarobia.example");
  await page.keyboard.press("Tab");
  await page.keyboard.type("mauvais");
  await page.keyboard.press("Enter");
  const alert = page.getByRole("alert").filter({ hasText: "E-mail ou mot de passe incorrect." });
  await expect(alert).toBeVisible();
  // Pas d'erreur de champ : le focus va sur le message lui-même, qui est lu.
  await focused(alert);
});

test.describe("moins d'animations", () => {
  test.use({ reducedMotion: "reduce" });

  test("la tasse ne se balance pas et le tiroir s'ouvre sans transition", async ({ page }) => {
    await page.goto("/fr/products/tasse-en-gres-vato");
    await tabTo(page, page.getByRole("tab", { name: "Photos" }));
    await page.keyboard.press("ArrowRight");
    const frame = page.locator('[data-view="3d"]');
    await expect(frame.locator("canvas")).toBeVisible();
    const frames = (n: number) => page.evaluate((count) => new Promise<void>((done) => { let i = 0; const next = () => (++i >= count ? done() : requestAnimationFrame(next)); requestAnimationFrame(next); }), n);
    await frames(10);
    const first = await frame.screenshot();
    await frames(40);
    expect((await frame.screenshot()).equals(first), "la scène bouge alors que l'utilisateur demande moins d'animations").toBe(true);

    await tabTo(page, page.getByRole("button", { name: /^Panier/ }), { back: true });
    await page.keyboard.press("Enter");
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    const longest = await drawer.evaluate((el) => Math.max(...getComputedStyle(el).transitionDuration.split(",").map((d) => parseFloat(d) * (d.trim().endsWith("ms") ? 1 : 1000))));
    expect(longest, "durée de transition du tiroir (ms)").toBeLessThanOrEqual(10);
  });

  test("témoin : sans préférence, la tasse se balance", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/fr/products/tasse-en-gres-vato");
    await tabTo(page, page.getByRole("tab", { name: "Photos" }));
    await page.keyboard.press("ArrowRight");
    const frame = page.locator('[data-view="3d"]');
    await expect(frame.locator("canvas")).toBeVisible();
    const frames = (n: number) => page.evaluate((count) => new Promise<void>((done) => { let i = 0; const next = () => (++i >= count ? done() : requestAnimationFrame(next)); requestAnimationFrame(next); }), n);
    await frames(10);
    const first = await frame.screenshot();
    await frames(40);
    expect((await frame.screenshot()).equals(first)).toBe(false);
  });
});
