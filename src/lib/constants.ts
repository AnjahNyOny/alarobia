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

export const SHIPPING_LABEL: Record<string, string> = {
  STANDARD: "Standard (3 à 5 jours ouvrés)",
  EXPRESS: "Express (24 à 48 h)",
};

export const COUNTRIES = ["France", "Belgique", "Suisse", "Luxembourg", "Canada", "Madagascar"];

export const LOW_STOCK_THRESHOLD = 5;
