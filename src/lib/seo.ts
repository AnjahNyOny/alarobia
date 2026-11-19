import { defaultLocale, isLocale, locales, type Locale } from "@/i18n/routing";
import { currentPreviewUrl } from "@/lib/deploy-context";

/**
 * Référencement multilingue : adresses canoniques, équivalents par langue (hreflang) et Open Graph.
 * Les pages et le plan du site (src/app/sitemap.ts) passent tous par ici : ils ne peuvent pas diverger.
 */

/**
 * Adresse publique du site, sans barre finale : `NEXT_PUBLIC_SITE_URL` (domaine choisi), sinon, hors production,
 * l'adresse du déploiement (branche `preview`, aperçu : `currentPreviewUrl`, deploy-context.ts), sinon `URL`, l'adresse
 * principale que Netlify donne à la compilation et aux fonctions, celle de la production même dans un aperçu
 * (https://docs.netlify.com/configure-builds/environment-variables/), sinon le serveur local. Lue côté serveur seulement
 * (métadonnées, plan du site, robots.txt) : aucun composant client ne l'importe, sinon `URL`, qui n'est pas préfixée
 * NEXT_PUBLIC_, y serait vide.
 */
export function siteBase(
  configured: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
  platform: string | undefined = process.env.URL,
  preview: string = currentPreviewUrl(),
) {
  return (configured || preview || platform || "http://localhost:3000").replace(/\/+$/, "");
}

/** Adresse absolue d'un chemin commun (« /products/tasse », « » pour l'accueil) dans une langue. */
export function localizedUrl(base: string, locale: Locale, path: string) {
  return `${base}/${locale}${path === "/" ? "" : path}`;
}

/** Les trois langues, plus « x-default » (le français) pour un visiteur dont la langue n'est pas proposée. */
export function languageAlternates(base: string, path: string): Record<Locale | "x-default", string> {
  const languages = Object.fromEntries(locales.map((l) => [l, localizedUrl(base, l, path)])) as Record<Locale, string>;
  return { ...languages, "x-default": languages[defaultLocale] };
}

/** Champ `alternates` de l'API Metadata : il remplace celui du layout, chaque page indexable le déclare. */
export function pageAlternates(base: string, locale: string, path: string) {
  return { canonical: localizedUrl(base, isLocale(locale) ? locale : defaultLocale, path), languages: languageAlternates(base, path) };
}

/**
 * Chemin canonique du catalogue : le rayon et le numéro de page changent la liste, ils comptent.
 * Le tri, les fourchettes de prix, « en stock » et « promotions » ne font que réordonner ou filtrer
 * la même liste : ces variantes renvoient vers la liste de référence.
 */
export function catalogPath({ category, page }: { category?: string; page?: number }) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (page !== undefined && Number.isInteger(page) && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}

/** Prix pour schema.org : unités mineures → unités, point décimal, pas de « .00 » sur un montant rond. */
export function schemaPrice(cents: number) {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

const OG_LOCALE: Record<Locale, string> = { fr: "fr_FR", en: "en_US", mg: "mg_MG" };

/**
 * Champs Open Graph communs. Un `openGraph` de page remplace entièrement celui du layout :
 * une page qui en déclare un repart de cette base pour ne perdre ni le nom du site ni la langue.
 */
export function openGraphBase(raw: string, siteName: string) {
  const locale = isLocale(raw) ? raw : defaultLocale;
  return {
    type: "website" as const,
    siteName,
    locale: OG_LOCALE[locale],
    alternateLocale: locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
  };
}

/** Données structurées prêtes pour une balise <script type="application/ld+json"> : aucun « < » ne peut la refermer. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
