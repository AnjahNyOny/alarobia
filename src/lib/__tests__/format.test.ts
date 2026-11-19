import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calendarDayKey, centsToInput, currencyLabel, formatDateTime, formatMoment, madagascarDayKey, parseAmountToCents, slugify } from "../format";
import { madagascarInstant, madagascarTime } from "../shipping";

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
  it("n'ajoute pas de décimales à un montant rond : un prix en ariary se relit « 25000 »", () => {
    expect(centsToInput(2500000)).toBe("25000");
    expect(centsToInput(125000000)).toBe("1250000");
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

describe("currencyLabel", () => {
  it("écrit l'ariary « Ar », comme sur les prix, et laisse le code des autres devises", () => {
    expect(currencyLabel("MGA")).toBe("Ar");
    expect(currencyLabel("EUR")).toBe("EUR");
  });
});

/*
 * Point de vigilance 10 : une commande passée à 23 h 30 à Antananarivo (20 h 30 UTC) s'affiche à 23:30 et compte
 * pour ce jour-là, quel que soit le fuseau du serveur. La production (fonctions Netlify) tourne en UTC (fuseau de ces tests, vitest.config.mts),
 * la machine du propriétaire en EST ; Kiritimati (UTC+14) est déjà au lendemain de Madagascar.
 */
const LATE = new Date("2026-11-17T20:30:00Z"); // mardi 17 novembre, 23:30 à Antananarivo
const AFTER_MIDNIGHT = new Date("2026-11-17T21:30:00Z"); // mercredi 18 novembre, 00:30 à Antananarivo

describe.each(["UTC", "America/New_York", "Pacific/Kiritimati"])("heures de Madagascar, serveur en %s", (zone) => {
  let previous: string | undefined;
  beforeEach(() => {
    previous = process.env.TZ;
    process.env.TZ = zone; // Node relit le fuseau dès que TZ change.
  });
  afterEach(() => {
    process.env.TZ = previous;
  });

  it("affiche un instant à l'heure de Madagascar, dans les trois langues", () => {
    expect(formatDateTime(LATE, "fr")).toBe("17 nov. 2026, 23:30");
    expect(formatDateTime(LATE, "en")).toBe("Nov 17, 2026, 23:30");
    expect(formatDateTime(LATE, "mg")).toBe("17 Nov 2026, 23:30");
  });

  it("passe au lendemain à minuit à Madagascar, pas à minuit sur le serveur", () => {
    expect(formatDateTime(AFTER_MIDNIGHT, "fr")).toBe("18 nov. 2026, 00:30");
    expect(formatDateTime(AFTER_MIDNIGHT, "en")).toBe("Nov 18, 2026, 00:30");
    expect(formatDateTime(AFTER_MIDNIGHT, "mg")).toBe("18 Nov 2026, 00:30");
  });

  it("donne la date seule d'un instant, à Madagascar", () => {
    expect(formatMoment(LATE, "fr")).toBe("17 novembre 2026");
    expect(formatMoment(AFTER_MIDNIGHT, "fr")).toBe("18 novembre 2026");
    expect(formatMoment(AFTER_MIDNIGHT, "en", "medium")).toBe("Nov 18, 2026");
    expect(formatMoment(AFTER_MIDNIGHT, "mg", "weekday")).toBe("Alarobia 18 Novambra");
  });

  it("range les deux commandes dans deux jours différents du tableau de bord", () => {
    expect(madagascarDayKey(LATE)).toBe("2026-11-17");
    expect(madagascarDayKey(AFTER_MIDNIGHT)).toBe("2026-11-18");
  });

  it("donne la même clé à un jour du calendrier malgache qu'aux instants de ce jour", () => {
    const day = madagascarTime(AFTER_MIDNIGHT);
    expect(calendarDayKey(new Date(day.getFullYear(), day.getMonth(), day.getDate()))).toBe("2026-11-18");
    expect(calendarDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("retrouve l'instant d'une heure de Madagascar", () => {
    expect(madagascarInstant(madagascarTime(LATE))).toEqual(LATE);
    expect(madagascarInstant(madagascarTime(AFTER_MIDNIGHT))).toEqual(AFTER_MIDNIGHT);
    // Minuit à Antananarivo le 18 : le début de ce jour pour les requêtes du tableau de bord.
    expect(madagascarInstant(new Date(2026, 10, 18)).toISOString()).toBe("2026-11-17T21:00:00.000Z");
  });

  it("retrouve l'instant à la seconde près", () => {
    const x = new Date("2026-11-17T20:30:45.678Z");
    expect(madagascarInstant(madagascarTime(x)).getTime()).toBe(x.getTime() - 678);
  });
});
