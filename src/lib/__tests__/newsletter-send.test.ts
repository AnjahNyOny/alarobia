import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db";
import type { MailMessage } from "../mail/transport";
import { newsletterToken } from "../newsletter";
import { BATCH_SIZE, DAILY_LIMIT, runIssueBatch, type BatchDeps } from "../newsletter-send";
import { createTestDatabase } from "@/test/database";

/*
 * Envoi d'une lettre d'information par lots (PLAN.md 7.14), contre une vraie base (schéma temporaire). L'envoi est
 * simulé : `send` note les messages et renvoie ce que le test décide. Points vérifiés : lots de 10, reprise sans
 * doublon, deux onglets en même temps, plafond de 300 envois par 24 h glissantes, arrêt sur un refus de Gmail,
 * arrêt avant 15 s, inscrits non confirmés ignorés, date d'envoi posée à la fin.
 */

let database: ReturnType<typeof createTestDatabase>;
let db: Db;

beforeAll(() => {
  database = createTestDatabase("envoi");
  db = database.db;
}, 60_000);
afterAll(() => database.drop());

beforeEach(async () => {
  await db.newsletterIssue.deleteMany();
  await db.newsletterSubscriber.deleteMany();
});

const NOW = new Date("2026-11-25T08:00:00Z");
const HOUR = 60 * 60_000;

/** `n` inscrits confirmés (ou non), adresses triées comme leurs identifiants n'ont pas à l'être : on relit l'ordre en base. */
async function subscribers(n: number, { confirmed = true, prefix = "inscrit" } = {}) {
  await db.newsletterSubscriber.createMany({
    data: Array.from({ length: n }, (_, i) => ({ email: `${prefix}-${String(i).padStart(3, "0")}@exemple.mg`, token: newsletterToken(), confirmedAt: confirmed ? new Date("2026-11-01T00:00:00Z") : null })),
  });
}

const issue = (subject = "Nouveautés de novembre") => db.newsletterIssue.create({ data: { subject, body: "Bonjour.\n\nDes paniers en raphia sont arrivés." } });

/** Envoi simulé : chaque message est noté ; `fail(to)` décide d'un refus. */
type Options = { fail?: (to: string) => boolean; clock?: () => Date; onSend?: (message: MailMessage) => Promise<void> };
function deps({ fail = () => false, clock = () => NOW, onSend = async () => {} }: Options = {}) {
  const sent: string[] = [];
  const d: BatchDeps = {
    clock,
    build: (letter, subscriber) => ({ to: subscriber.email, subject: letter.subject, html: "", text: subscriber.token }),
    send: async (message) => {
      await onSend(message);
      if (fail(message.to)) return false;
      sent.push(message.to);
      return true;
    },
  };
  return { sent, deps: d };
}

const confirmedEmails = async () => (await db.newsletterSubscriber.findMany({ where: { confirmedAt: { not: null } }, orderBy: { id: "asc" }, select: { email: true } })).map((s) => s.email);

describe("runIssueBatch", () => {
  it("envoie au plus 10 messages par appel, dans l'ordre des identifiants", async () => {
    await subscribers(25);
    const letter = await issue();
    const { sent, deps: d } = deps();
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: BATCH_SIZE, remaining: 15 });
    expect(sent).toEqual((await confirmedEmails()).slice(0, 10));
    const rows = await db.newsletterDelivery.findMany({ where: { issueId: letter.id } });
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.ok && r.sentAt.getTime() === NOW.getTime())).toBe(true);
  });

  it("reprend où il en était, sans jamais renvoyer à la même adresse", async () => {
    await subscribers(15);
    const letter = await issue();
    const { sent, deps: d } = deps();
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: 10, remaining: 5 });
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: 5, remaining: 0 });
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: 0, remaining: 0 });
    expect(sent).toEqual(await confirmedEmails());
  });

  it("deux appels en même temps (deux onglets) n'envoient pas deux fois à la même adresse", async () => {
    await subscribers(15);
    const letter = await issue();
    // Chaque envoi rend la main : les deux lots s'entrecroisent vraiment.
    const { sent, deps: d } = deps({ onSend: () => new Promise((resolve) => setTimeout(resolve, 5)) });
    const results = await Promise.all([runIssueBatch(db, letter.id, d), runIssueBatch(db, letter.id, d)]);
    expect(new Set(sent).size).toBe(sent.length);
    expect(results[0].sent + results[1].sent).toBe(sent.length);
    // Un dernier appel termine : chaque adresse a reçu la lettre une fois, et une seule.
    while ((await runIssueBatch(db, letter.id, d)).remaining > 0);
    expect([...sent].sort()).toEqual([...(await confirmedEmails())].sort());
    expect(sent).toHaveLength(15);
  });

  it("s'arrête au plafond de 300 envois sur 24 h glissantes, toutes lettres comprises", async () => {
    // 295 envois d'une lettre précédente dans les dernières 24 h (à des adresses désinscrites depuis… ou non confirmées ici).
    await subscribers(DAILY_LIMIT - 5, { confirmed: false, prefix: "ancien" });
    const previous = await issue("Lettre d'octobre");
    const old = await db.newsletterSubscriber.findMany({ select: { id: true } });
    await db.newsletterDelivery.createMany({ data: old.map((s, i) => ({ issueId: previous.id, subscriberId: s.id, sentAt: new Date(NOW.getTime() - 23 * HOUR), ok: i % 2 === 0 })) });
    await subscribers(20);
    const letter = await issue();
    const { sent, deps: d } = deps();
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: 5, remaining: 15, stopped: "quota" });
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: 0, remaining: 15, stopped: "quota" });
    expect(sent).toHaveLength(5);
    // Les envois de plus de 24 h ne comptent plus.
    await db.newsletterDelivery.updateMany({ where: { issueId: previous.id }, data: { sentAt: new Date(NOW.getTime() - 25 * HOUR) } });
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: 10, remaining: 5 });
  });

  it("un refus de Gmail arrête le lot et rend l'adresse : la reprise la réessaie", async () => {
    await subscribers(6);
    const letter = await issue();
    const emails = await confirmedEmails();
    let down = true;
    const { sent, deps: d } = deps({ fail: (to) => down && to === emails[2] });
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: 2, remaining: 4, stopped: "error" });
    expect(sent).toEqual(emails.slice(0, 2));
    const rows = await db.newsletterDelivery.findMany({ where: { issueId: letter.id }, include: { subscriber: { select: { email: true } } } });
    expect(rows.map((r) => r.subscriber.email).sort()).toEqual(emails.slice(0, 2));
    down = false;
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: 4, remaining: 0 });
    expect(sent).toEqual(emails);
  });

  it("un envoi qui lève est traité comme un refus", async () => {
    await subscribers(3);
    const letter = await issue();
    const { deps: d } = deps();
    const result = await runIssueBatch(db, letter.id, {
      ...d,
      send: async () => {
        throw new Error("connexion perdue");
      },
    });
    expect(result).toEqual({ sent: 0, remaining: 3, stopped: "error" });
    expect(await db.newsletterDelivery.count()).toBe(0);
  });

  it("s'arrête avant le message suivant dès que 15 s se sont écoulées", async () => {
    await subscribers(10);
    const letter = await issue();
    // Chaque envoi prend 6 s : après le troisième, 18 s se sont écoulées.
    let t = NOW.getTime();
    const { sent, deps: d } = deps({ clock: () => new Date(t), onSend: async () => void (t += 6_000) });
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: 3, remaining: 7 });
    expect(sent).toHaveLength(3);
  });

  it("ignore les inscrits qui n'ont pas confirmé leur adresse", async () => {
    await subscribers(2);
    await subscribers(3, { confirmed: false, prefix: "attente" });
    const letter = await issue();
    const { sent, deps: d } = deps();
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: 2, remaining: 0 });
    expect(sent.every((to) => to.startsWith("inscrit-"))).toBe(true);
  });

  it("pose la date d'envoi de la lettre quand il ne reste plus personne, pas avant", async () => {
    await subscribers(12);
    const letter = await issue();
    const { deps: d } = deps();
    await runIssueBatch(db, letter.id, d);
    expect((await db.newsletterIssue.findUniqueOrThrow({ where: { id: letter.id } })).sentAt).toBeNull();
    const later = new Date(NOW.getTime() + 60_000);
    await runIssueBatch(db, letter.id, { ...d, clock: () => later });
    expect((await db.newsletterIssue.findUniqueOrThrow({ where: { id: letter.id } })).sentAt).toEqual(later);
  });

  it("une lettre déjà envoyée ne part pas aux adresses confirmées après coup", async () => {
    await subscribers(2);
    const letter = await issue();
    const { sent, deps: d } = deps();
    await runIssueBatch(db, letter.id, d);
    await subscribers(1, { prefix: "nouveau" });
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: 0, remaining: 0 });
    expect(sent).toHaveLength(2);
  });

  it("une adresse désinscrite pendant le lot est sautée, sans erreur", async () => {
    await subscribers(3);
    const letter = await issue();
    const emails = await confirmedEmails();
    // Pendant l'envoi au premier, le deuxième se désinscrit (sa ligne disparaît).
    const { sent, deps: d } = deps({ onSend: async (m) => void (m.to === emails[0] && (await db.newsletterSubscriber.delete({ where: { email: emails[1] } }))) });
    expect(await runIssueBatch(db, letter.id, d)).toEqual({ sent: 2, remaining: 0 });
    expect(sent).toEqual([emails[0], emails[2]]);
  });

  it("lettre inconnue : rien n'est envoyé", async () => {
    await subscribers(2);
    const { sent, deps: d } = deps();
    expect(await runIssueBatch(db, "inconnue", d)).toEqual({ sent: 0, remaining: 0, stopped: "error" });
    expect(sent).toHaveLength(0);
  });
});
