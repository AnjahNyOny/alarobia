export const ORDER_STATUSES = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

/** Statuts comptés dans le chiffre d'affaires. */
export const REVENUE_STATUSES = ["PAID", "SHIPPED", "DELIVERED"];

export const PRODUCT_STATUSES = ["ACTIVE", "DRAFT", "ARCHIVED"] as const;
export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "En ligne",
  DRAFT: "Brouillon",
  ARCHIVED: "Archivé",
};

export const PAYMENT_LABEL: Record<string, string> = {
  CARD: "Carte bancaire",
  COD: "Paiement à la livraison",
};

/**
 * Plafond d'un montant (prix d'un produit, tarif de livraison, total d'une commande) : 20 000 000 Ar.
 * Les colonnes de montant sont des entiers 32 bits ; au-delà de 21 474 836 Ar, la base refuse l'écriture.
 */
export const MAX_ORDER_CENTS = 2_000_000_000;

export const LOW_STOCK_THRESHOLD = 5;
