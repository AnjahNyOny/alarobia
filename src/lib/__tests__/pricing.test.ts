import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ db: {} }));

import { MAX_ORDER_CENTS, orderWithinLimit, shippingCost } from "../pricing";
import { discountPercent, ratingOf } from "../catalog";

const zone = { priceCents: 500000 };
const threshold = 15000000;

describe("shippingCost", () => {
  it("facture le tarif de la zone sous le seuil de gratuité", () => {
    expect(shippingCost(zone, 14999900, threshold)).toBe(500000);
  });
  it("offre la livraison à partir du seuil, quelle que soit la zone", () => {
    expect(shippingCost(zone, 15000000, threshold)).toBe(0);
    expect(shippingCost({ priceCents: 1500000 }, 20000000, threshold)).toBe(0);
  });
  it("n'offre jamais la livraison quand le seuil vaut 0", () => {
    expect(shippingCost(zone, 50000000, 0)).toBe(500000);
  });
});

describe("orderWithinLimit", () => {
  it("accepte une commande à gros montant en ariary", () => {
    expect(orderWithinLimit(1_250_000 * 100)).toBe(true);
    expect(orderWithinLimit(MAX_ORDER_CENTS)).toBe(true);
  });
  it("refuse un total que la base ne peut pas stocker (entier 32 bits) : dix canapés à 2 850 000 Ar", () => {
    expect(orderWithinLimit(10 * 2_850_000 * 100)).toBe(false);
    expect(MAX_ORDER_CENTS).toBeLessThanOrEqual(2 ** 31 - 1);
  });
});

describe("discountPercent", () => {
  it("calcule la remise arrondie", () => {
    expect(discountPercent(24900, 29900)).toBe(17);
  });
  it("vaut 0 sans prix barré ou si le prix barré n'est pas supérieur", () => {
    expect(discountPercent(1000, null)).toBe(0);
    expect(discountPercent(1000, 1000)).toBe(0);
    expect(discountPercent(1000, 900)).toBe(0);
  });
});

describe("ratingOf", () => {
  it("fait la moyenne des notes", () => {
    expect(ratingOf([{ rating: 5 }, { rating: 4 }])).toEqual({ average: 4.5, count: 2 });
  });
  it("renvoie 0 sans avis", () => {
    expect(ratingOf([])).toEqual({ average: 0, count: 0 });
  });
});
