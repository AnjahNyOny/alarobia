import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ db: {} }));

import { shippingCost } from "../pricing";
import { discountPercent, ratingOf } from "../catalog";

const settings = { shippingStandardCents: 490, shippingExpressCents: 990, freeShippingThresholdCents: 8000 };

describe("shippingCost", () => {
  it("facture la livraison standard sous le seuil", () => {
    expect(shippingCost("STANDARD", 7999, settings)).toBe(490);
  });
  it("offre la livraison standard à partir du seuil", () => {
    expect(shippingCost("STANDARD", 8000, settings)).toBe(0);
  });
  it("facture toujours l'express", () => {
    expect(shippingCost("EXPRESS", 50000, settings)).toBe(990);
  });
  it("n'offre jamais la livraison quand le seuil vaut 0", () => {
    expect(shippingCost("STANDARD", 50000, { ...settings, freeShippingThresholdCents: 0 })).toBe(490);
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
