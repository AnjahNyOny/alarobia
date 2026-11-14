import { describe, expect, it } from "vitest";
import { formatDate, formatPrice, weekdayName } from "../format";

// Intl insère des espaces insécables (fines ou non) : on les ramène à des espaces simples pour comparer.
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("formatPrice", () => {
  it("affiche l'ariary sans décimales, avec le symbole Ar", () => {
    expect(plain(formatPrice(2500000, "MGA", "fr"))).toBe("25 000 Ar");
    expect(plain(formatPrice(2500000, "MGA", "mg"))).toBe("25 000 Ar");
    expect(plain(formatPrice(2500000, "MGA", "en"))).toBe("Ar 25,000");
  });
  it("tient les gros montants", () => {
    expect(plain(formatPrice(125000000, "MGA", "fr"))).toBe("1 250 000 Ar");
  });
  it("arrondit les fractions d'ariary au lieu de les afficher", () => {
    expect(plain(formatPrice(2500050, "MGA", "fr"))).toBe("25 001 Ar");
  });
  it("garde le format habituel des autres devises", () => {
    expect(plain(formatPrice(1250, "EUR", "fr"))).toBe("12,50 €");
    expect(plain(formatPrice(1200, "EUR", "fr"))).toBe("12 €");
    expect(plain(formatPrice(1250, "EUR", "en"))).toBe("€12.50");
  });
  it("ne casse pas le montant et son symbole sur deux lignes", () => {
    expect(formatPrice(2500000, "MGA", "fr")).not.toContain(" ");
  });
});

describe("formatDate", () => {
  const date = new Date(2026, 10, 18); // mercredi 18 novembre 2026
  it("écrit la date longue dans chaque langue", () => {
    expect(formatDate(date, "fr")).toBe("18 novembre 2026");
    expect(formatDate(date, "en")).toBe("November 18, 2026");
    expect(formatDate(date, "mg")).toBe("18 Novambra 2026");
  });
  it("propose une forme courte avec le jour de la semaine", () => {
    expect(formatDate(date, "fr", "weekday")).toBe("mercredi 18 novembre");
    expect(formatDate(date, "en", "weekday")).toBe("Wednesday, November 18");
    expect(formatDate(date, "mg", "weekday")).toBe("Alarobia 18 Novambra");
  });
});

describe("weekdayName", () => {
  it("donne le jour en malgache sans dépendre du moteur", () => {
    const monday = new Date(2026, 10, 16);
    const names = Array.from({ length: 7 }, (_, i) => weekdayName(new Date(2026, 10, 16 + i), "mg"));
    expect(names).toEqual(["Alatsinainy", "Talata", "Alarobia", "Alakamisy", "Zoma", "Sabotsy", "Alahady"]);
    expect(weekdayName(monday, "fr")).toBe("lundi");
    expect(weekdayName(monday, "en")).toBe("Monday");
  });
});
