import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { categories, customers, products, settings, shippingZones } from "../../../prisma/catalog.mjs";
import { normalizePhone, PROVINCES } from "../address";
import { formatPrice, slugify } from "../format";

const filled = (value: unknown) => typeof value === "string" && value.trim() !== "";

describe("catalogue de démonstration", () => {
  it("propose les six rayons du plan, chacun avec au moins un produit", () => {
    expect(categories.map((c) => c.slug)).toEqual(["cuisine", "maison", "vannerie-textile", "epicerie", "soin", "electronique"]);
    for (const c of categories) expect(products.some((p) => p.category === c.slug), `rayon vide : ${c.slug}`).toBe(true);
  });

  it("rattache chaque produit à un rayon existant", () => {
    const slugs = new Set(categories.map((c) => c.slug));
    for (const p of products) expect(slugs.has(p.category), `${p.name} → ${p.category}`).toBe(true);
  });

  it("donne des prix en ariary entiers, arrondis à la centaine comme sur un marché", () => {
    for (const p of products) {
      expect(Number.isInteger(p.priceAr) && p.priceAr >= 1000 && p.priceAr % 100 === 0, `${p.name} : ${p.priceAr}`).toBe(true);
      if (p.compareAtAr != null) expect(p.compareAtAr, `prix barré de ${p.name}`).toBeGreaterThan(p.priceAr);
    }
  });

  it("contient un gros montant pour éprouver l'affichage (point de vigilance 6)", () => {
    const big = products.filter((p) => p.priceAr >= 1_000_000);
    expect(big.length).toBeGreaterThan(0);
    expect(formatPrice(big[0].priceAr * 100, "MGA", "fr")).toMatch(/^\d\s\d{3}\s\d{3}\sAr$/);
  });

  it("traduit le nom et la description de chaque rayon en anglais et en malgache", () => {
    for (const c of categories)
      for (const locale of ["en", "mg"] as const) {
        expect(filled(c[locale]?.name), `${c.slug} : nom ${locale}`).toBe(true);
        expect(filled(c[locale]?.description), `${c.slug} : description ${locale}`).toBe(true);
      }
  });

  it("traduit le nom, l'accroche et la description de chaque produit en anglais et en malgache", () => {
    for (const p of products)
      for (const locale of ["en", "mg"] as const)
        for (const field of ["name", "tagline", "description"] as const)
          expect(filled(p[locale]?.[field]), `${p.name} : ${field} ${locale}`).toBe(true);
  });

  it("traduit les caractéristiques en anglais avec le même nombre de lignes qu'en français", () => {
    for (const p of products) expect(p.en.details.split("\n").length, p.name).toBe(p.details.split("\n").length);
  });

  it("n'utilise que des photos présentes dans public/products", () => {
    for (const p of products) {
      expect(p.images.length, p.name).toBeGreaterThan(0);
      for (const image of p.images) expect(existsSync(path.join(process.cwd(), "public/products", `${image}.jpg`)), `${p.name} : ${image}.jpg`).toBe(true);
    }
  });

  it("donne à chaque produit une adresse unique", () => {
    const slugs = products.map((p) => slugify(p.name));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("ne parle plus d'euros", () => {
    expect(JSON.stringify({ categories, products, settings })).not.toMatch(/€|\beuros?\b/i);
  });
});

describe("clients de démonstration", () => {
  it("habitent à Madagascar, avec un numéro de téléphone malgache", () => {
    expect(customers.length).toBeGreaterThanOrEqual(6);
    for (const c of customers) {
      expect(c.country, c.name).toBe("Madagascar");
      expect(normalizePhone(c.phone), c.name).toBe(c.phone);
      expect(PROVINCES, c.name).toContain(c.province);
      expect(filled(c.district), `quartier de ${c.name}`).toBe(true);
    }
  });
});

describe("zones de livraison de démonstration", () => {
  it("vont de la capitale aux localités éloignées, du moins cher au plus cher", () => {
    expect(shippingZones.length).toBeGreaterThanOrEqual(3);
    const prices = shippingZones.map((z) => z.priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
  it("ont un nom dans les trois langues, un tarif en ariary entiers et un délai cohérent", () => {
    for (const z of shippingZones) {
      for (const key of ["name", "nameEn", "nameMg"] as const) expect(filled(z[key]), `${z.name} : ${key}`).toBe(true);
      expect(z.priceCents % 100, z.name).toBe(0);
      expect(z.minDays, z.name).toBeGreaterThanOrEqual(1);
      expect(z.maxDays, z.name).toBeGreaterThanOrEqual(z.minDays);
    }
  });
});

describe("réglages de démonstration", () => {
  it("sont en ariary, avec un bandeau d'annonce dans les trois langues", () => {
    expect(settings.currency).toBe("MGA");
    for (const key of ["announcement", "announcementEn", "announcementMg"] as const) expect(filled(settings[key]), key).toBe(true);
    expect(settings.freeShippingThresholdCents).toBeGreaterThan(Math.max(...shippingZones.map((z) => z.priceCents)));
  });
});
