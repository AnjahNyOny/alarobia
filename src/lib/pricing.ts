import { db } from "./db";

type ShippingSettings = {
  shippingStandardCents: number;
  shippingExpressCents: number;
  freeShippingThresholdCents: number;
};

export function shippingCost(method: string, subtotalAfterDiscount: number, s: ShippingSettings) {
  if (method === "EXPRESS") return s.shippingExpressCents;
  return s.freeShippingThresholdCents > 0 && subtotalAfterDiscount >= s.freeShippingThresholdCents ? 0 : s.shippingStandardCents;
}

export type PromoResult =
  | { ok: true; code: string; discountCents: number; type: "PERCENT" | "FIXED"; value: number }
  | { ok: false; reason: "empty" | "unknown" | "expired" | "exhausted" }
  | { ok: false; reason: "minimum"; minSubtotalCents: number };

/** Renvoie un motif de refus, pas un message : la traduction se fait là où la langue est connue. */
export async function evaluatePromo(rawCode: string, subtotalCents: number): Promise<PromoResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: "empty" };
  const promo = await db.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.active) return { ok: false, reason: "unknown" };
  if (promo.expiresAt && promo.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) return { ok: false, reason: "exhausted" };
  if (subtotalCents < promo.minSubtotalCents) return { ok: false, reason: "minimum", minSubtotalCents: promo.minSubtotalCents };
  const raw = promo.type === "PERCENT" ? Math.round((subtotalCents * promo.value) / 100) : promo.value;
  return { ok: true, code, discountCents: Math.min(raw, subtotalCents), type: promo.type === "PERCENT" ? "PERCENT" : "FIXED", value: promo.value };
}

export function promoLabel(promo: { type: "PERCENT" | "FIXED"; value: number }, format: (cents: number) => string) {
  return promo.type === "PERCENT" ? `−${promo.value} %` : `−${format(promo.value)}`;
}
