import type { MetadataRoute } from "next";
import { currentDeployContext, indexable } from "@/lib/deploy-context";
import { siteBase } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // Déploiement de branche ou aperçu (PLAN.md 7.6) : rien à explorer. next.config.ts y ajoute X-Robots-Tag: noindex.
  if (!indexable(currentDeployContext())) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/*/admin", "/*/account", "/*/checkout", "/*/order", "/*/cart", "/api"] },
    sitemap: `${siteBase()}/sitemap.xml`,
  };
}
