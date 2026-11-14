import { describe, expect, it } from "vitest";
import { deliveryWindow, estimateDelivery, madagascarTime, sameDay, weekFrom, zoneName } from "../shipping";

const d = (day: number) => new Date(2026, 10, day, 15, 30); // novembre 2026 : le 13 est un vendredi
const zone = (minDays: number, maxDays: number) => ({ minDays, maxDays });

describe("estimateDelivery", () => {
  it("compte les jours ouvrés à partir du lendemain", () => {
    expect(estimateDelivery(d(16), zone(1, 3)).getDate()).toBe(19); // lundi → jeudi
  });
  it("saute le dimanche", () => {
    expect(estimateDelivery(d(13), zone(1, 3)).getDate()).toBe(17); // vendredi → samedi, lundi, mardi
    expect(estimateDelivery(d(14), zone(1, 1)).getDate()).toBe(16); // samedi → lundi
    expect(estimateDelivery(d(15), zone(1, 1)).getDate()).toBe(16); // dimanche → lundi
  });
  it("passe d'un mois à l'autre", () => {
    const result = estimateDelivery(new Date(2026, 10, 28), zone(1, 3)); // samedi 28 → lundi 30, mardi 1er, mercredi 2
    expect([result.getMonth(), result.getDate()]).toEqual([11, 2]);
  });
  it("ne modifie pas la date reçue et renvoie le jour même pour un délai nul", () => {
    const from = d(16);
    expect(sameDay(estimateDelivery(from, zone(0, 0)), from)).toBe(true);
    expect(from.getDate()).toBe(16);
  });
});

describe("estimateDelivery avec une zone", () => {
  it("promet la date la plus tardive du délai de la zone", () => {
    expect(estimateDelivery(d(16), zone(3, 5)).getDate()).toBe(21); // lundi + 5 jours ouvrés → samedi
  });
});

describe("deliveryWindow", () => {
  it("donne la première et la dernière date possibles, sans dimanche", () => {
    const { earliest, latest } = deliveryWindow(d(13), zone(1, 2)); // vendredi → samedi, puis lundi
    expect([earliest.getDate(), latest.getDate()]).toEqual([14, 16]);
  });
});

describe("madagascarTime", () => {
  it("donne la date et l'heure à Madagascar (UTC+3), quel que soit le fuseau du serveur", () => {
    const local = madagascarTime(new Date("2026-11-14T22:30:00Z")); // déjà dimanche 15 à Antananarivo
    expect([local.getFullYear(), local.getMonth(), local.getDate(), local.getHours(), local.getMinutes(), local.getDay()]).toEqual([2026, 10, 15, 1, 30, 0]);
  });
});

describe("zoneName", () => {
  const z = { name: "Antananarivo ville", nameEn: "Antananarivo city", nameMg: "  " };
  it("donne le nom dans la langue demandée, et le français quand il n'est pas traduit", () => {
    expect(zoneName(z, "fr")).toBe("Antananarivo ville");
    expect(zoneName(z, "en")).toBe("Antananarivo city");
    expect(zoneName(z, "mg")).toBe("Antananarivo ville");
  });
});

describe("weekFrom", () => {
  it("renvoie sept jours consécutifs à partir de la date", () => {
    const days = weekFrom(d(13));
    expect(days.map((x) => x.getDate())).toEqual([13, 14, 15, 16, 17, 18, 19]);
    expect(days.map((x) => x.getDay())).toEqual([5, 6, 0, 1, 2, 3, 4]);
  });
});
