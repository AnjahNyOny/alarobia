import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { Locale } from "@/i18n/routing";
import type { Db } from "./db";

/**
 * Lettre d'information : double confirmation et désinscription par jeton (PLAN.md 7.13).
 *
 * Chaque inscrit a un jeton secret (32 octets aléatoires), le même pour toute sa vie d'inscrit : il sert au lien de
 * confirmation et, plus tard, au lien de désinscription de chaque lettre. Une désinscription supprime la ligne ; une
 * réinscription crée un nouveau jeton, et les anciens liens ne valent plus rien.
 *
 * Point de vigilance 4 : n'importe qui peut taper n'importe quelle adresse dans le pied de page. Une adresse reçoit au
 * plus un e-mail de confirmation par 24 h, et aucune lettre tant qu'elle n'a pas été confirmée. La place est réservée
 * dans la base avant l'envoi, par une mise à jour conditionnelle : deux inscriptions simultanées ne peuvent pas la
 * prendre toutes les deux (PostgreSQL réévalue la condition sur la ligne déjà modifiée par l'autre).
 *
 * Point de vigilance 5 : `subscriptionState` ne fait que lire (page ouverte par un antivirus de messagerie) ;
 * seules `confirmSubscription` et `unsubscribe`, appelées par le bouton de la page, modifient quelque chose.
 */

/** Une confirmation au plus par adresse sur cette durée. */
export const CONFIRMATION_INTERVAL_MS = 24 * 60 * 60_000;

/** Confirmation à envoyer : l'adresse, son jeton, la langue de l'inscription, et l'instant réservé (voir `releaseConfirmation`). */
export type PendingConfirmation = { email: string; token: string; locale: Locale; sentAt: Date };

export function newsletterToken(): string {
  return randomBytes(32).toString("hex");
}

/** Forme d'un jeton : vérifiée avant toute requête, un lien tronqué ou bricolé ne va pas jusqu'à la base. */
export function isNewsletterToken(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

/** La ligne de l'adresse, créée si elle n'existe pas. Deux créations simultanées : l'une perd sur l'index unique et relit l'autre. */
async function findOrCreate(db: Db, email: string, locale: Locale) {
  try {
    return await db.newsletterSubscriber.upsert({ where: { email }, update: {}, create: { email, token: newsletterToken(), locale } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return db.newsletterSubscriber.findUniqueOrThrow({ where: { email } });
    throw error;
  }
}

/**
 * Inscription depuis le pied de page. Rend la confirmation à envoyer, ou `null` quand il n'y a rien à envoyer : adresse
 * déjà confirmée, ou confirmation déjà partie depuis moins de 24 h. L'appelant répond la même chose dans tous les cas.
 * La langue est enregistrée à la création, puis remplacée chaque fois qu'une nouvelle confirmation part.
 */
export async function requestSubscription(db: Db, email: string, locale: Locale, now = new Date()): Promise<PendingConfirmation | null> {
  const subscriber = await findOrCreate(db, email, locale);
  if (subscriber.confirmedAt) return null;
  const { count } = await db.newsletterSubscriber.updateMany({
    where: { id: subscriber.id, confirmedAt: null, OR: [{ confirmSentAt: null }, { confirmSentAt: { lte: new Date(now.getTime() - CONFIRMATION_INTERVAL_MS) } }] },
    data: { confirmSentAt: now, locale },
  });
  return count === 1 ? { email: subscriber.email, token: subscriber.token, locale, sentAt: now } : null;
}

/**
 * L'e-mail de confirmation n'est pas parti (Gmail a refusé, quota atteint) : la place réservée est rendue, une nouvelle
 * inscription pourra le renvoyer sans attendre 24 h. Seulement si aucune autre confirmation n'est partie depuis.
 */
export async function releaseConfirmation(db: Db, pending: PendingConfirmation): Promise<void> {
  await db.newsletterSubscriber.updateMany({ where: { token: pending.token, confirmSentAt: pending.sentAt }, data: { confirmSentAt: null } });
}

/** État d'un jeton, en lecture seule : la page d'un lien l'affiche sans rien modifier. */
export async function subscriptionState(db: Db, token: string): Promise<"pending" | "confirmed" | "unknown"> {
  if (!isNewsletterToken(token)) return "unknown";
  const subscriber = await db.newsletterSubscriber.findUnique({ where: { token }, select: { confirmedAt: true } });
  return !subscriber ? "unknown" : subscriber.confirmedAt ? "confirmed" : "pending";
}

/** Confirme l'adresse du jeton (la date du premier clic est gardée). `false` : jeton inconnu. */
export async function confirmSubscription(db: Db, token: string, now = new Date()): Promise<boolean> {
  if (!isNewsletterToken(token)) return false;
  const { count } = await db.newsletterSubscriber.updateMany({ where: { token, confirmedAt: null }, data: { confirmedAt: now } });
  return count === 1 || (await db.newsletterSubscriber.count({ where: { token } })) === 1;
}

/** Retire l'adresse du jeton. Jeton inconnu ou déjà utilisé : rien à faire, ce n'est pas une erreur. */
export async function unsubscribe(db: Db, token: string): Promise<void> {
  if (!isNewsletterToken(token)) return;
  await db.newsletterSubscriber.deleteMany({ where: { token } });
}
