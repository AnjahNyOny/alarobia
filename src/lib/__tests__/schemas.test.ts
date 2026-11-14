import { describe, expect, it } from "vitest";
import { makeSchemas, zoneSchema } from "../schemas";

// Le traducteur renvoie la clé : on vérifie quel message est choisi, pas sa formulation.
const { address } = makeSchemas((key) => key);
const valid = { fullName: "Hery Rakotomalala", phone: "+261 34 12 345 67", line1: "Lot II M 45", district: "Ankadivato", city: "Antananarivo", province: "Antananarivo" };
const errorsOf = (input: Record<string, unknown>) => {
  const result = address.safeParse(input);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
};

describe("schéma d'adresse", () => {
  it("accepte une adresse malgache sans code postal ni repère, et normalise le téléphone", () => {
    const result = address.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ phone: "034 12 345 67", postalCode: "", line2: "" });
  });
  it("ne demande plus de pays", () => {
    expect(errorsOf(valid)).not.toHaveProperty("country");
  });
  it("exige le quartier et la ville", () => {
    expect(errorsOf({ ...valid, district: "  ", city: "" })).toEqual({ district: "required", city: "required" });
  });
  it("refuse une province inconnue ou non choisie", () => {
    expect(errorsOf({ ...valid, province: "" })).toEqual({ province: "provinceRequired" });
    expect(errorsOf({ ...valid, province: "Bretagne" })).toEqual({ province: "provinceRequired" });
  });
  it("refuse un téléphone qui n'est pas malgache", () => {
    expect(errorsOf({ ...valid, phone: "06 11 22 33 44" })).toEqual({ phone: "phoneInvalid" });
    expect(errorsOf({ ...valid, phone: undefined })).toEqual({ phone: "phoneInvalid" });
  });
  it("accepte un code postal à trois chiffres et refuse les autres", () => {
    expect(address.safeParse({ ...valid, postalCode: "101" }).success).toBe(true);
    expect(errorsOf({ ...valid, postalCode: "75001" })).toEqual({ postalCode: "postalCodeInvalid" });
  });
});

describe("schéma d'une zone de livraison (back-office)", () => {
  const zone = { name: "Nosy Be", nameEn: "", nameMg: "", price: "20 000", minDays: "4", maxDays: "7", position: "4", active: "on" };
  const zoneErrors = (input: Record<string, unknown>) => {
    const result = zoneSchema.safeParse(input);
    return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
  };
  it("convertit le tarif saisi en ariary et la case « active »", () => {
    expect(zoneSchema.parse(zone)).toMatchObject({ name: "Nosy Be", priceCents: 2000000, minDays: 4, maxDays: 7, position: 4, active: true });
    expect(zoneSchema.parse({ ...zone, active: undefined, price: "0" })).toMatchObject({ active: false, priceCents: 0 });
  });
  it("refuse un délai maximal plus court que le délai minimal", () => {
    expect(zoneErrors({ ...zone, minDays: "5", maxDays: "3" })).toEqual(["maxDays"]);
  });
  it("refuse un nom vide, un tarif illisible ou au-delà du plafond, un délai négatif", () => {
    expect(zoneErrors({ ...zone, name: " " })).toEqual(["name"]);
    expect(zoneErrors({ ...zone, price: "gratuit" })).toEqual(["price"]);
    expect(zoneErrors({ ...zone, price: "25 000 000" })).toEqual(["price"]);
    expect(zoneErrors({ ...zone, minDays: "-1" })).toEqual(["minDays"]);
  });
});
