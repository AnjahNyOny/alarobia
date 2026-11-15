import { describe, expect, it } from "vitest";
import { addEntry, lineKey, MAX_LINES, MAX_QTY, parseCartEntries, quantityOf, setEntryQuantity } from "../cart-lines";

const P1 = "cmproduit000000000000001";
const P2 = "cmproduit000000000000002";
const C1 = "cmperso00000000000000001";
const C2 = "cmperso00000000000000002";

describe("parseCartEntries", () => {
  it("rend un panier vide pour un cookie absent, illisible ou qui n'est pas une liste", () => {
    expect(parseCartEntries(undefined)).toEqual([]);
    expect(parseCartEntries("{pas du json")).toEqual([]);
    expect(parseCartEntries('{"id":"x","q":1}')).toEqual([]);
  });
  it("lit les lignes simples et les lignes personnalisées", () => {
    expect(parseCartEntries(JSON.stringify([{ id: P1, q: 2 }, { id: P1, q: 1, c: C1 }]))).toEqual([{ id: P1, q: 2 }, { id: P1, q: 1, c: C1 }]);
  });
  it("écarte les lignes mal formées", () => {
    const raw = JSON.stringify([null, { id: 3, q: 1 }, { id: P1, q: 0 }, { id: P1, q: 1.5 }, { id: P2, q: 1, c: "../x" }, { id: P2, q: 1 }]);
    expect(parseCartEntries(raw)).toEqual([{ id: P2, q: 1 }]);
  });
  it("plafonne la quantité d'une ligne et le nombre de lignes", () => {
    expect(parseCartEntries(JSON.stringify([{ id: P1, q: 99 }]))).toEqual([{ id: P1, q: MAX_QTY }]);
    const many = Array.from({ length: MAX_LINES + 10 }, (_, i) => ({ id: `cmproduit${String(i).padStart(15, "0")}`, q: 1 }));
    expect(parseCartEntries(JSON.stringify(many))).toHaveLength(MAX_LINES);
  });
});

describe("lineKey", () => {
  it("vaut l'identifiant du produit pour une ligne simple", () => {
    expect(lineKey({ id: P1, q: 1 })).toBe(P1);
  });
  it("ajoute la personnalisation pour une ligne personnalisée", () => {
    expect(lineKey({ id: P1, q: 1, c: C1 })).toBe(`${P1}:${C1}`);
  });
});

describe("addEntry", () => {
  it("crée une ligne", () => {
    expect(addEntry([], { id: P1 }, 2, 10)).toEqual({ entries: [{ id: P1, q: 2 }], added: 2 });
  });
  it("augmente la ligne existante du même produit sans personnalisation", () => {
    expect(addEntry([{ id: P1, q: 2 }], { id: P1 }, 1, 10).entries).toEqual([{ id: P1, q: 3 }]);
  });
  it("fait deux lignes pour deux personnalisations différentes du même produit", () => {
    const { entries } = addEntry([{ id: P1, q: 1, c: C1 }], { id: P1, c: C2 }, 1, 10);
    expect(entries).toEqual([{ id: P1, q: 1, c: C1 }, { id: P1, q: 1, c: C2 }]);
  });
  it("sépare la ligne personnalisée de la ligne simple du même produit", () => {
    const { entries } = addEntry([{ id: P1, q: 1 }], { id: P1, c: C1 }, 1, 10);
    expect(entries.map(lineKey)).toEqual([P1, `${P1}:${C1}`]);
  });
  it("augmente la ligne de la même personnalisation", () => {
    expect(addEntry([{ id: P1, q: 1, c: C1 }], { id: P1, c: C1 }, 2, 10).entries).toEqual([{ id: P1, q: 3, c: C1 }]);
  });
  it("ne dépasse pas le stock, toutes lignes du produit confondues", () => {
    const result = addEntry([{ id: P1, q: 2, c: C1 }], { id: P1, c: C2 }, 2, 3);
    expect(result).toEqual({ entries: [{ id: P1, q: 2, c: C1 }, { id: P1, q: 1, c: C2 }], added: 1 });
  });
  it("n'ajoute rien quand le stock est déjà entièrement dans le panier", () => {
    const before = [{ id: P1, q: 3 }];
    expect(addEntry(before, { id: P1, c: C1 }, 1, 3)).toEqual({ entries: before, added: 0 });
  });
  it("ne dépasse pas la quantité maximale d'une ligne", () => {
    expect(addEntry([{ id: P1, q: MAX_QTY - 1 }], { id: P1 }, 5, 100)).toEqual({ entries: [{ id: P1, q: MAX_QTY }], added: 1 });
  });
  it("n'ajoute pas de ligne à un panier plein", () => {
    const full = Array.from({ length: MAX_LINES }, (_, i) => ({ id: `cmproduit${String(i).padStart(15, "0")}`, q: 1 }));
    // Un produit absent du panier : il lui faudrait une ligne de plus.
    expect(addEntry(full, { id: "cmautreproduit0000000001" }, 1, 10).added).toBe(0);
    // Un produit déjà présent peut encore voir sa quantité augmenter.
    expect(addEntry(full, { id: full[0].id }, 1, 10).added).toBe(1);
  });
  it("ne modifie pas la liste reçue", () => {
    const before = [{ id: P1, q: 1 }];
    addEntry(before, { id: P1 }, 1, 10);
    expect(before).toEqual([{ id: P1, q: 1 }]);
  });
});

describe("setEntryQuantity", () => {
  const entries = [{ id: P1, q: 1 }, { id: P1, q: 2, c: C1 }, { id: P2, q: 1 }];
  it("change la quantité de la seule ligne visée", () => {
    expect(setEntryQuantity(entries, `${P1}:${C1}`, 4)).toEqual([{ id: P1, q: 1 }, { id: P1, q: 4, c: C1 }, { id: P2, q: 1 }]);
  });
  it("retire la ligne quand la quantité tombe à zéro, sans toucher aux autres lignes du produit", () => {
    expect(setEntryQuantity(entries, P1, 0)).toEqual([{ id: P1, q: 2, c: C1 }, { id: P2, q: 1 }]);
  });
  it("plafonne la quantité et ignore les décimales", () => {
    expect(setEntryQuantity(entries, P2, 99.7)[2].q).toBe(MAX_QTY);
    expect(setEntryQuantity(entries, P2, 2.9)[2].q).toBe(2);
  });
});

describe("quantityOf", () => {
  it("additionne toutes les lignes d'un produit", () => {
    expect(quantityOf([{ id: P1, q: 1 }, { id: P1, q: 2, c: C1 }, { id: P2, q: 5 }], P1)).toBe(3);
  });
});
