import { expect, test, type Page } from "@playwright/test";
import { ADMIN, login, watchErrors } from "./helpers";

// Après une visite en /en ou /mg, une adresse sans préfixe redirige vers cette langue (cookie) :
// les adresses de ce fichier portent toujours leur langue, et chaque parcours finit en français.

test.beforeEach(async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
});

/** Défilement horizontal de la page ; clientWidth et non innerWidth, qui s'élargit avec le contenu en émulation mobile. */
async function horizontalOverflow(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test("le sélecteur de langue du back-office garde la page et ses paramètres", async ({ page }) => {
  const check = watchErrors(page);
  try {
    await page.goto("/fr/admin");
    const languages = page.getByRole("navigation", { name: "Langue" });
    await expect(languages.getByRole("link", { name: "Français" })).toHaveAttribute("aria-current", "true");
    await languages.getByRole("link", { name: "Malagasy" }).click();

    await expect(page).toHaveURL(/\/mg\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Topimaso" })).toBeVisible();
    await expect(page).toHaveTitle(/^Topimaso — /);
    const sidebar = page.getByRole("navigation", { name: "Fitantanana" });
    await expect(sidebar.getByRole("link", { name: "Komandy" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Fandrindrana" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Fiteny" }).getByRole("link", { name: "Malagasy" })).toHaveAttribute("aria-current", "true");

    await page.goto("/mg/admin/products?q=tasse");
    await page.getByRole("navigation", { name: "Fiteny" }).getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/products\?q=tasse$/);
    await expect(page.getByRole("navigation", { name: "Language" }).getByRole("link", { name: "English" })).toHaveAttribute("aria-current", "true");
  } finally {
    await page.goto("/fr/admin");
  }
  check();
});

// Titre de niveau 1 de chaque page, par langue (le français sert de repère : il ne doit plus apparaître en anglais ni en malgache).
const PAGES = [
  ["/admin", "Tableau de bord", "Dashboard", "Topimaso"],
  ["/admin/orders", "Commandes", "Orders", "Komandy"],
  ["/admin/products", "Produits", "Products", "Entana"],
  ["/admin/products/new", "Nouveau produit", "New product", "Entana vaovao"],
  ["/admin/categories", "Catégories", "Categories", "Sokajy"],
  ["/admin/customers", "Clients", "Customers", "Mpanjifa"],
  ["/admin/shipping", "Livraison", "Delivery", "Fanaterana"],
  ["/admin/promotions", "Codes promo", "Promo codes", "Kaody fihenam-bidy"],
  ["/admin/reviews", "Avis clients", "Customer reviews", "Hevitry ny mpanjifa"],
  ["/admin/settings", "Réglages", "Settings", "Fandrindrana"],
] as const;

test("toutes les pages du back-office existent en anglais et en malgache", async ({ page }) => {
  const check = watchErrors(page);
  try {
    for (const [path, fr, en, mg] of PAGES) {
      await page.goto(`/en${path}`);
      await expect(page.getByRole("heading", { level: 1, name: en, exact: true }), `/en${path}`).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: fr, exact: true }), `/en${path} ne garde pas le français`).toHaveCount(0);
      await page.goto(`/mg${path}`);
      await expect(page.getByRole("heading", { level: 1, name: mg, exact: true }), `/mg${path}`).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: fr, exact: true }), `/mg${path} ne garde pas le français`).toHaveCount(0);
    }
  } finally {
    await page.goto("/fr/admin");
  }
  check();
});

test.describe("téléphone de 320 px en malgache", () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

  test("tableau de bord et menu sans défilement horizontal", async ({ page }) => {
    const check = watchErrors(page);
    try {
      await page.goto("/mg/admin");
      await expect(page.getByRole("heading", { level: 1, name: "Topimaso" })).toBeVisible();
      expect(await horizontalOverflow(page), "tableau de bord").toBeLessThanOrEqual(1);

      await page.getByRole("button", { name: "Sokafy ny menio" }).click();
      const menu = page.getByRole("dialog");
      await expect(menu.getByRole("link", { name: "Fandrindrana" })).toBeVisible();
      expect(await horizontalOverflow(page), "menu ouvert").toBeLessThanOrEqual(1);
      expect(await menu.evaluate((el) => el.scrollWidth - el.clientWidth), "contenu du menu").toBeLessThanOrEqual(1);
      // Le sélecteur tient dans le menu : ses trois langues sont entièrement à l'écran.
      for (const name of ["Français", "English", "Malagasy"]) await expect(menu.getByRole("navigation", { name: "Fiteny" }).getByRole("link", { name })).toBeInViewport({ ratio: 1 });
    } finally {
      await page.goto("/fr/admin");
    }
    check();
  });

  test("aucune page du back-office ne déborde à 320 px en malgache", async ({ page }) => {
    const check = watchErrors(page);
    const paths = ["/mg/admin", "/mg/admin/orders", "/mg/admin/products", "/mg/admin/products/new", "/mg/admin/categories", "/mg/admin/customers", "/mg/admin/shipping", "/mg/admin/promotions", "/mg/admin/reviews", "/mg/admin/settings"];
    try {
      for (const path of paths) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await horizontalOverflow(page), `${path} : défilement horizontal`).toBeLessThanOrEqual(1);
        const faulty = await page.evaluate(() => {
          const out: string[] = [];
          for (const form of document.querySelectorAll("form")) {
            const edge = form.getBoundingClientRect().right;
            for (const el of form.querySelectorAll<HTMLElement>("input, select, textarea, button")) {
              if (el instanceof HTMLInputElement && el.type === "hidden") continue;
              if (el.closest(".sr-only")) continue;
              const r = el.getBoundingClientRect();
              if (r.width <= 0) continue;
              if (r.right > edge + 1) {
                const label = el.getAttribute("name") || el.textContent?.trim() || el.tagName;
                out.push(`${label} : bord droit ${Math.round(r.right)}, formulaire ${Math.round(edge)}`);
              }
            }
          }
          return out;
        });
        expect(faulty, `${path} : champs hors de leur formulaire`).toEqual([]);
      }
    } finally {
      await page.goto("/fr/admin");
    }
    check();
  });
});

test.describe("fiche produit sur téléphone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("le bouton d'enregistrement reste atteignable et ne masque pas le statut", async ({ page }) => {
    const check = watchErrors(page);
    await page.goto("/fr/admin/products?q=Tasse en grès Vato");
    await page.getByRole("link", { name: "Tasse en grès Vato", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tasse en grès Vato" })).toBeVisible();

    const status = page.getByLabel("Statut");
    const save = page.getByRole("button", { name: "Enregistrer", exact: true });
    // On parcourt la page de haut en bas : à aucun moment la barre d'enregistrement ne passe sur le champ.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= height; y += 150) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      const [a, b] = await Promise.all([status.boundingBox(), save.locator("xpath=..").locator("xpath=..").boundingBox()]);
      if (!a || !b) continue;
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlap, `barre d'enregistrement sur le champ « Statut » (défilement ${y} px)`).toBe(false);
    }
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    await expect(status).toBeVisible();
    check();
  });
});
