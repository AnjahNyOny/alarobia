import type { OrderStatus } from "./constants";
import type { Db, Tx } from "./db";
import { isMobileMoney } from "./payment";
import { releaseStock } from "./stock";

const VOID: string[] = ["CANCELLED", "REFUNDED"];

/** Commande annulée ou remboursée : son stock est déjà remis en vente, elle ne peut plus que passer de l'un à l'autre. */
export function isClosed(status: string) {
  return VOID.includes(status);
}

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

/** Issue d'un changement de statut ; l'action serveur en fait un message. */
export type StatusChange = "ok" | "notFound" | "closed" | "delivered" | "changed";

/**
 * Relit la commande et change son statut (liste « Statut » du back-office). Une commande close ne peut que passer
 * d'annulée à remboursée ou l'inverse ; avec `openOnly` (bouton « Annuler la commande »), elle est refusée dans tous les
 * les cas, et une commande livrée aussi : le colis ne revient pas forcément, son stock ne doit pas être remis en vente.
 * `trackingNumber` absent : le numéro de suivi enregistré est gardé.
 * `onStatusChanged` est appelé avec l'ancien statut, une fois la transaction validée, seulement si le statut a
 * réellement changé : l'action serveur y branche l'e-mail au client (un numéro de suivi ajouté seul n'en envoie pas).
 */
export async function changeOrderStatus(
  db: Db,
  id: string,
  next: { status: OrderStatus; trackingNumber?: string | null },
  { openOnly = false, onStatusChanged }: StatusOptions = {},
): Promise<StatusChange> {
  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return "notFound";
  if (isClosed(order.status) && (openOnly || !isClosed(next.status))) return "closed";
  if (openOnly && order.status === "DELIVERED") return "delivered";
  const trackingNumber = next.trackingNumber === undefined ? order.trackingNumber : next.trackingNumber;
  const changed = await db.$transaction((tx) => transitionOrder(tx, order, { status: next.status, trackingNumber }));
  if (!changed) return "changed";
  if (order.status !== next.status) onStatusChanged?.(order.status);
  return "ok";
}

type StatusOptions = { openOnly?: boolean; onStatusChanged?: (from: string) => void };

/** Le bouton « Annuler la commande » s'affiche : commande ni close ni livrée (décision du propriétaire, 25/11/2026). */
export function canCancel(status: string) {
  return !isClosed(status) && status !== "DELIVERED";
}

/** Bouton « Annuler la commande » : commande ni close ni livrée. La liste « Statut » reste le recours pour un cas à part. */
export function cancelOrder(db: Db, id: string, { onStatusChanged }: Pick<StatusOptions, "onStatusChanged"> = {}) {
  return changeOrderStatus(db, id, { status: "CANCELLED" }, { openOnly: true, onStatusChanged });
}
