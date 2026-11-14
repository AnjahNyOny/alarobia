import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
vi.mock("../db", () => ({ db: { promoCode: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

import { evaluatePromo } from "../pricing";

const promo = { code: "BIENVENUE10", type: "PERCENT", value: 10, active: true, expiresAt: null, maxUses: null, usedCount: 0, minSubtotalCents: 0 };

beforeEach(() => findUnique.mockReset());

describe("evaluatePromo", () => {
  it("normalise la saisie et calcule un pourcentage", async () => {
    findUnique.mockResolvedValue(promo);
    const result = await evaluatePromo("  bienvenue10 ", 49800);
    expect(findUnique).toHaveBeenCalledWith({ where: { code: "BIENVENUE10" } });
    expect(result).toEqual({ ok: true, code: "BIENVENUE10", discountCents: 4980, type: "PERCENT", value: 10 });
  });
  it("plafonne une remise fixe au sous-total", async () => {
    findUnique.mockResolvedValue({ ...promo, type: "FIXED", value: 2000 });
    expect(await evaluatePromo("X", 1500)).toMatchObject({ ok: true, discountCents: 1500 });
  });
  it("renvoie un motif de refus exploitable dans toutes les langues", async () => {
    expect(await evaluatePromo("   ", 1000)).toEqual({ ok: false, reason: "empty" });
    findUnique.mockResolvedValue(null);
    expect(await evaluatePromo("X", 1000)).toEqual({ ok: false, reason: "unknown" });
    findUnique.mockResolvedValue({ ...promo, active: false });
    expect(await evaluatePromo("X", 1000)).toEqual({ ok: false, reason: "unknown" });
    findUnique.mockResolvedValue({ ...promo, expiresAt: new Date("2020-01-01") });
    expect(await evaluatePromo("X", 1000)).toEqual({ ok: false, reason: "expired" });
    findUnique.mockResolvedValue({ ...promo, maxUses: 5, usedCount: 5 });
    expect(await evaluatePromo("X", 1000)).toEqual({ ok: false, reason: "exhausted" });
    findUnique.mockResolvedValue({ ...promo, minSubtotalCents: 15000 });
    expect(await evaluatePromo("X", 14999)).toEqual({ ok: false, reason: "minimum", minSubtotalCents: 15000 });
  });
});
