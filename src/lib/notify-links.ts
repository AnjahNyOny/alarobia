import { defaultLocale, isLocale, type Locale } from "@/i18n/routing";
import { normalizePhone } from "./address";
import { formatPrice } from "./format";
import type { MailT } from "./mail/translate";
import { isMobileMoney, OPERATOR_NAME, paymentState } from "./payment";

/**
 * Prévenir le client par WhatsApp ou par SMS (PLAN.md 7.15). Le vendeur n'a pas de passerelle SMS : la page d'une
 * commande du back-office propose deux liens qui ouvrent WhatsApp ou l'application SMS de son téléphone, message déjà
 * écrit ; il n'a plus qu'à appuyer sur Envoyer. Rien ne part tout seul. Fonctions pures.
 *
 * Le message tient dans un SMS : 160 caractères au plus hors lien, et seulement des caractères de l'alphabet GSM 03.38
 * (un seul caractère hors de la table, une espace insécable par exemple, ferait tomber le SMS à 70 caractères). Les
 * textes sont dans l'espace `admin.notify.message` des fichiers de messages ; notify-links.test.ts vérifie chaque cas
 * dans les trois langues avec les valeurs les plus longues.
 */

export type NotifyOrder = {
  id: string;
  number: string;
  locale: string;
  status: string;
  paymentMethod: string;
  paymentReference: string | null;
  paidAt: Date | null;
  totalCents: number;
  trackingNumber: string | null;
};

export type NotifyContext = {
  /** Traducteur d'une langue, hors requête : `translateMail` (src/lib/mail/translate.ts). */
  translate: (locale: Locale) => MailT;
  /** Adresse publique du site, sans barre finale : `siteBase()`. */
  base: string;
  currency: string;
};

/** Numéro malgache enregistré (« 034 12 345 67 ») → « 261341234567 », ou null s'il n'est pas reconnu. */
export function internationalPhone(phone: string): string | null {
  const national = normalizePhone(phone);
  return national ? `261${national.replace(/\D/g, "").slice(1)}` : null;
}

/** Lien qui ouvre WhatsApp (application ou WhatsApp Web) sur la conversation du client, message prérempli. */
export function whatsappLink(phone: string, text: string): string | null {
  const number = internationalPhone(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

/** Lien qui ouvre l'application SMS, message prérempli. « ?&body= » : seule forme comprise à la fois par Android et iPhone. */
export function smsLink(phone: string, text: string): string | null {
  const number = internationalPhone(phone);
  return number ? `sms:+${number}?&body=${encodeURIComponent(text)}` : null;
}

/** Langue du message : celle de la commande (`Order.locale`), le français pour une valeur inconnue. */
export function notifyLocale(order: Pick<NotifyOrder, "locale">): Locale {
  return isLocale(order.locale) ? order.locale : defaultLocale;
}

/** Clé du message selon la commande ; null pour un statut inconnu. */
function messageKey(order: NotifyOrder) {
  switch (order.status) {
    case "PENDING": {
      const state = paymentState(order);
      return state === "awaiting" ? "awaiting" : state === "declared" ? "declared" : "cod";
    }
    case "PAID":
      return "paid";
    case "SHIPPED":
      return "shipped";
    case "DELIVERED":
      return "delivered";
    case "CANCELLED":
      return "cancelled";
    case "REFUNDED":
      return "refunded";
    default:
      return null;
  }
}

/**
 * Message au client, dans la langue de la commande, suivi du lien absolu vers sa commande sur sa propre ligne ; null
 * pour un statut inconnu. Les montants sont écrits avec des espaces ordinaires : Intl met des espaces insécables, hors
 * de l'alphabet GSM.
 */
export function customerMessage(order: NotifyOrder, ctx: NotifyContext): string | null {
  const key = messageKey(order);
  if (!key) return null;
  const locale = notifyLocale(order);
  const t = ctx.translate(locale);
  const tracking = order.trackingNumber?.trim() ?? "";
  const text = t(`admin.notify.message.${key}`, {
    number: order.number,
    amount: formatPrice(order.totalCents, ctx.currency, locale).replace(/\s/g, " "),
    operator: isMobileMoney(order.paymentMethod) ? OPERATOR_NAME[order.paymentMethod] : "",
    tracking,
    hasTracking: tracking ? "yes" : "no",
    // Expédiée et pas encore payée : à régler en espèces au livreur, comme le dit l'e-mail d'expédition.
    cod: !isMobileMoney(order.paymentMethod) && !order.paidAt ? "yes" : "no",
  });
  return `${text}\n${ctx.base}/${locale}/order/${order.id}`;
}
