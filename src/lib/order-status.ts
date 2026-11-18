import type { OrderStatus } from "./constants";
import type { Tx } from "./db";
import { isMobileMoney } from "./payment";
import { releaseStock } from "./stock";

const VOID: string[] = ["CANCELLED", "REFUNDED"];

type OrderSnapshot = {
  id: string;
  status: string;
  paymentMethod: string;
  paidAt: Date | null;
  items: { productId: string | null; quantity: number }[];
};

/**
 * Change le statut d'une commande, dans sa transaction. `order` est l'instantané lu avant : l'écriture est
 * conditionnée à ce statut, donc deux envois simultanés (double clic, deux onglets) ne passent pas tous les deux.
 * `false` : le statut a changé entre-temps, rien n'est modifié et l'appelant demande de recharger la page.
 */
export async function transitionOrder(
  tx: Tx,
  order: OrderSnapshot,
  next: { status: OrderStatus; trackingNumber: string | null },
): Promise<boolean> {
  // Date d'encaissement : au passage à « payée », ou à la remise du colis pour un paiement à la livraison.
  const collected = next.status === "PAID" || (next.status === "DELIVERED" && !isMobileMoney(order.paymentMethod));
  const { count } = await tx.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: next.status, trackingNumber: next.trackingNumber, ...(collected && !order.paidAt && { paidAt: new Date() }) },
  });
  if (count === 0) return false;
  // Annulation ou remboursement : les articles retournent en stock, une seule fois.
  if (!VOID.includes(order.status) && VOID.includes(next.status)) {
    const lines = order.items.flatMap((i) => (i.productId ? [{ productId: i.productId, quantity: i.quantity }] : []));
    await releaseStock(tx, lines);
  }
  return true;
}
