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
  | { ok: true; code: string; discountCents: number; label: string }
  | { ok: false; error: string };

export async function evaluatePromo(rawCode: string, subtotalCents: number): Promise<PromoResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Saisissez un code." };
  const promo = await db.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.active) return { ok: false, error: "Ce code n'existe pas ou n'est plus actif." };
  if (promo.expiresAt && promo.expiresAt < new Date()) return { ok: false, error: "Ce code a expiré." };
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses)
    return { ok: false, error: "Ce code a atteint son nombre maximal d'utilisations." };
  if (subtotalCents < promo.minSubtotalCents)
    return {
      ok: false,
      error: `Ce code s'applique à partir de ${(promo.minSubtotalCents / 100).toLocaleString("fr-FR")} € d'achat.`,
    };
  const raw = promo.type === "PERCENT" ? Math.round((subtotalCents * promo.value) / 100) : promo.value;
  return {
    ok: true,
    code,
    discountCents: Math.min(raw, subtotalCents),
    label: promo.type === "PERCENT" ? `-${promo.value} %` : `-${(promo.value / 100).toLocaleString("fr-FR")} €`,
  };
}
