import { expect, test, type Page } from "@playwright/test";
import { expectSecurityHeaders, watchErrors } from "./helpers";

/*
 * Contrôle du site en ligne, après une mise en ligne (PLAN.md 7.5, étape 7). Se lance seulement par sa propre
 * configuration : `npm run test:prod` (playwright.production.config.ts), avec les variables :
 *
 *   PROD_URL             adresse du site, obligatoire (https://<nom>.netlify.app)
 *   PROD_ADMIN_EMAIL     compte administrateur du site en ligne  } connexion au back-office
 *   PROD_ADMIN_PASSWORD                                          }
 *
 * Un test dont la variable manque est sauté, et le dit. Ce que la spec fait sur le site : elle lit des pages, envoie une
 * petite image de personnalisation (que le nettoyage quotidien effacera au bout de sept jours) et se connecte une fois au
 * back-office. Elle n'ajoute rien au panier, ne passe aucune commande, ne modifie rien dans le back-office et ne lance
 * pas le nettoyage.
 */

const PROD_URL = process.env.PROD_URL!;

/**
 * Valeur d'une variable facultative, ou test sauté qui la nomme. Le motif est aussi écrit sur la sortie : le rapporteur
 * `list` n'affiche pas celui d'un test sauté.
 */
function required(variable: string, role: string) {
  const value = process.env[variable];
  if (!value) {
    const reason = `Variable ${variable} absente (${role}) : test sauté.`;
    console.log(reason);
    test.skip(true, reason);
  }
  return value!;
}

const LOCALES = ["fr", "en", "mg"] as const;
const PRODUCT = "/products/tasse-en-gres-vato";
const PAGES = [
  ["accueil", ""],
  ["catalogue", "/products"],
  ["fiche de la tasse", PRODUCT],
  ["aide", "/help"],
] as const;

test.describe("pages publiques dans les trois langues", () => {
  for (const locale of LOCALES) {
    for (const [what, path] of PAGES) {
      test(`${what} (${locale}) : 200, sans erreur de page, de console ni réponse 5xx`, async ({ page }) => {
        const check = watchErrors(page);
        const response = await page.goto(`/${locale}${path}`);
        expect(response?.status(), `/${locale}${path}`).toBe(200);
        // Les erreurs d'hydratation et les ressources manquantes arrivent après le chargement du document.
        await page.waitForLoadState("networkidle");
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        check();
      });
    }
  }
});

/** Petite image PNG réelle (96 × 64), dessinée dans la page : un dégradé et un carré, rien de plus. */
async function smallPng(page: Page) {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 96, 64);
    gradient.addColorStop(0, "#c2410c");
    gradient.addColorStop(1, "#1d4ed8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 64);
    ctx.fillStyle = "#fff";
    ctx.fillRect(36, 20, 24, 24);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return btoa(String.fromCharCode(...bytes));
  });
  return Buffer.from(base64, "base64");
}

test("envoi d'une image sur la fiche de la tasse, puis relecture par /uploads/… (Netlify Blobs)", async ({ page }) => {
  // Le navigateur réduit et réencode l'image avant de l'envoyer (send-image.ts) : on garde les octets réellement envoyés
  // pour les comparer à ceux que le site sert ensuite.
  await page.addInitScript(() => {
    const send = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const body = init?.body;
      if (url.endsWith("/api/customizer/upload") && body instanceof FormData) {
        const file = body.get("file");
        if (file instanceof Blob) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          (window as unknown as { __sentImage: string }).__sentImage = btoa(String.fromCharCode(...bytes));
        }
      }
      return send(input, init);
    };
  });
  const check = watchErrors(page);
  await page.goto(`/fr${PRODUCT}`);
  await page.getByRole("tab", { name: "Personnaliser" }).click();
  const png = await smallPng(page);

  const answered = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/api/customizer/upload"));
  await page.getByLabel("Ajouter une image").setInputFiles({ name: "controle-en-ligne.png", mimeType: "image/png", buffer: png });
  const response = await answered;
  expect(response.status(), "envoi de l'image").toBe(200);
  const body = (await response.json()) as { name: string; url: string; width: number; height: number };
  expect(body.name).toMatch(/^perso-[0-9a-f-]{36}\.png$/);
  expect(body).toMatchObject({ url: `/uploads/${body.name}`, width: 96, height: 64 });
  const sent = Buffer.from(await page.evaluate(() => (window as unknown as { __sentImage: string }).__sentImage), "base64");
  expect(sent.subarray(0, 8).toString("hex"), "le navigateur a envoyé un PNG").toBe("89504e470d0a1a0a");

  const served = await page.request.get(body.url);
  expect(served.status(), body.url).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/png");
  const bytes = await served.body();
  expect(bytes.equals(sent), `${body.url} : mêmes octets que l'image envoyée (${sent.length} octets envoyés, ${bytes.length} servis)`).toBe(true);
  // En-tête PNG : largeur et hauteur aux octets 16 et 20, celles que la réponse de l'envoi annonce.
  expect({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }).toEqual({ width: body.width, height: body.height });
  await expect(page.getByRole("img", { name: "Votre image" })).toHaveAttribute("src", body.url);
  check();
});

test("connexion au back-office avec le compte du propriétaire, puis liste des produits", async ({ page }) => {
  const email = required("PROD_ADMIN_EMAIL", "adresse du compte administrateur du site en ligne");
  const password = required("PROD_ADMIN_PASSWORD", "mot de passe du compte administrateur du site en ligne");
  const check = watchErrors(page);
  await page.goto("/fr/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  // Un seul essai : chaque échec compte dans les limites de débit du site (8 par compte, 30 par adresse, en 15 min).
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page, "connexion refusée ? Vérifier PROD_ADMIN_EMAIL et PROD_ADMIN_PASSWORD avant de relancer (pas de nouvel essai automatique)").toHaveURL(/\/fr\/admin$/, { timeout: 20_000 });

  const response = await page.goto("/fr/admin/products");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Produits" })).toBeVisible();
  // Au moins un produit (la tasse est en ligne dès les données de départ), chacun avec le lien vers sa fiche d'édition.
  await expect(page.locator('main table a[href*="/admin/products/"]').first()).toBeVisible();
  check();
});

test.describe("en-têtes et référencement sur l'adresse en ligne", () => {
  test("en-têtes de sécurité sur une page", async ({ request }) => {
    const response = await request.get("/fr/products");
    expect(response.status()).toBe(200);
    expectSecurityHeaders(response.headersArray(), "/fr/products");
  });

  for (const [what, path] of [["accueil", ""], ["fiche de la tasse", PRODUCT]] as const) {
    for (const locale of LOCALES) {
      test(`${what} (${locale}) : adresse canonique et hreflang sur ${PROD_URL}`, async ({ page }) => {
        await page.goto(`/${locale}${path}`);
        const head = await page.evaluate(() => ({
          canonical: [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute("href")),
          alternates: Object.fromEntries([...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [l.getAttribute("hreflang"), l.getAttribute("href")])),
        }));
        // Une adresse qui ne commence pas par PROD_URL : NEXT_PUBLIC_SITE_URL est mal réglée sur Netlify (ou oubliée).
        expect(head.canonical, "une seule adresse canonique, sur PROD_URL").toEqual([`${PROD_URL}/${locale}${path}`]);
        expect(head.alternates, "hreflang fr, en, mg et x-default, sur PROD_URL").toEqual({
          fr: `${PROD_URL}/fr${path}`,
          en: `${PROD_URL}/en${path}`,
          mg: `${PROD_URL}/mg${path}`,
          "x-default": `${PROD_URL}/fr${path}`,
        });
      });
    }
  }
});

test.describe("routes /api/cron", () => {
  test("nettoyage sans secret : 401, ce qui prouve que CRON_SECRET est défini sur le site", async ({ request }) => {
    // Le nettoyage lui-même n'est jamais lancé d'ici : le propriétaire le lance depuis GitHub (PLAN.md 7.5, étape 9).
    const response = await request.get("/api/cron/nettoyage");
    expect(response.status(), "503 : CRON_SECRET n'est pas défini dans les variables du site sur Netlify").toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  });
});
