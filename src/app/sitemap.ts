import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { locales } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [products, categories] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } }),
    db.category.findMany({ select: { slug: true } }),
  ]);
  const paths: { path: string; lastModified?: Date; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/products", priority: 0.9 },
    ...categories.map((c) => ({ path: `/products?category=${c.slug}`, priority: 0.7 })),
    ...products.map((p) => ({ path: `/products/${p.slug}`, lastModified: p.updatedAt, priority: 0.8 })),
    { path: "/about", priority: 0.3 },
    { path: "/help", priority: 0.3 },
  ];
  // Une entrée par langue, chacune déclarant ses équivalents (hreflang).
  return paths.flatMap(({ path, lastModified, priority }) =>
    locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      lastModified,
      priority,
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${base}/${l}${path}`])) },
    }))
  );
}
