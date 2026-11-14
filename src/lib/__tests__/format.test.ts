import { describe, expect, it } from "vitest";
import { centsToInput, parseAmountToCents, slugify } from "../format";

describe("parseAmountToCents", () => {
  it("accepte la virgule française et le point", () => {
    expect(parseAmountToCents("12,50")).toBe(1250);
    expect(parseAmountToCents("12.5")).toBe(1250);
  });
  it("ignore les espaces des milliers", () => {
    expect(parseAmountToCents("1 250 000")).toBe(125000000);
  });
  it("n'accumule pas d'erreur de flottant", () => {
    expect(parseAmountToCents("19,99")).toBe(1999);
    expect(parseAmountToCents("0,07")).toBe(7);
  });
  it("renvoie NaN pour une saisie qui n'est pas un nombre", () => {
    expect(parseAmountToCents("abc")).toBeNaN();
    expect(parseAmountToCents("12,5,3")).toBeNaN();
  });
});

describe("centsToInput", () => {
  it("formate pour un champ de saisie", () => {
    expect(centsToInput(1250)).toBe("12,50");
    expect(centsToInput(null)).toBe("");
  });
});

describe("slugify", () => {
  it("retire accents, majuscules et ponctuation", () => {
    expect(slugify("Sérum Éclat à la vitamine C")).toBe("serum-eclat-a-la-vitamine-c");
    expect(slugify("  Thé — noir !  ")).toBe("the-noir");
  });
  it("renvoie une chaîne vide si rien n'est exploitable", () => {
    expect(slugify("———")).toBe("");
  });
});
