import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db";
import { createTestDatabase } from "@/test/database";
import type { MailMessage } from "../mail/transport";
import { subscribeNewsletter } from "@/actions/shop";
import { confirmNewsletter, unsubscribeNewsletter } from "@/actions/newsletter";
import { POST } from "@/app/api/newsletter/unsubscribe/route";
import * as route from "@/app/api/newsletter/unsubscribe/route";

/*
 * Actions de la lettre d'information (PLAN.md 7.13), contre une vraie base (schéma temporaire) : inscription depuis le
 * pied de page, confirmation et désinscription par le bouton des pages du lien, désinscription en un clic
 * (`List-Unsubscribe-Post`, RFC 8058). L'envoi est simulé (`sendMail`) et `after()` est différé jusqu'à `flush()` :
 * comme en ligne, le message part après la réponse.
 */

const test = vi.hoisted(() => ({ db: null as Db | null, locale: "fr", ip: "203.0.113.1", later: [] as (() => unknown)[] }));
const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn<(message: MailMessage) => Promise<boolean>>() }));

vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db")>()),
  get db() {
    return test.db;
  },
}));
vi.mock("../auth", () => ({ getUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": test.ip }) }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: (task: () => unknown) => void test.later.push(task) }));
vi.mock("next-intl/server", () => ({ getTranslations: async (ns?: string) => (key: string) => `${ns}.${key}`, getLocale: async () => test.locale }));
vi.mock("../mail/transport", async (importOriginal) => ({ ...(await importOriginal<typeof import("../mail/transport")>()), sendMail }));

let database: ReturnType<typeof createTestDatabase>;
let db: Db;
let ipCounter = 0;

beforeAll(() => {
  database = createTestDatabase("lettre_actions");
  db = test.db = database.db;
}, 60_000);
afterAll(() => database.drop());

beforeEach(async () => {
  await db.newsletterSubscriber.deleteMany();
  sendMail.mockReset().mockResolvedValue(true);
  test.later = [];
  test.locale = "fr";
  // Une adresse IP par test : la limite de 10 inscriptions par heure ne gêne pas les tests entre eux.
  test.ip = `203.0.113.${++ipCounter}`;
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://alarobia.example");
});

/** Exécute ce qui a été confié à `after()`. */
async function flush() {
  const tasks = test.later.splice(0);
  await Promise.all(tasks.map((task) => task()));
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};
const subscribe = (email: string) => subscribeNewsletter({}, form({ email }));
const row = (email: string) => db.newsletterSubscriber.findUnique({ where: { email } });

describe("subscribeNewsletter", () => {
  it("envoie la confirmation après la réponse, dans la langue de la page, avec le lien du jeton", async () => {
    test.locale = "en";
    expect(await subscribe("rakoto@exemple.mg")).toEqual({ ok: true, message: "notices.newsletterDone" });
    expect(sendMail).not.toHaveBeenCalled();
    await flush();
    const saved = await row("rakoto@exemple.mg");
    expect(saved?.locale).toBe("en");
    expect(sendMail).toHaveBeenCalledTimes(1);
    const [mail] = sendMail.mock.calls[0];
    expect(mail.to).toBe("rakoto@exemple.mg");
    expect(mail.text).toContain(`https://alarobia.example/en/newsletter/confirm/${saved?.token}`);
  });

  it("deux inscriptions de la même adresse : même réponse, un seul e-mail", async () => {
    const answers = [await subscribe("rakoto@exemple.mg"), await subscribe("rakoto@exemple.mg")];
    await flush();
    expect(answers[0]).toEqual(answers[1]);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("adresse déjà confirmée : même réponse, aucun e-mail", async () => {
    await subscribe("rakoto@exemple.mg");
    await flush();
    const saved = await row("rakoto@exemple.mg");
    await db.newsletterSubscriber.update({ where: { email: "rakoto@exemple.mg" }, data: { confirmedAt: new Date(), confirmSentAt: new Date(0) } });
    sendMail.mockClear();
    expect(await subscribe("rakoto@exemple.mg")).toEqual({ ok: true, message: "notices.newsletterDone" });
    await flush();
    expect(sendMail).not.toHaveBeenCalled();
    expect((await row("rakoto@exemple.mg"))?.token).toBe(saved?.token);
  });

  it("adresse invalide : erreur, rien d'enregistré", async () => {
    expect(await subscribe("pas-une-adresse")).toEqual({ error: "errors.emailInvalid" });
    await flush();
    expect(await db.newsletterSubscriber.count()).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("envoi refusé par Gmail : la réponse ne change pas, et une nouvelle inscription peut renvoyer la confirmation", async () => {
    sendMail.mockResolvedValueOnce(false);
    expect(await subscribe("rakoto@exemple.mg")).toEqual({ ok: true, message: "notices.newsletterDone" });
    await flush();
    await subscribe("rakoto@exemple.mg");
    await flush();
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("envoi qui lève : rien ne remonte, l'erreur est journalisée sans l'adresse", async () => {
    sendMail.mockRejectedValueOnce(new Error("socket fermé pour rakoto@exemple.mg"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await subscribe("rakoto@exemple.mg");
    await expect(flush()).resolves.toBeUndefined();
    const logged = error.mock.calls.flat().map(String).join("\n");
    error.mockRestore();
    expect(logged).toContain("[mail]");
    expect(logged).not.toContain("rakoto@exemple.mg");
  });
});

describe("confirmNewsletter", () => {
  it("confirme l'adresse du jeton", async () => {
    await subscribe("rakoto@exemple.mg");
    const { token } = (await row("rakoto@exemple.mg"))!;
    expect(await confirmNewsletter({}, form({ token }))).toEqual({ ok: true, message: "newsletter.confirmedText" });
    expect((await row("rakoto@exemple.mg"))?.confirmedAt).toBeInstanceOf(Date);
  });

  it("jeton inconnu : erreur neutre, rien ne change", async () => {
    await subscribe("rakoto@exemple.mg");
    expect(await confirmNewsletter({}, form({ token: "b2".repeat(32) }))).toEqual({ error: "newsletter.invalidText" });
    expect(await confirmNewsletter({}, form({}))).toEqual({ error: "newsletter.invalidText" });
    expect((await row("rakoto@exemple.mg"))?.confirmedAt).toBeNull();
  });
});

describe("unsubscribeNewsletter", () => {
  it("retire l'adresse du jeton", async () => {
    await subscribe("rakoto@exemple.mg");
    const { token } = (await row("rakoto@exemple.mg"))!;
    expect(await unsubscribeNewsletter({}, form({ token }))).toEqual({ ok: true, message: "newsletter.unsubscribedText" });
    expect(await row("rakoto@exemple.mg")).toBeNull();
  });

  it("jeton inconnu ou déjà utilisé : même réponse que pour une vraie désinscription", async () => {
    await subscribe("rakoto@exemple.mg");
    for (const token of ["b2".repeat(32), "n'importe quoi"]) expect(await unsubscribeNewsletter({}, form({ token }))).toEqual({ ok: true, message: "newsletter.unsubscribedText" });
    expect(await db.newsletterSubscriber.count()).toBe(1);
  });
});

describe("POST /api/newsletter/unsubscribe (un clic, RFC 8058)", () => {
  const request = (token: string) =>
    new Request(`https://alarobia.example/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    });

  it("retire l'adresse du jeton et répond 200", async () => {
    await subscribe("rakoto@exemple.mg");
    const { token } = (await row("rakoto@exemple.mg"))!;
    const res = await POST(request(token));
    expect(res.status).toBe(200);
    expect(await row("rakoto@exemple.mg")).toBeNull();
  });

  it("jeton inconnu, mal formé ou absent : 200, rien ne change", async () => {
    await subscribe("rakoto@exemple.mg");
    for (const token of ["b2".repeat(32), "x"]) expect((await POST(request(token))).status).toBe(200);
    expect((await POST(new Request("https://alarobia.example/api/newsletter/unsubscribe", { method: "POST" }))).status).toBe(200);
    expect(await db.newsletterSubscriber.count()).toBe(1);
  });

  it("ne répond à aucun GET : un antivirus qui suit le lien ne désinscrit personne", () => {
    expect(Object.keys(route)).not.toContain("GET");
  });
});
