import { describe, expect, it } from "vitest";
import { addressLines, normalizePhone, PROVINCES } from "../address";

describe("normalizePhone", () => {
  it("ramène toutes les écritures d'un numéro malgache à la forme nationale", () => {
    for (const input of ["034 12 345 67", "0341234567", "+261 34 12 345 67", "261341234567", "034-12-345-67", "034.12.345.67", "34 12 345 67", "  +261(0)34 12 345 67 "])
      expect(normalizePhone(input), input).toBe("034 12 345 67");
  });
  it("accepte les préfixes mobiles 032, 033, 034, 037, 038 et le fixe 020", () => {
    expect(normalizePhone("0321122233")).toBe("032 11 222 33");
    expect(normalizePhone("0331122233")).toBe("033 11 222 33");
    expect(normalizePhone("0371122233")).toBe("037 11 222 33");
    expect(normalizePhone("0381122233")).toBe("038 11 222 33");
    expect(normalizePhone("020 22 123 45")).toBe("020 22 123 45");
  });
  it("refuse ce qui n'est pas un numéro malgache complet", () => {
    for (const input of ["", "abc", "06 11 22 33 44", "+33 6 12 34 56 78", "034 12 345", "034 12 345 678", "050 12 345 67", "034 12 34a 67"]) expect(normalizePhone(input), input).toBeNull();
  });
});

describe("PROVINCES", () => {
  it("liste les six provinces de Madagascar", () => {
    expect(PROVINCES).toEqual(["Antananarivo", "Antsiranana", "Fianarantsoa", "Mahajanga", "Toamasina", "Toliara"]);
  });
});

describe("addressLines", () => {
  const address = { fullName: "Hery Rakotomalala", line1: "Lot II M 45", line2: "En face de l'épicerie Tsara", district: "Ankadivato", postalCode: "101", city: "Antananarivo", province: "Antananarivo", phone: "034 12 345 67" };
  it("écrit l'adresse comme on la lit à Madagascar : lot, quartier, repère, ville, province, téléphone", () => {
    expect(addressLines(address)).toEqual(["Hery Rakotomalala", "Lot II M 45", "Ankadivato", "En face de l'épicerie Tsara", "101 Antananarivo", "034 12 345 67"]);
  });
  it("ne répète pas la province quand la ville porte le même nom, et l'écrit sinon", () => {
    expect(addressLines({ ...address, city: "Antsirabe", postalCode: "110" })).toContain("110 Antsirabe, Antananarivo");
  });
  it("n'affiche ni ligne vide ni espace en trop quand le code postal, le repère ou le quartier manquent", () => {
    expect(addressLines({ ...address, postalCode: "", line2: null, district: "" })).toEqual(["Hery Rakotomalala", "Lot II M 45", "Antananarivo", "034 12 345 67"]);
  });
});
