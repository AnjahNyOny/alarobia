import type { Tx } from "./db";

/**
 * Consomme une utilisation du code promo, dans la transaction de la commande. Le panier a validé le code
 * hors transaction (`evaluatePromo`) : entre-temps, d'autres commandes ont pu l'épuiser, ou le vendeur
 * l'a coupé. Toutes les conditions sont donc reprises dans l'écriture elle-même, comme pour le stock.
 * `false` : le code n'est plus valable, la commande doit être annulée.
 */
export async function consumePromo(tx: Tx, code: string, now = new Date()): Promise<boolean> {
  const { count } = await tx.promoCode.updateMany({
    where: {
      code,
      active: true,
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, { OR: [{ maxUses: null }, { usedCount: { lt: tx.promoCode.fields.maxUses } }] }],
    },
    data: { usedCount: { increment: 1 } },
  });
  return count === 1;
}
