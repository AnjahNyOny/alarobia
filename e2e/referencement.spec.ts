import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/** Référencement multilingue : ce que Google et les réseaux sociaux lisent dans le <head>. */

const BASE = "http://localhost:3100";
const LOCALES = ["fr", "en", "mg"] as const;
const OG_LOCALE = { fr: "fr_FR", en: "en_US", mg: "mg_MG" };
/** Phrase d'accroche (messages/*.json, meta.title) reprise par l'image de partage et son texte alternatif. */
const TAGLINE = { fr: "Objets du quotidien, livrés à Madagascar", en: "Everyday things, delivered across Madagascar", mg: "Entana isan'andro, aterina manerana an'i Madagasikara" };

type Head = {
  canonical: string[];
  alternates: Record<string, string>;
  robots: string | null;
  meta: Record<string, string>;
  jsonLd: unknown[];
  appleIcon: string | null;
};

async function readHead(page: Page): Promise<Head> {
  return page.evaluate(() => {
    const attr = (s: string, a: string) => document.querySelector(s)?.getAttribute(a) ?? null;
    const meta: Record<string, string> = {};
    for (const m of document.querySelectorAll("meta[property], meta[name]")) {
      const key = m.getAttribute("property") ?? m.getAttribute("name")!;
      if (!(key in meta)) meta[key] = m.getAttribute("content") ?? "";
    }
    return {
      canonical: [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute("href")!),
      alternates: Object.fromEntries([...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [l.getAttribute("hreflang")!, l.getAttribute("href")!])),
      robots: attr('meta[name="robots"]', "content"),
      meta,
      // Une erreur de syntaxe fait échouer le test ici : le JSON-LD doit être analysable.
      jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent ?? "")),
      appleIcon: attr('link[rel="apple-touch-icon"]', "href"),
    };
  });
}

/** Ce que le test lit des nœuds JSON-LD. */
type LdNode = {
  "@type": string | string[];
  name?: string;
  url?: string;
  logo?: string;
  inLanguage?: string;
  image?: string[];
  offers?: { price: string; priceCurrency: string; url: string };
  itemListElement?: { name: string; item?: string }[];
};

/** Les nœuds déclarés, y compris ceux d'un @graph. */
const nodes = (jsonLd: unknown[]) => jsonLd.flatMap((d) => (d as { "@graph"?: LdNode[] })["@graph"] ?? [d as LdNode]);

const types = (jsonLd: unknown[]) => nodes(jsonLd).flatMap((n) => [n["@type"]].flat());

function node(jsonLd: unknown[], type: string) {
  const found = nodes(jsonLd).find((n) => [n["@type"]].flat().includes(type));
  expect(found, `nœud ${type}`).toBeDefined();
  return found!;
}

async function expectImage(request: APIRequestContext, url: string, size?: { width: number; height: number }) {
  const response = await request.get(url);
  expect(response.status(), url).toBe(200);
  expect(response.headers()["content-type"], url).toMatch(/^image\//);
  if (size) {
    // En-tête PNG : largeur et hauteur aux octets 16 et 20.
    const body = await response.body();
    expect({ width: body.readUInt32BE(16), height: body.readUInt32BE(20) }).toEqual(size);
  }
}

/** Adresse canonique et équivalents des trois langues, x-default en français. */
function expectAlternates(head: Head, locale: string, path: string) {
  expect(head.canonical, "une seule adresse canonique").toEqual([`${BASE}/${locale}${path}`]);
  expect(head.alternates).toEqual({
    fr: `${BASE}/fr${path}`,
    en: `${BASE}/en${path}`,
    mg: `${BASE}/mg${path}`,
    "x-default": `${BASE}/fr${path}`,
  });
  expect(head.robots ?? "", "page indexable").not.toContain("noindex");
}

/** Image de partage générique, dans la langue de la page. */
async function expectShareImage(request: APIRequestContext, head: Head, locale: keyof typeof OG_LOCALE) {
  expect(head.meta["og:locale"]).toBe(OG_LOCALE[locale]);
  expect(head.meta["og:site_name"]).toBeTruthy();
  expect(head.meta["twitter:card"]).toBe("summary_large_image");
  const image = head.meta["og:image"];
  expect(image, "og:image").toContain(`${BASE}/${locale}/opengraph-image`);
  expect(head.meta["og:image:alt"], "texte alternatif dans la langue de la page").toContain(TAGLINE[locale]);
  expect(head.meta["twitter:image"]).toBe(image);
  await expectImage(request, image, { width: 1200, height: 630 });
}

test.describe("référencement multilingue", () => {
  for (const locale of LOCALES) {
    test(`accueil (${locale}) : canonique, hreflang, image de partage, Organization et WebSite`, async ({ page, request }) => {
      await page.goto(`/${locale}`);
      const head = await readHead(page);
      expectAlternates(head, locale, "");
      await expectShareImage(request, head, locale);
      expect(types(head.jsonLd)).toEqual(expect.arrayContaining(["OnlineStore", "WebSite"]));
      const site = node(head.jsonLd, "WebSite");
      expect(site.inLanguage).toBe(locale);
      expect(site.url).toBe(`${BASE}/${locale}`);
      const store = node(head.jsonLd, "OnlineStore");
      await expectImage(request, store.logo!);
      // L'icône Apple (180 × 180) sert aussi de logo aux moteurs de recherche.
      expect(head.appleIcon).toBeTruthy();
      await expectImage(request, new URL(head.appleIcon!, BASE).href, { width: 180, height: 180 });
    });
  }

  for (const locale of ["fr", "mg"] as const) {
    test(`fiche produit (${locale}) : photo en partage, Product en MGA et fil d'Ariane`, async ({ page, request }) => {
      await page.goto(`/${locale}/products`);
      const href = await page.locator('main a[href*="/products/"]').first().getAttribute("href");
      const path = href!.replace(`/${locale}`, "");
      await page.goto(href!);
      const head = await readHead(page);
      expectAlternates(head, locale, path);
      // La fiche garde la langue et le nom du site dans l'Open Graph, et sa propre photo.
      expect(head.meta["og:locale"]).toBe(OG_LOCALE[locale]);
      expect(head.meta["og:site_name"]).toBeTruthy();
      expect(head.meta["og:url"]).toBe(`${BASE}/${locale}${path}`);
      expect(head.meta["og:image"]).not.toContain("opengraph-image");
      expect(head.meta["twitter:card"]).toBe("summary_large_image");
      await expectImage(request, head.meta["og:image"]);

      expect(types(head.jsonLd)).toEqual(expect.arrayContaining(["Product", "BreadcrumbList"]));
      const product = node(head.jsonLd, "Product");
      expect(product.name).toBe(await page.locator("h1").textContent());
      expect(product.offers!.priceCurrency).toBe("MGA");
      expect(product.offers!.price).toMatch(/^\d+(\.\d\d)?$/);
      expect(product.offers!.url).toBe(`${BASE}/${locale}${path}`);
      // Le prix structuré est celui affiché : « 25 000 Ar » → « 25000 ».
      const shown = (await page.locator("main p.tabular-nums > span").first().textContent())!.replace(/\D/g, "");
      expect(product.offers!.price).toBe(shown);
      for (const image of product.image!) expect(image).toMatch(/^https?:\/\//);
      expect(node(head.jsonLd, "ItemPage").inLanguage).toBe(locale);

      const crumbs = node(head.jsonLd, "BreadcrumbList").itemListElement!;
      const crumb = page.locator('main nav a[href*="category="]').first();
      expect(crumbs[0].name).toBe(await crumb.textContent());
      expect(crumbs[0].item).toBe(new URL((await crumb.getAttribute("href"))!, BASE).href);
      expect(crumbs.at(-1)!.name).toBe(product.name);
    });
  }

  for (const locale of ["fr", "en"] as const) {
    test(`catalogue (${locale}) : le rayon reste dans la canonique, le tri et les filtres non`, async ({ page, request }) => {
      await page.goto(`/${locale}/products?sort=price-asc&stock=1`);
      let head = await readHead(page);
      expectAlternates(head, locale, "/products");
      await expectShareImage(request, head, locale);

      const href = await page.locator('main a[href*="category="]').first().getAttribute("href");
      const category = new URL(href!, BASE).searchParams.get("category")!;
      await page.goto(`/${locale}/products?category=${category}&sort=price-desc&sale=1`);
      head = await readHead(page);
      expectAlternates(head, locale, `/products?category=${category}`);

      await page.goto(`/${locale}/products?category=${category}&page=2`);
      head = await readHead(page);
      expectAlternates(head, locale, `/products?category=${category}&page=2`);
    });

    test(`à propos (${locale}) : canonique, hreflang et image de partage`, async ({ page, request }) => {
      await page.goto(`/${locale}/about`);
      const head = await readHead(page);
      expectAlternates(head, locale, "/about");
      await expectShareImage(request, head, locale);
    });
  }

  test("aide et mentions légales déclarent aussi leurs équivalents", async ({ page }) => {
    for (const path of ["/help", "/legal"]) {
      await page.goto(`/en${path}`);
      expectAlternates(await readHead(page), "en", path);
    }
  });

  test("les pages privées, la recherche et la page 404 restent hors index, sans adresse canonique", async ({ page }) => {
    for (const path of ["/fr/cart", "/fr/login", "/en/register", "/fr/products?q=tasse", "/mg/page-qui-n-existe-pas"]) {
      await page.goto(path);
      const head = await readHead(page);
      expect(head.robots, path).toContain("noindex");
      expect(head.canonical, path).toEqual([]);
      expect(head.alternates, path).toEqual({});
    }
  });

  test("le plan du site déclare les trois langues et x-default, robots.txt le signale", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`<loc>${BASE}/mg/about</loc>`);
    expect(sitemap).toContain(`<loc>${BASE}/en/legal</loc>`);
    expect(sitemap).toContain(`hreflang="x-default" href="${BASE}/fr/about"`);
    expect(sitemap).toContain(`hreflang="mg" href="${BASE}/mg/products"`);
    expect(sitemap).toMatch(new RegExp(`hreflang="en" href="${BASE}/en/products\\?category=[a-z0-9-]+"`));
    // Une entrée par langue, chacune avec ses quatre équivalents.
    const entries = sitemap.match(/<url>[\s\S]*?<\/url>/g)!;
    for (const entry of entries) expect(entry.match(/hreflang=/g), entry).toHaveLength(4);

    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain(`Sitemap: ${BASE}/sitemap.xml`);
    for (const path of ["/*/admin", "/*/account", "/*/cart", "/*/checkout"]) expect(robots).toContain(`Disallow: ${path}`);
  });
});
