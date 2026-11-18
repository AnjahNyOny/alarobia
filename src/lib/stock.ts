import type { Tx } from "./db";

export type StockLine = { productId: string; quantity: number };

/** Ordre fixe des verrous : le même pour la réservation et la remise en stock. */
const byProductId = (lines: StockLine[]) =>
  [...lines].sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0));

/**
 * Réserve le stock d'une commande, dans sa transaction. Chaque ligne est un décrément conditionnel
 * (produit en vente, `stock >= quantité`) : deux commandes simultanées ne peuvent pas vendre le même dernier
 * exemplaire. Sous PostgreSQL, la seconde attend le verrou de la ligne, puis relit le stock avant de décider.
 *
 * Renvoie l'identifiant du premier produit qui manque, ou `null` quand tout est réservé. Dans le premier cas,
 * l'appelant annule la transaction (en levant une erreur) : les lignes déjà réservées sont alors rendues.
 *
 * Les lignes passent dans l'ordre des identifiants, pas dans celui du panier : deux commandes qui contiennent
 * les mêmes produits prennent leurs verrous dans le même ordre et ne peuvent pas s'interbloquer.
 */
export async function reserveStock(tx: Tx, lines: StockLine[]): Promise<string | null> {
  for (const { productId, quantity } of byProductId(lines)) {
    const { count } = await tx.product.updateMany({
      where: { id: productId, status: "ACTIVE", stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (count === 0) return productId;
  }
  return null;
}

/** Remet en stock les articles d'une commande annulée ou remboursée, dans l'ordre des identifiants (voir `reserveStock`). */
export async function releaseStock(tx: Tx, lines: StockLine[]): Promise<void> {
  for (const { productId, quantity } of byProductId(lines)) {
    await tx.product.update({ where: { id: productId }, data: { stock: { increment: quantity } } });
  }
}
