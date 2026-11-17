import { describe, expect, it } from "vitest";
import { flattenMessages, mergeMessages } from "../messages";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import mg from "../../../messages/mg.json";

describe("mergeMessages", () => {
  const base = { cart: { title: "Panier", empty: "Votre panier est vide" }, ok: "D'accord" };
  it("remplace les clés traduites et garde le français pour les autres", () => {
    expect(mergeMessages(base, { cart: { title: "Harona" } })).toEqual({ cart: { title: "Harona", empty: "Votre panier est vide" }, ok: "D'accord" });
  });
  it("ignore une traduction vide", () => {
    expect(mergeMessages(base, { ok: "  " })).toEqual(base);
  });
  it("ignore une clé inconnue du socle ou de forme différente", () => {
    expect(mergeMessages(base, { inconnu: "x", cart: "pas un objet" } as never)).toEqual({ ...base, inconnu: "x" });
  });
});

describe("fichiers de messages", () => {
  const reference = flattenMessages(fr);
  for (const [name, file] of [["en", en], ["mg", mg]] as const) {
    it(`${name}.json a les mêmes clés et les mêmes variables que fr.json`, () => {
      const other = flattenMessages(file);
      const missing = Object.keys(reference).filter((k) => !(k in other));
      const extra = Object.keys(other).filter((k) => !(k in reference));
      const variables = Object.keys(reference).filter((k) => k in other && reference[k].join() !== other[k].join());
      expect({ missing, extra, variables }).toEqual({ missing: [], extra: [], variables: [] });
    });
  }
});
