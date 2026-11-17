import type { MetadataRoute } from "next";
import { siteBase } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/*/admin", "/*/account", "/*/checkout", "/*/order", "/*/cart", "/api"] },
    sitemap: `${siteBase()}/sitemap.xml`,
  };
}
