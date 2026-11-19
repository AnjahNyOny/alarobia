import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "../robots";

/*
 * robots.txt : en production (et en local), les règles du site ; sur un déploiement de branche ou un aperçu, tout est
 * interdit. `DEPLOY_CONTEXT` est figée à la compilation par next.config.ts ; ici, on la pose comme elle y arriverait.
 */

afterEach(() => vi.unstubAllEnvs());

describe("robots.txt", () => {
  it("production : tout est permis sauf les pages privées, avec le plan du site", () => {
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://alarobia.example");
    const result = robots();
    expect(result.rules).toMatchObject({ userAgent: "*", allow: "/" });
    expect(result.sitemap).toBe("https://alarobia.example/sitemap.xml");
  });

  it("local (contexte absent) : comme la production", () => {
    vi.stubEnv("DEPLOY_CONTEXT", undefined);
    expect(robots().rules).toMatchObject({ userAgent: "*", allow: "/" });
  });

  it("déploiement de branche, aperçu ou contexte inconnu : tout est interdit, sans plan du site", () => {
    for (const context of ["branch-deploy", "deploy-preview", "unknown"]) {
      vi.stubEnv("DEPLOY_CONTEXT", context);
      expect(robots(), context).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    }
  });
});
