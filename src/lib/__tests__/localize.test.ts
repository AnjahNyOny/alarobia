import { describe, expect, it } from "vitest";
import { localize, missingLocales, untranslatedFields } from "../localize";

const product = {
  id: "p1",
  name: "Panier en raphia",
  tagline: "Tressé à la main",
  description: "Un panier solide pour le marché.",
  priceCents: 2500000,
  translations: [
    { locale: "en", name: "Raffia basket", tagline: "", description: "A sturdy basket for the market." },
    { locale: "mg", name: "Harona rofia", tagline: "Vita tanana", description: "   " },
  ],
};
const fields = ["name", "tagline", "description"] as const;

describe("localize", () => {
  it("renvoie le français tel quel pour la langue de référence", () => {
    expect(localize(product, "fr", fields)).toMatchObject({ name: "Panier en raphia", tagline: "Tressé à la main" });
  });
  it("remplace chaque champ traduit", () => {
    expect(localize(product, "en", fields)).toMatchObject({ name: "Raffia basket", description: "A sturdy basket for the market." });
  });
  it("garde le français champ par champ quand la traduction est vide ou faite d'espaces", () => {
    expect(localize(product, "en", fields).tagline).toBe("Tressé à la main");
    expect(localize(product, "mg", fields)).toMatchObject({ name: "Harona rofia", tagline: "Vita tanana", description: "Un panier solide pour le marché." });
  });
  it("garde le français quand la langue n'a aucune traduction", () => {
    expect(localize({ ...product, translations: [] }, "mg", fields).name).toBe("Panier en raphia");
  });
  it("ne touche pas aux autres champs et ne modifie pas l'objet d'origine", () => {
    const result = localize(product, "en", fields);
    expect(result.priceCents).toBe(2500000);
    expect(product.name).toBe("Panier en raphia");
  });
});

describe("missingLocales", () => {
  it("liste les langues où un champ obligatoire manque", () => {
    expect(missingLocales(product, ["name", "description"])).toEqual(["mg"]);
    expect(missingLocales({ translations: [] }, ["name"])).toEqual(["en", "mg"]);
    expect(missingLocales(product, ["name"])).toEqual([]);
  });
});

describe("untranslatedFields", () => {
  const base = { name: "Panier en raphia", tagline: "Tressé à la main", description: "Un panier solide.", details: "" };
  const fields = ["name", "tagline", "description", "details"] as const;

  it("liste les champs remplis en français et vides dans la traduction, dans l'ordre demandé", () => {
    expect(untranslatedFields(base, { name: "Raffia basket", tagline: "", description: "" }, fields)).toEqual(["tagline", "description"]);
  });
  it("ne réclame pas un champ vide en français", () => {
    expect(untranslatedFields(base, { name: "Raffia basket", tagline: "Hand-woven", description: "A sturdy basket." }, fields)).toEqual([]);
  });
  it("compte comme vide un champ fait d'espaces, des deux côtés", () => {
    expect(untranslatedFields({ ...base, details: "   " }, { name: "  ", tagline: "Hand-woven", description: "A sturdy basket." }, fields)).toEqual(["name"]);
  });
  it("réclame tous les champs remplis quand la traduction est absente", () => {
    expect(untranslatedFields(base, undefined, fields)).toEqual(["name", "tagline", "description"]);
  });
});
