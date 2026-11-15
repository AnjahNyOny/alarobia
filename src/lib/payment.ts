import { normalizePhone } from "./address";

export const MOBILE_MONEY = ["MVOLA", "ORANGE_MONEY", "AIRTEL_MONEY"] as const;
export type MobileMoney = (typeof MOBILE_MONEY)[number];
/** Moyens de paiement, dans l'ordre où ils sont proposés. COD : paiement à la livraison. */
export const PAYMENT_METHODS = [...MOBILE_MONEY, "COD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Noms de marque : identiques dans les trois langues. */
export const OPERATOR_NAME: Record<MobileMoney, string> = { MVOLA: "MVola", ORANGE_MONEY: "Orange Money", AIRTEL_MONEY: "Airtel Money" };

export type MerchantNumbers = { mvolaNumber: string; orangeMoneyNumber: string; airtelMoneyNumber: string };

const NUMBER_FIELD: Record<MobileMoney, keyof MerchantNumbers> = { MVOLA: "mvolaNumber", ORANGE_MONEY: "orangeMoneyNumber", AIRTEL_MONEY: "airtelMoneyNumber" };

export function isMobileMoney(method: string): method is MobileMoney {
  return (MOBILE_MONEY as readonly string[]).includes(method);
}

/** Numéro du vendeur à créditer pour ce moyen de paiement ; vide s'il n'y en a pas. */
export function merchantNumber(method: string, numbers: MerchantNumbers) {
  return isMobileMoney(method) ? numbers[NUMBER_FIELD[method]].trim() : "";
}

/** Un opérateur n'est proposé que si le vendeur a renseigné son numéro ; le paiement à la livraison l'est toujours. */
export function availablePaymentMethods(numbers: MerchantNumbers): PaymentMethod[] {
  return PAYMENT_METHODS.filter((method) => method === "COD" || merchantNumber(method, numbers) !== "");
}

const PREFIX_OPERATOR: Record<string, MobileMoney> = { "034": "MVOLA", "038": "MVOLA", "032": "ORANGE_MONEY", "037": "ORANGE_MONEY", "033": "AIRTEL_MONEY" };

/** Opérateur Mobile Money d'un numéro malgache, d'après son préfixe ; null pour un fixe ou un numéro invalide. */
export function operatorOf(phone: string): MobileMoney | null {
  const normalized = normalizePhone(phone);
  return normalized ? (PREFIX_OPERATOR[normalized.slice(0, 3)] ?? null) : null;
}

/** Numéro marchand saisi dans les réglages : vide (opérateur non proposé) ou numéro du réseau de cet opérateur. */
export function checkMerchantNumber(method: MobileMoney, input: string): { ok: true; value: string } | { ok: false; reason: "invalid" | "wrongOperator" } {
  if (!input.trim()) return { ok: true, value: "" };
  const value = normalizePhone(input);
  if (!value) return { ok: false, reason: "invalid" };
  return operatorOf(value) === method ? { ok: true, value } : { ok: false, reason: "wrongOperator" };
}

/**
 * Référence de transaction saisie par le client, telle qu'elle figure dans le SMS de l'opérateur :
 * 4 à 40 lettres, chiffres, points ou tirets, sans espace. Renvoie null si elle n'y ressemble pas.
 */
export function normalizePaymentReference(input: string): string | null {
  const reference = String(input ?? "").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9._/-]{3,39}$/.test(reference) ? reference : null;
}

export type PaymentState = "awaiting" | "declared" | "received" | "onDelivery" | "void";

/**
 * Où en est le paiement d'une commande.
 * - awaiting : Mobile Money choisi, le client n'a pas encore indiqué de référence ;
 * - declared : référence indiquée, le vendeur doit vérifier qu'il a reçu l'argent (la commande reste « en attente ») ;
 * - received : paiement confirmé par le vendeur, ou colis payé à la livraison ;
 * - onDelivery : à régler au livreur ;
 * - void : commande annulée ou remboursée.
 */
export function paymentState(order: { paymentMethod: string; status: string; paymentReference: string | null }): PaymentState {
  if (order.status === "CANCELLED" || order.status === "REFUNDED") return "void";
  if (!isMobileMoney(order.paymentMethod)) return order.status === "DELIVERED" ? "received" : "onDelivery";
  if (order.status !== "PENDING") return "received";
  return order.paymentReference ? "declared" : "awaiting";
}
