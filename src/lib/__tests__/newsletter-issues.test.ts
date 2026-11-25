import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db";
import { createTestDatabase } from "@/test/database";
import { createIssue, sendIssueBatch, sendTestIssue, updateIssue } from "@/actions/admin/newsletter";
import type { OutboxMessage } from "../mail/transport";
import { newsletterToken } from "../newsletter";

/*
 * Actions du back-office pour la lettre d'information (PLAN.md 7.14), contre une vraie base (schéma temporaire) et
 * l'outbox des tests (MAIL_OUTBOX) : rédaction validée par Zod, modification refusée une fois l'envoi commencé, essai
 * au vendeur, envoi par lots. La session est simulée : `requireAdmin` lève comme la redirection de Next.
 */

const test = vi.hoisted(() => ({ db: null as Db | null, role: null as string | null }));
vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db")>()),
  get db() {
    return test.db;
  },
}));
vi.mock("../auth", () => ({
  requireAdmin: async () => {
    if (test.role !== "ADMIN") throw new Error("NEXT_REDIRECT");
    return { id: "u", role: "ADMIN" };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key) }));
vi.mock("@/i18n/server", () => ({
  redirectTo: async (href: string) => {
    throw new Error(`NEXT_REDIRECT ${href}`);
  },
}));

let database: ReturnType<typeof createTestDatabase>;
let db: Db;
let outbox: string;

beforeAll(() => {
  database = createTestDatabase("lettres");
  db = test.db = database.db;
}, 60_000);
afterAll(() => database.drop());

beforeEach(async () => {
  test.role = "ADMIN";
  await db.newsletterIssue.deleteMany();
  await db.newsletterSubscriber.deleteMany();
  outbox = await mkdtemp(path.join(tmpdir(), "alarobia-lettre-"));
  vi.stubEnv("MAIL_OUTBOX", outbox);
  vi.stubEnv("SMTP_USER", "");
  vi.stubEnv("SMTP_PASSWORD", "");
  vi.stubEnv("SITE_ID", "");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://alarobia.example");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(outbox, { recursive: true, force: true });
});

async function readOutbox(): Promise<OutboxMessage[]> {
  const names = (await readdir(outbox).catch(() => [])).filter((n) => n.endsWith(".json")).sort();
  return Promise.all(names.map(async (n) => JSON.parse(await readFile(path.join(outbox, n), "utf8")) as OutboxMessage));
}

const form = (data: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
};

const confirmed = (email: string, locale = "fr") => db.newsletterSubscriber.create({ data: { email, token: newsletterToken(), locale, confirmedAt: new Date() } });

describe("createIssue", () => {
  it("enregistre la lettre et redirige vers sa page", async () => {
    await expect(createIssue({}, form({ subject: "  Nouveautés  ", body: "Bonjour.\r\n\r\nÀ bientôt." }))).rejects.toThrow(/^NEXT_REDIRECT \/admin\/newsletter\/issues\/c/);
    const [issue] = await db.newsletterIssue.findMany();
    expect(issue).toMatchObject({ subject: "Nouveautés", body: "Bonjour.\n\nÀ bientôt.", sentAt: null });
  });

  it("refuse un objet ou un texte vide, ou trop long, avec l'erreur sur le champ", async () => {
    const empty = await createIssue({}, form({ subject: " ", body: "" }));
    expect(empty.fieldErrors).toEqual({ subject: "issueSubjectRequired", body: "issueBodyRequired" });
    const long = await createIssue({}, form({ subject: "a".repeat(151), body: "b".repeat(20_001) }));
    expect(long.fieldErrors).toEqual({ subject: 'tooLong {"max":150}', body: 'tooLong {"max":20000}' });
    expect(await db.newsletterIssue.count()).toBe(0);
  });

  it("un objet sur plusieurs lignes (formulaire bricolé) est ramené à une ligne : pas d'en-tête injecté", async () => {
    await expect(createIssue({}, form({ subject: "Promo\r\nBcc: tous@exemple.mg", body: "Texte" }))).rejects.toThrow("NEXT_REDIRECT");
    expect((await db.newsletterIssue.findFirstOrThrow()).subject).toBe("Promo Bcc: tous@exemple.mg");
  });

  it("refusée sans session administrateur", async () => {
    test.role = "CUSTOMER";
    await expect(createIssue({}, form({ subject: "Objet", body: "Texte" }))).rejects.toThrow(/^NEXT_REDIRECT$/);
    expect(await db.newsletterIssue.count()).toBe(0);
  });
});

describe("updateIssue", () => {
  it("modifie l'objet et le texte tant que rien n'est parti", async () => {
    const issue = await db.newsletterIssue.create({ data: { subject: "Avant", body: "Texte" } });
    expect(await updateIssue(issue.id, {}, form({ subject: "Après", body: "Nouveau texte" }))).toMatchObject({ ok: true });
    expect(await db.newsletterIssue.findUniqueOrThrow({ where: { id: issue.id } })).toMatchObject({ subject: "Après", body: "Nouveau texte" });
  });

  it("refuse une fois l'envoi commencé", async () => {
    const issue = await db.newsletterIssue.create({ data: { subject: "Avant", body: "Texte" } });
    const s = await confirmed("a@exemple.mg");
    await db.newsletterDelivery.create({ data: { issueId: issue.id, subscriberId: s.id, ok: true } });
    expect(await updateIssue(issue.id, {}, form({ subject: "Après", body: "Nouveau texte" }))).toEqual({ error: "issueLocked" });
    expect((await db.newsletterIssue.findUniqueOrThrow({ where: { id: issue.id } })).subject).toBe("Avant");
  });

  it("refusée sans session administrateur", async () => {
    const issue = await db.newsletterIssue.create({ data: { subject: "Avant", body: "Texte" } });
    test.role = "CUSTOMER";
    await expect(updateIssue(issue.id, {}, form({ subject: "Après", body: "Texte" }))).rejects.toThrow("NEXT_REDIRECT");
    expect((await db.newsletterIssue.findUniqueOrThrow({ where: { id: issue.id } })).subject).toBe("Avant");
  });
});

describe("sendTestIssue", () => {
  it("envoie un essai au vendeur, objet préfixé, sans jeton réel ni livraison enregistrée", async () => {
    const issue = await db.newsletterIssue.create({ data: { subject: "Nouveautés", body: "Bonjour." } });
    const s = await confirmed("a@exemple.mg");
    expect(await sendTestIssue(issue.id)).toMatchObject({ ok: true });
    const mails = await readOutbox();
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("vendeur@alarobia.example");
    expect(mails[0].subject).toBe("testPrefix Nouveautés");
    expect(mails[0].text).toContain("/fr/newsletter/unsubscribe/");
    expect(mails[0].text).not.toContain(s.token);
    expect(await db.newsletterDelivery.count()).toBe(0);
  });

  it("refusé sans session administrateur", async () => {
    const issue = await db.newsletterIssue.create({ data: { subject: "Nouveautés", body: "Bonjour." } });
    test.role = "CUSTOMER";
    await expect(sendTestIssue(issue.id)).rejects.toThrow("NEXT_REDIRECT");
    expect(await readOutbox()).toHaveLength(0);
  });
});

describe("sendIssueBatch", () => {
  it("envoie la lettre aux inscrits confirmés, chacun avec son lien et ses en-têtes de désinscription", async () => {
    const issue = await db.newsletterIssue.create({ data: { subject: "Nouveautés", body: "Bonjour." } });
    const a = await confirmed("a@exemple.mg", "fr");
    const b = await confirmed("b@exemple.mg", "mg");
    expect(await sendIssueBatch(issue.id)).toEqual({ sent: 2, remaining: 0 });
    const mails = await readOutbox();
    expect(mails.map((m) => m.to).sort()).toEqual(["a@exemple.mg", "b@exemple.mg"]);
    for (const [s, locale] of [[a, "fr"], [b, "mg"]] as const) {
      const mail = mails.find((m) => m.to === s.email)!;
      expect(mail.subject).toBe("Nouveautés");
      expect(mail.text).toContain(`https://alarobia.example/${locale}/newsletter/unsubscribe/${s.token}`);
      expect(mail.headers?.["List-Unsubscribe"]).toBe(`<https://alarobia.example/api/newsletter/unsubscribe?token=${s.token}>`);
    }
    expect((await db.newsletterIssue.findUniqueOrThrow({ where: { id: issue.id } })).sentAt).toBeInstanceOf(Date);
  });

  it("refusée sans session administrateur : rien ne part", async () => {
    const issue = await db.newsletterIssue.create({ data: { subject: "Nouveautés", body: "Bonjour." } });
    await confirmed("a@exemple.mg");
    test.role = "CUSTOMER";
    await expect(sendIssueBatch(issue.id)).rejects.toThrow("NEXT_REDIRECT");
    expect(await readOutbox()).toHaveLength(0);
    expect(await db.newsletterDelivery.count()).toBe(0);
  });

  it("ne lève jamais vers l'interface : une panne de la base est journalisée et arrête le lot", async () => {
    const issue = await db.newsletterIssue.create({ data: { subject: "Nouveautés", body: "Bonjour." } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const real = test.db;
    test.db = new Proxy(real!, {
      get(target, prop) {
        if (prop === "newsletterIssue") throw new Error("base indisponible pour a@exemple.mg");
        return Reflect.get(target, prop);
      },
    });
    try {
      expect(await sendIssueBatch(issue.id)).toEqual({ sent: 0, remaining: 0, stopped: "error" });
      expect(error).toHaveBeenCalled();
      expect(String(error.mock.calls[0][0])).not.toContain("a@exemple.mg");
    } finally {
      test.db = real;
      error.mockRestore();
    }
  });
});
