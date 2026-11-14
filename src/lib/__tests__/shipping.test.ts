import { describe, expect, it } from "vitest";
import { estimateDelivery, sameDay, weekFrom } from "../shipping";

const d = (day: number) => new Date(2026, 10, day, 15, 30); // novembre 2026 : le 13 est un vendredi

describe("estimateDelivery", () => {
  it("compte les jours ouvrés à partir du lendemain", () => {
    expect(estimateDelivery(d(16), 3).getDate()).toBe(19); // lundi → jeudi
  });
  it("saute le dimanche", () => {
    expect(estimateDelivery(d(13), 3).getDate()).toBe(17); // vendredi → samedi, lundi, mardi
    expect(estimateDelivery(d(14), 1).getDate()).toBe(16); // samedi → lundi
    expect(estimateDelivery(d(15), 1).getDate()).toBe(16); // dimanche → lundi
  });
  it("passe d'un mois à l'autre", () => {
    const result = estimateDelivery(new Date(2026, 10, 28), 3); // samedi 28 → lundi 30, mardi 1er, mercredi 2
    expect([result.getMonth(), result.getDate()]).toEqual([11, 2]);
  });
  it("ne modifie pas la date reçue et renvoie le jour même pour un délai nul", () => {
    const from = d(16);
    expect(sameDay(estimateDelivery(from, 0), from)).toBe(true);
    expect(from.getDate()).toBe(16);
  });
});

describe("weekFrom", () => {
  it("renvoie sept jours consécutifs à partir de la date", () => {
    const days = weekFrom(d(13));
    expect(days.map((x) => x.getDate())).toEqual([13, 14, 15, 16, 17, 18, 19]);
    expect(days.map((x) => x.getDay())).toEqual([5, 6, 0, 1, 2, 3, 4]);
  });
});
