import { defaultLocale, isLocale, type Locale } from "@/i18n/routing";
import { addressLines, type AddressParts } from "../address";
import { calendarDayKey, formatDate, formatPrice } from "../format";
import { isMobileMoney, merchantNumber, OPERATOR_NAME, paymentState, type MerchantNumbers } from "../payment";
import { madagascarTime } from "../shipping";
import { renderMail, type MailContent } from "./layout";
import type { MailMessage } from "./transport";
import type { MailT } from "./translate";

/**
 * E-mails de commande (PLAN.md 7.12) : commande + réglages → message prêt à envoyer. Fonctions pures, sans base ni
 * requête : l'envoi (src/lib/mail/notify.ts) relit la commande et les réglages, puis appelle ces fonctions.
 *
 * Client : dans la langue de la commande (`Order.locale`), liens vers `/{langue}/order/{id}`, réponse à l'adresse de
 * contact des réglages. Vendeur : en français, à l'adresse du compte d'envoi, liens vers `/fr/admin/orders/{id}`.
 * Les textes sont dans l'espace `mail` des fichiers de messages ; ce qui vient du client ou du vendeur (nom, adresse,
 * note, numéro de suivi, référence) n'est qu'une valeur insérée, échappée par le gabarit dans la version HTML.
 */

export type MailOrder = AddressParts & {
  phone: string;
  id: string;
  number: string;
  email: string;
  locale: string;
  status: string;
  paymentMethod: string;
  paymentReference: string | null;
  paidAt: Date | null;
  shippingZone: string;
  /** Date du calendrier malgache (voir src/lib/format.ts). */
  estimatedDelivery: Date | null;
  discountCents: number;
  promoCode: string | null;
  shippingCents: number;
  totalCents: number;
  trackingNumber: string | null;
  note: string | null;
  items: { name: string; quantity: number; priceCents: number }[];
};

export type MailSettings = MerchantNumbers & { currency: string; mobileMoneyName: string; contactEmail: string };

export type MailContext = {
  /** Traducteur d'une langue : `translateMail` (translate.ts), le même moteur que le site. */
  translate: (locale: Locale) => MailT;
  /** Adresse publique du site, sans barre finale : `siteBase()`. */
  base: string;
  /** Adresse du vendeur : `vendorAddress()`. */
  vendor: string;
  /** Instant de l'envoi (date promise déjà passée ou non) ; maintenant par défaut. */
  now?: Date;
};

/** Destinataire des avis au vendeur sans SMTP (local, tests) : les tests navigateur le reconnaissent dans l'outbox. */
export const DEMO_VENDOR = "vendeur@alarobia.example";
/** Adresse de contact par défaut des réglages (schema.prisma) : elle n'existe pas, on n'y fait pas répondre. */
const EXAMPLE_CONTACT = "bonjour@alarobia.example";

/** Les avis au vendeur vont au compte d'envoi (`SMTP_USER`), la boîte de la boutique. */
export function vendorAddress(smtpUser: string | undefined): string {
  return smtpUser?.trim() || DEMO_VENDOR;
}

/** `Reply-To` des e-mails au client : l'adresse de contact des réglages, sauf tant qu'elle vaut l'adresse d'exemple. */
export function customerReplyTo(contactEmail: string): string | undefined {
  const address = contactEmail.trim();
  return address && address !== EXAMPLE_CONTACT ? address : undefined;
}

/** Statuts annoncés au client par e-mail. « En attente » ne l'est jamais : c'est l'état d'une commande qui vient d'arriver. */
export const NOTIFIED_STATUSES = ["PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;
export type NotifiedStatus = (typeof NOTIFIED_STATUSES)[number];

/** Statut à annoncer au client après un changement, ou null : statut inchangé (numéro de suivi seul), « en attente », inconnu. */
export function statusToNotify(from: string, to: string): NotifiedStatus | null {
  if (from === to) return null;
  return (NOTIFIED_STATUSES as readonly string[]).includes(to) ? (to as NotifiedStatus) : null;
}

const orderLocale = (order: MailOrder): Locale => (isLocale(order.locale) ? order.locale : defaultLocale);

/** Ce qui sert à tous les messages d'une langue : traducteur, montants, lien vers la commande. */
function tools(locale: Locale, settings: MailSettings, ctx: MailContext) {
  const t = ctx.translate(locale);
  const price = (cents: number) => formatPrice(cents, settings.currency, locale);
  return { t, price };
}

function message(to: string, subject: string, locale: Locale, content: MailContent, replyTo?: string): MailMessage {
  return { to, subject, ...renderMail(locale, content), ...(replyTo && { replyTo }) };
}

/** Articles, une ligne chacun : « 2 × Tasse en grès Vato : 24 000 Ar ». */
function itemLines(order: MailOrder, t: MailT, price: (cents: number) => string) {
  return order.items.map((item) => t("mail.item", { quantity: item.quantity, name: item.name, amount: price(item.priceCents * item.quantity) })).join("\n");
}

/** Date promise, si elle n'est pas déjà passée à Madagascar. */
function expectedLine(order: MailOrder, locale: Locale, t: MailT, now: Date) {
  const date = order.estimatedDelivery;
  if (!date || calendarDayKey(date) < calendarDayKey(madagascarTime(now))) return null;
  return t("mail.expected", { date: formatDate(date, locale, "weekday") });
}

const customerLink = (order: MailOrder, locale: Locale, ctx: MailContext) => `${ctx.base}/${locale}/order/${order.id}`;
const vendorLink = (order: MailOrder, ctx: MailContext) => `${ctx.base}/fr/admin/orders/${order.id}`;
const lines = (...parts: (string | null | false | undefined)[]) => parts.filter((part): part is string => !!part).join("\n");

/** Commande enregistrée (client) : le détail, puis comment payer. */
export function orderReceivedMail(order: MailOrder, settings: MailSettings, ctx: MailContext): MailMessage {
  const locale = orderLocale(order);
  const { t, price } = tools(locale, settings, ctx);
  const total = price(order.totalCents);

  const totals = lines(
    order.discountCents > 0 && (order.promoCode ? t("mail.discount", { code: order.promoCode, amount: price(order.discountCents) }) : t("mail.discountNoCode", { amount: price(order.discountCents) })),
    order.shippingCents > 0 ? t("mail.shipping", { amount: price(order.shippingCents) }) : t("mail.shippingFree"),
    t("mail.total", { amount: total }),
  );

  const payment: string[] = [];
  let button = { label: t("mail.viewOrder"), url: customerLink(order, locale, ctx) };
  if (isMobileMoney(order.paymentMethod)) {
    const operator = OPERATOR_NAME[order.paymentMethod];
    const phone = merchantNumber(order.paymentMethod, settings);
    if (phone) {
      payment.push(
        lines(t("mail.received.mobile", { operator, amount: total, phone }), settings.mobileMoneyName.trim() && t("mail.received.holder", { name: settings.mobileMoneyName.trim() })),
        t("mail.received.motive", { number: order.number }),
        t("mail.received.reference"),
      );
      button = { ...button, label: t("mail.received.referenceButton") };
    } else {
      // L'opérateur a été retiré des réglages entre la commande et l'envoi : la page de la commande dit quoi faire.
      payment.push(t("mail.received.mobileNoNumber", { operator }));
    }
  } else {
    payment.push(t("mail.received.cod", { amount: total }));
  }

  return message(
    order.email,
    t("mail.received.subject", { number: order.number }),
    locale,
    {
      title: t("mail.received.title"),
      paragraphs: [
        t("mail.greeting", { name: order.fullName }),
        t("mail.received.intro", { number: order.number }),
        itemLines(order, t, price),
        totals,
        lines(t("mail.zone", { zone: order.shippingZone }), expectedLine(order, locale, t, ctx.now ?? new Date())),
        lines(t("mail.addressTitle"), ...addressLines(order)),
        ...payment,
        t("mail.received.notify"),
      ],
      button,
      footer: t("mail.footer"),
    },
    customerReplyTo(settings.contactEmail),
  );
}

/** Nouvelle commande (vendeur, en français) : de quoi la reconnaître et la préparer, et le lien vers le back-office. */
export function newOrderVendorMail(order: MailOrder, settings: MailSettings, ctx: MailContext): MailMessage {
  const { t, price } = tools("fr", settings, ctx);
  const total = price(order.totalCents);
  const payment = isMobileMoney(order.paymentMethod) ? t("mail.vendor.newOrder.payMobile", { operator: OPERATOR_NAME[order.paymentMethod] }) : t("mail.vendor.newOrder.payCod", { amount: total });
  return message(ctx.vendor, t("mail.vendor.newOrder.subject", { number: order.number, amount: total }), "fr", {
    title: t("mail.vendor.newOrder.title", { number: order.number }),
    paragraphs: [
      lines(t("mail.total", { amount: total }), payment),
      itemLines(order, t, price),
      lines(t("mail.vendor.customer", { name: order.fullName, phone: order.phone }), t("mail.vendor.zone", { zone: order.shippingZone })),
      ...(order.note?.trim() ? [t("mail.vendor.note", { note: order.note.trim() })] : []),
    ],
    button: { label: t("mail.vendor.open"), url: vendorLink(order, ctx) },
    footer: t("mail.vendor.footer"),
  }, order.email); // Reply-To : répondre à l'avis écrit directement au client.
}

/** Le client a indiqué la référence de son paiement Mobile Money (vendeur, en français) : à vérifier avant de préparer. */
export function paymentDeclaredVendorMail(order: MailOrder, settings: MailSettings, ctx: MailContext): MailMessage {
  const { t, price } = tools("fr", settings, ctx);
  const operator = isMobileMoney(order.paymentMethod) ? OPERATOR_NAME[order.paymentMethod] : order.paymentMethod;
  const phone = merchantNumber(order.paymentMethod, settings);
  return message(ctx.vendor, t("mail.vendor.declared.subject", { number: order.number }), "fr", {
    title: t("mail.vendor.declared.title", { number: order.number }),
    paragraphs: [
      t("mail.vendor.declared.body", { amount: price(order.totalCents), operator }),
      lines(t("mail.vendor.declared.reference", { reference: order.paymentReference ?? "" }), phone && t("mail.vendor.declared.number", { phone })),
      t("mail.vendor.declared.check"),
    ],
    button: { label: t("mail.vendor.open"), url: vendorLink(order, ctx) },
    footer: t("mail.vendor.footer"),
  }, order.email); // Reply-To : répondre à l'avis écrit directement au client.
}

/**
 * Changement de statut (client), ou null s'il n'y a rien à annoncer (`statusToNotify`). `change.from` est le statut
 * d'avant : une annulation ne promet un remboursement que si le paiement Mobile Money avait été confirmé, même règle
 * que la boîte de confirmation du back-office (`paymentState` de la commande telle qu'elle était).
 */
export function statusMail(order: MailOrder, change: { from: string; to: string }, settings: MailSettings, ctx: MailContext): MailMessage | null {
  const status = statusToNotify(change.from, change.to);
  if (!status) return null;
  const locale = orderLocale(order);
  const { t, price } = tools(locale, settings, ctx);
  const key = (name: string) => `mail.status.${status}.${name}`;
  const values = { number: order.number, amount: price(order.totalCents) };

  const extra: (string | null)[] = [];
  if (status === "SHIPPED") {
    const tracking = order.trackingNumber?.trim();
    extra.push(
      tracking ? t(key("tracking"), { tracking }) : null,
      expectedLine(order, locale, t, ctx.now ?? new Date()),
      !isMobileMoney(order.paymentMethod) && !order.paidAt ? t(key("cod"), values) : null,
    );
  } else if (status === "DELIVERED") {
    extra.push(t(key("returns")));
  } else if (status === "CANCELLED") {
    const method = order.paymentMethod;
    const wasPaid = isMobileMoney(method) && paymentState({ ...order, status: change.from }) === "received";
    extra.push(wasPaid ? t(key("refund"), { ...values, operator: OPERATOR_NAME[method] }) : null);
  }

  return message(
    order.email,
    t(key("subject"), values),
    locale,
    {
      title: t(key("title")),
      paragraphs: [t("mail.greeting", { name: order.fullName }), t(key("body"), values), ...extra.filter((p): p is string => !!p)],
      button: { label: t("mail.viewOrder"), url: customerLink(order, locale, ctx) },
      footer: t("mail.footer"),
    },
    customerReplyTo(settings.contactEmail),
  );
}
