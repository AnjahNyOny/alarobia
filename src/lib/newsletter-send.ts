import { Prisma } from "@prisma/client";
import type { Db } from "./db";
import type { LetterContent } from "./mail/newsletter-mails";
import type { MailMessage } from "./mail/transport";

/**
 * Envoi d'une lettre d'information par lots (PLAN.md 7.14). La page du back-office appelle l'action `sendIssueBatch`
 * tant qu'il reste des adresses ; chaque appel en sert quelques-unes et rend la main.
 *
 * - **Jamais deux fois la même lettre à la même adresse.** Chaque envoi est précédé de la création de sa ligne
 *   `NewsletterDelivery`, dont la clé primaire (lettre, inscrit) est unique : deux onglets qui envoient en même temps se
 *   disputent la ligne, un seul la crée et envoie, l'autre passe à l'adresse suivante.
 * - **Plafond de Gmail** : 300 lettres par 24 h glissantes, toutes lettres comprises (environ 500 messages par jour pour un
 *   compte personnel, la marge reste aux e-mails de commande). Une ligne réservée compte, qu'elle ait abouti ou non.
 * - **Durée** : une fonction Netlify peut être coupée vers 26 s et un envoi peut prendre 10 s (transport.ts). Les messages
 *   partent l'un après l'autre et le lot s'arrête avant le suivant dès que 15 s se sont écoulées.
 * - **Refus de Gmail** (quota, identifiants, réseau) : la ligne est retirée, l'adresse sera réessayée à la reprise, et le
 *   lot s'arrête : inutile d'insister auprès d'un serveur qui refuse.
 */

export const BATCH_SIZE = 10;
export const DAILY_LIMIT = 300;
export const DAILY_WINDOW_MS = 24 * 60 * 60_000;
export const BATCH_TIME_BUDGET_MS = 15_000;

export type BatchResult = { sent: number; remaining: number; stopped?: "quota" | "error" };

export type BatchDeps = {
  /** Envoie un message ; `false` (ou une exception) : refusé. `sendMail` en production. */
  send: (message: MailMessage) => Promise<boolean>;
  /** Message d'un inscrit : `newsletterIssueMail` en production. */
  build: (letter: LetterContent, subscriber: { email: string; token: string; locale: string }) => MailMessage;
  /** Heure courante, injectable pour les tests. */
  clock?: () => Date;
};

/** Inscrits confirmés qui n'ont pas de ligne pour cette lettre : ceux qui l'attendent encore. */
const waiting = (issueId: string): Prisma.NewsletterSubscriberWhereInput => ({ confirmedAt: { not: null }, deliveries: { none: { issueId } } });

/** Erreur de Prisma sur une clé déjà prise (P2002 : l'autre onglet a réservé l'adresse) ou un inscrit disparu (P2003 : désinscrit entre-temps). */
const lostRace = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2003");

export async function runIssueBatch(db: Db, issueId: string, { send, build, clock = () => new Date() }: BatchDeps): Promise<BatchResult> {
  const start = clock().getTime();
  const issue = await db.newsletterIssue.findUnique({ where: { id: issueId } });
  if (!issue) return { sent: 0, remaining: 0, stopped: "error" };
  // Une lettre envoyée l'est pour de bon : une adresse confirmée après coup ne la reçoit pas.
  if (issue.sentAt) return { sent: 0, remaining: 0 };

  const used = await db.newsletterDelivery.count({ where: { sentAt: { gt: new Date(start - DAILY_WINDOW_MS) } } });
  const allowance = Math.min(BATCH_SIZE, DAILY_LIMIT - used);
  let sent = 0;
  let reserved = 0;
  let stopped: BatchResult["stopped"];

  if (allowance <= 0) stopped = "quota";
  else {
    const recipients = await db.newsletterSubscriber.findMany({ where: waiting(issueId), orderBy: { id: "asc" }, take: allowance, select: { id: true, email: true, token: true, locale: true } });
    for (const subscriber of recipients) {
      if (clock().getTime() - start >= BATCH_TIME_BUDGET_MS) break;
      // Réservation avant l'envoi. Si la fonction est coupée entre cette ligne et la fin de l'envoi, la ligne reste à
      // `ok: false` et l'adresse ne sera pas resservie : c'est voulu, mieux vaut une lettre perdue qu'une lettre en double.
      try {
        await db.newsletterDelivery.create({ data: { issueId, subscriberId: subscriber.id, sentAt: clock(), ok: false } });
      } catch (error) {
        if (lostRace(error)) continue;
        throw error;
      }
      reserved++;
      const ok = await send(build(issue, subscriber)).catch(() => false);
      if (!ok) {
        // Refusé : rien n'est parti, l'adresse retourne dans la file et le plafond retrouve sa place.
        await db.newsletterDelivery.deleteMany({ where: { issueId, subscriberId: subscriber.id } });
        reserved--;
        stopped = "error";
        break;
      }
      // updateMany : l'inscrit a pu se désinscrire pendant l'envoi, sa ligne est alors partie avec lui.
      await db.newsletterDelivery.updateMany({ where: { issueId, subscriberId: subscriber.id }, data: { ok: true } });
      sent++;
    }
  }

  const remaining = await db.newsletterSubscriber.count({ where: waiting(issueId) });
  if (remaining === 0) {
    await db.newsletterIssue.updateMany({ where: { id: issueId, sentAt: null }, data: { sentAt: clock() } });
    return { sent, remaining };
  }
  // Plafond atteint par ce lot : la page n'a pas à rappeler l'action pour l'apprendre.
  if (!stopped && used + reserved >= DAILY_LIMIT) stopped = "quota";
  return stopped ? { sent, remaining, stopped } : { sent, remaining };
}

/** Avancement d'une lettre : lignes réussies, lignes réservées en tout, et inscrits confirmés qui l'attendent encore. */
export async function issueProgress(db: Db, issueId: string): Promise<{ delivered: number; attempted: number; remaining: number }> {
  const [delivered, attempted, remaining] = await Promise.all([
    db.newsletterDelivery.count({ where: { issueId, ok: true } }),
    db.newsletterDelivery.count({ where: { issueId } }),
    db.newsletterSubscriber.count({ where: waiting(issueId) }),
  ]);
  return { delivered, attempted, remaining };
}
