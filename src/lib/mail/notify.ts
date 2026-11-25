import "server-only";
import type { Db } from "../db";
import { releaseConfirmation, type PendingConfirmation } from "../newsletter";
import { siteBase } from "../seo";
import { confirmationMail } from "./newsletter-mails";
import { newOrderVendorMail, orderReceivedMail, paymentDeclaredVendorMail, statusMail, statusToNotify, vendorAddress, type MailContext, type MailOrder, type MailSettings } from "./order-mails";
import { maskAddress, sendMail, type MailMessage } from "./transport";
import { translateMail } from "./translate";

/**
 * Envoi des e-mails de commande (PLAN.md 7.12), appelé par les actions serveur dans `after()` (next/server) : la
 * réponse est déjà partie, le client n'attend pas Gmail.
 *
 * Chaque fonction relit la commande et les réglages au moment d'envoyer, plutôt que de recevoir ce que l'action avait
 * chargé : la fermeture passée à `after()` ne garde qu'un identifiant, le message décrit la commande telle qu'elle est
 * enregistrée (transaction validée, numéro de suivi compris), et les numéros Mobile Money sont ceux des réglages du
 * moment, comme sur la page de la commande. Une lecture de plus, après la réponse.
 *
 * Point de vigilance 2 : rien ne lève. `sendMail` ne lève déjà pas ; une base indisponible ou une exception imprévue
 * sont journalisées ici, sans adresse en clair, et la fonction rend la main normalement.
 */

async function load(db: Db, orderId: string): Promise<{ order: MailOrder; settings: MailSettings } | null> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: { select: { name: true, quantity: true, priceCents: true } } } });
  if (!order) return null;
  // Même lecture que getSettings() (src/lib/settings.ts), sur le client reçu : la ligne est créée si elle manque.
  const settings = await db.storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return { order, settings };
}

function context(): MailContext {
  return { translate: translateMail, base: siteBase(), vendor: vendorAddress(process.env.SMTP_USER) };
}

/** Adresses éventuellement citées par une erreur (Gmail cite le destinataire qu'il refuse), masquées. */
const masked = (error: unknown) => (error instanceof Error ? error.message : String(error)).replace(/[^\s<>()"',;:]+@[^\s<>()"',;:]+/g, maskAddress);

/**
 * Lit la commande, construit les messages et les envoie en même temps : deux messages pour un événement (client et
 * vendeur) ne s'attendent pas l'un l'autre, chacun pouvant prendre jusqu'à 10 s (transport.ts).
 */
async function deliver(db: Db, orderId: string, what: string, build: (order: MailOrder, settings: MailSettings, ctx: MailContext) => (MailMessage | null)[]) {
  let label = orderId;
  try {
    const loaded = await load(db, orderId);
    if (!loaded) {
      console.error(`[mail] ${what} : commande ${orderId} introuvable, aucun e-mail envoyé.`);
      return;
    }
    label = loaded.order.number;
    const messages = build(loaded.order, loaded.settings, context()).filter((m): m is MailMessage => m !== null);
    const results = await Promise.allSettled(messages.map((m) => sendMail(m)));
    for (const result of results) {
      if (result.status === "rejected") console.error(`[mail] ${what} de la commande ${label} : ${masked(result.reason)}`);
    }
  } catch (error) {
    console.error(`[mail] ${what} de la commande ${label} : ${masked(error)}`);
  }
}

/** Commande passée : récapitulatif au client, avis au vendeur. */
export function notifyOrderPlaced(db: Db, orderId: string): Promise<void> {
  return deliver(db, orderId, "commande passée", (order, settings, ctx) => [orderReceivedMail(order, settings, ctx), newOrderVendorMail(order, settings, ctx)]);
}

/** Le client a indiqué la référence de son paiement Mobile Money : avis au vendeur, qui doit vérifier. */
export function notifyPaymentDeclared(db: Db, orderId: string): Promise<void> {
  return deliver(db, orderId, "paiement déclaré", (order, settings, ctx) => [paymentDeclaredVendorMail(order, settings, ctx)]);
}

/** Statut changé par le vendeur : message au client, seulement si le statut a réellement changé et mérite d'être annoncé. */
export async function notifyStatusChange(db: Db, orderId: string, change: { from: string; to: string }): Promise<void> {
  if (!statusToNotify(change.from, change.to)) return;
  return deliver(db, orderId, `statut ${change.to}`, (order, settings, ctx) => [statusMail(order, change, settings, ctx)]);
}

/**
 * Lettre d'information (PLAN.md 7.13) : envoie la demande de confirmation que `requestSubscription` vient de réserver.
 * Si l'envoi échoue, la place est rendue : une nouvelle inscription pourra le renvoyer sans attendre 24 h. Rien ne lève,
 * et l'adresse n'apparaît pas en clair dans le journal.
 */
export async function notifyNewsletterConfirmation(db: Db, pending: PendingConfirmation): Promise<void> {
  try {
    const sent = await sendMail(confirmationMail(pending, { translate: translateMail, base: siteBase() }));
    if (!sent) await releaseConfirmation(db, pending);
  } catch (error) {
    console.error(`[mail] confirmation de la lettre à ${maskAddress(pending.email)} : ${masked(error)}`);
    await releaseConfirmation(db, pending).catch(() => {});
  }
}
