import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogPath, jsonLdScript, languageAlternates, localizedUrl, openGraphBase, pageAlternates, schemaPrice, siteBase } from "../seo";

const BASE = "https://alarobia.mg";

describe("siteBase", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("retire la barre finale de l'adresse configurée", () => {
    expect(siteBase("https://alarobia.mg/")).toBe("https://alarobia.mg");
    expect(siteBase("https://alarobia.mg")).toBe("https://alarobia.mg");
  });
  it("retombe sur le serveur local sans adresse configurée", () => {
    expect(siteBase(undefined, undefined)).toBe("http://localhost:3000");
    expect(siteBase("", "")).toBe("http://localhost:3000");
  });
  it("préfère l'adresse configurée à celle que donne Netlify", () => {
    expect(siteBase("https://alarobia.mg", "https://alarobia.netlify.app")).toBe("https://alarobia.mg");
  });
  it("se rabat sur l'adresse principale que donne Netlify (URL) quand NEXT_PUBLIC_SITE_URL est vide, sans barre finale", () => {
    expect(siteBase(undefined, "https://alarobia.netlify.app/")).toBe("https://alarobia.netlify.app");
    expect(siteBase("", "https://alarobia.netlify.app")).toBe("https://alarobia.netlify.app");
  });
  it("lit par défaut NEXT_PUBLIC_SITE_URL, puis URL, puis le serveur local", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://alarobia.mg/");
    vi.stubEnv("URL", "https://alarobia.netlify.app");
    expect(siteBase()).toBe("https://alarobia.mg");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(siteBase()).toBe("https://alarobia.netlify.app");
    vi.stubEnv("URL", "");
    expect(siteBase()).toBe("http://localhost:3000");
  });
});

describe("localizedUrl", () => {
  it("préfixe le chemin par la langue, sans barre finale pour l'accueil", () => {
    expect(localizedUrl(BASE, "fr", "")).toBe("https://alarobia.mg/fr");
    expect(localizedUrl(BASE, "mg", "/")).toBe("https://alarobia.mg/mg");
    expect(localizedUrl(BASE, "en", "/products/tasse")).toBe("https://alarobia.mg/en/products/tasse");
    expect(localizedUrl(BASE, "fr", "/products?category=paniers")).toBe("https://alarobia.mg/fr/products?category=paniers");
  });
});

describe("languageAlternates", () => {
  it("déclare les trois langues et le français par défaut", () => {
    expect(languageAlternates(BASE, "/about")).toEqual({
      fr: "https://alarobia.mg/fr/about",
      en: "https://alarobia.mg/en/about",
      mg: "https://alarobia.mg/mg/about",
      "x-default": "https://alarobia.mg/fr/about",
    });
  });
});

describe("pageAlternates", () => {
  it("donne l'adresse canonique dans la langue de la page et ses équivalents", () => {
    const alternates = pageAlternates(BASE, "mg", "");
    expect(alternates.canonical).toBe("https://alarobia.mg/mg");
    expect(alternates.languages).toEqual(languageAlternates(BASE, ""));
  });
});

describe("catalogPath", () => {
  it("garde le rayon et la page, pas les tris ni les filtres", () => {
    expect(catalogPath({})).toBe("/products");
    expect(catalogPath({ category: "paniers" })).toBe("/products?category=paniers");
    expect(catalogPath({ category: "paniers", page: 2 })).toBe("/products?category=paniers&page=2");
    expect(catalogPath({ page: 3 })).toBe("/products?page=3");
  });
  it("ignore la première page et une page invalide", () => {
    expect(catalogPath({ page: 1 })).toBe("/products");
    expect(catalogPath({ page: 0 })).toBe("/products");
    expect(catalogPath({ page: Number.NaN })).toBe("/products");
  });
  it("encode le nom du rayon", () => {
    expect(catalogPath({ category: "a&b c" })).toBe("/products?category=a%26b+c");
  });
});

describe("schemaPrice", () => {
  it("convertit les unités mineures en ariary, sans décimales inutiles", () => {
    expect(schemaPrice(2_500_000)).toBe("25000");
    expect(schemaPrice(100)).toBe("1");
    expect(schemaPrice(0)).toBe("0");
  });
  it("garde deux décimales, avec un point, pour un montant qui n'est pas rond", () => {
    expect(schemaPrice(1250)).toBe("12.50");
    expect(schemaPrice(1205)).toBe("12.05");
  });
});

describe("openGraphBase", () => {
  it("donne la langue Open Graph de la page et les deux autres en variantes", () => {
    expect(openGraphBase("en", "Alarobia")).toEqual({ type: "website", siteName: "Alarobia", locale: "en_US", alternateLocale: ["fr_FR", "mg_MG"] });
    expect(openGraphBase("mg", "Alarobia").locale).toBe("mg_MG");
  });
});

describe("jsonLdScript", () => {
  it("sérialise sans laisser fermer la balise script", () => {
    const out = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
