import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { createTestDatabase } from "@/test/database";
import { CONFIRMATION_INTERVAL_MS, confirmSubscription, isNewsletterToken, newsletterToken, releaseConfirmation, requestSubscription, subscriptionState, unsubscribe } from "../newsletter";

/*
 * Lettre d'information (PLAN.md 7.13) : double confirmation et désinscription par jeton, contre une vraie base
 * (schéma temporaire). Point de vigilance 4 : une adresse, même inscrite plusieurs fois ou par quelqu'un d'autre,
 * reçoit au plus un e-mail de confirmation par 24 h. Point de vigilance 5 : lire la page d'un lien (ce que fait un
 * antivirus de messagerie) ne change rien ; seule l'action envoyée par le bouton confirme ou retire.
 */

let database: ReturnType<typeof createTestDatabase>;
let db: Db;

beforeAll(() => {
  database = createTestDatabase("lettre_jeton");
  db = database.db;
}, 60_000);
afterAll(() => database.drop());

beforeEach(async () => {
  await db.newsletterSubscriber.deleteMany();
});

const NOW = new Date("2026-11-25T08:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);
const row = (email: string) => db.newsletterSubscriber.findUniqueOrThrow({ where: { email } });

describe("newsletterToken", () => {
  it("donne 64 caractères hexadécimaux (32 octets), différents à chaque appel", () => {
    const [a, b] = [newsletterToken(), newsletterToken()];
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(isNewsletterToken(a)).toBe(true);
  });
  it.each(["", "abc", "Z".repeat(64), `${"a".repeat(64)}0`, "../".repeat(22)])("refuse %j comme jeton", (value) => {
    expect(isNewsletterToken(value)).toBe(false);
  });
});

describe("requestSubscription", () => {
  it("adresse nouvelle : enregistre la langue, un jeton, et rend de quoi envoyer la confirmation", async () => {
    const pending = await requestSubscription(db, "rakoto@exemple.mg", "mg", NOW);
    const saved = await row("rakoto@exemple.mg");
    expect(pending).toEqual({ email: "rakoto@exemple.mg", token: saved.token, locale: "mg", sentAt: NOW });
    expect(saved).toMatchObject({ locale: "mg", confirmedAt: null, confirmSentAt: NOW });
    expect(saved.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("une seule confirmation par 24 h : la deuxième inscription ne rend rien et ne change pas la langue", async () => {
    expect(await requestSubscription(db, "rakoto@exemple.mg", "fr", NOW)).not.toBeNull();
    expect(await requestSubscription(db, "rakoto@exemple.mg", "en", later(23 * 3600_000))).toBeNull();
    expect((await row("rakoto@exemple.mg")).locale).toBe("fr");
  });

  it("deux inscriptions simultanées de la même adresse : une seule confirmation", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => requestSubscription(db, "double@exemple.mg", "fr", NOW)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await db.newsletterSubscriber.count()).toBe(1);
  });

  it("après 24 h, une nouvelle confirmation part, dans la langue de la nouvelle inscription, avec le même jeton", async () => {
    const first = await requestSubscription(db, "rakoto@exemple.mg", "fr", NOW);
    const second = await requestSubscription(db, "rakoto@exemple.mg", "en", later(CONFIRMATION_INTERVAL_MS + 1));
    expect(second).toEqual({ email: "rakoto@exemple.mg", token: first?.token, locale: "en", sentAt: later(CONFIRMATION_INTERVAL_MS + 1) });
    expect((await row("rakoto@exemple.mg")).locale).toBe("en");
  });

  it("adresse déjà confirmée : aucun envoi, rien ne change", async () => {
    const pending = await requestSubscription(db, "rakoto@exemple.mg", "fr", NOW);
    await confirmSubscription(db, pending!.token, NOW);
    const before = await row("rakoto@exemple.mg");
    expect(await requestSubscription(db, "rakoto@exemple.mg", "en", later(3 * CONFIRMATION_INTERVAL_MS))).toBeNull();
    expect(await row("rakoto@exemple.mg")).toEqual(before);
  });

  it("releaseConfirmation : un envoi échoué libère la place, une nouvelle inscription renvoie la confirmation", async () => {
    const pending = await requestSubscription(db, "rakoto@exemple.mg", "fr", NOW);
    await releaseConfirmation(db, pending!);
    expect((await row("rakoto@exemple.mg")).confirmSentAt).toBeNull();
    expect(await requestSubscription(db, "rakoto@exemple.mg", "fr", later(60_000))).not.toBeNull();
  });

  it("releaseConfirmation ne libère pas une confirmation partie depuis (autre envoi plus récent)", async () => {
    const pending = await requestSubscription(db, "rakoto@exemple.mg", "fr", NOW);
    const next = await requestSubscription(db, "rakoto@exemple.mg", "fr", later(CONFIRMATION_INTERVAL_MS + 1));
    await releaseConfirmation(db, pending!);
    expect((await row("rakoto@exemple.mg")).confirmSentAt).toEqual(next!.sentAt);
  });
});

describe("confirmation", () => {
  it("lire l'état (la page du lien) ne change rien", async () => {
    const pending = await requestSubscription(db, "rakoto@exemple.mg", "fr", NOW);
    const before = await row("rakoto@exemple.mg");
    expect(await subscriptionState(db, pending!.token)).toBe("pending");
    expect(await subscriptionState(db, pending!.token)).toBe("pending");
    expect(await row("rakoto@exemple.mg")).toEqual(before);
  });

  it("confirmSubscription pose la date de confirmation, une seule fois", async () => {
    const pending = await requestSubscription(db, "rakoto@exemple.mg", "fr", NOW);
    expect(await confirmSubscription(db, pending!.token, later(60_000))).toBe(true);
    expect((await row("rakoto@exemple.mg")).confirmedAt).toEqual(later(60_000));
    expect(await subscriptionState(db, pending!.token)).toBe("confirmed");
    // Deuxième clic, ou lien rouvert : toujours confirmée, à la date du premier clic.
    expect(await confirmSubscription(db, pending!.token, later(120_000))).toBe(true);
    expect((await row("rakoto@exemple.mg")).confirmedAt).toEqual(later(60_000));
  });

  it("jeton inconnu ou mal formé : rien ne change, l'état est « inconnu »", async () => {
    await requestSubscription(db, "rakoto@exemple.mg", "fr", NOW);
    for (const token of [newsletterToken(), "pas-un-jeton"]) {
      expect(await subscriptionState(db, token)).toBe("unknown");
      expect(await confirmSubscription(db, token, NOW)).toBe(false);
    }
    expect((await row("rakoto@exemple.mg")).confirmedAt).toBeNull();
  });
});

describe("unsubscribe", () => {
  it("retire l'adresse du jeton, et seulement elle", async () => {
    const a = await requestSubscription(db, "a@exemple.mg", "fr", NOW);
    await requestSubscription(db, "b@exemple.mg", "fr", NOW);
    await unsubscribe(db, a!.token);
    expect((await db.newsletterSubscriber.findMany()).map((s) => s.email)).toEqual(["b@exemple.mg"]);
  });

  it("jeton inconnu, mal formé ou déjà utilisé : ne lève pas, ne retire rien", async () => {
    const a = await requestSubscription(db, "a@exemple.mg", "fr", NOW);
    await unsubscribe(db, a!.token);
    await requestSubscription(db, "b@exemple.mg", "fr", NOW);
    for (const token of [a!.token, newsletterToken(), "pas-un-jeton"]) await expect(unsubscribe(db, token)).resolves.toBeUndefined();
    expect(await db.newsletterSubscriber.count()).toBe(1);
  });

  it("une réinscription après désinscription donne un nouveau jeton : l'ancien lien ne vaut plus", async () => {
    const a = await requestSubscription(db, "a@exemple.mg", "fr", NOW);
    await unsubscribe(db, a!.token);
    const again = await requestSubscription(db, "a@exemple.mg", "fr", later(60_000));
    expect(again?.token).not.toBe(a!.token);
    expect(await subscriptionState(db, a!.token)).toBe("unknown");
  });
});
