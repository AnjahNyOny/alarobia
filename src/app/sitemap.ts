import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { locales } from "@/i18n/routing";
import { catalogPath, languageAlternates, localizedUrl, siteBase } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBase();
  const [products, categories] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } }),
    db.category.findMany({ select: { slug: true } }),
  ]);
  const paths: { path: string; lastModified?: Date; priority: number }[] = [
    { path: "", priority: 1 },
    { path: catalogPath({}), priority: 0.9 },
    ...categories.map((c) => ({ path: catalogPath({ category: c.slug }), priority: 0.7 })),
    ...products.map((p) => ({ path: `/products/${p.slug}`, lastModified: p.updatedAt, priority: 0.8 })),
    { path: "/about", priority: 0.3 },
    { path: "/help", priority: 0.3 },
    { path: "/legal", priority: 0.1 },
  ];
  // Une entrée par langue, chacune déclarant ses équivalents (hreflang), comme le <head> de la page (src/lib/seo.ts).
  return paths.flatMap(({ path, lastModified, priority }) =>
    locales.map((locale) => ({ url: localizedUrl(base, locale, path), lastModified, priority, alternates: { languages: languageAlternates(base, path) } }))
  );
}
