import { expect, test } from "@playwright/test";
import { createTranslator } from "next-intl";
import enMessages from "../messages/en.json";
import frMessages from "../messages/fr.json";
import { mergeMessages } from "../src/i18n/messages";
import { createDb } from "../src/lib/db";
import { E2E_DATABASE_URL } from "./database";
import { ADMIN, expectAccessible, login, readOutbox, watchErrors } from "./helpers";

/*
 * Lettre d'information (PLAN.md 7.13) : inscription en anglais depuis le pied de page, e-mail de confirmation lu dans
 * l'outbox du serveur de test, confirmation par le bouton de la page du lien, adresse confirmée dans le back-office,
 * puis désinscription par le bouton de la page du lien. Points de vigilance 4 (une seule confirmation par 24 h) et 5
 * (ouvrir un lien, comme le fait un antivirus de messagerie, ne change rien).
 */

type Translate = (key: string, values?: Record<string, string | number>) => string;
const translator = (locale: "fr" | "en", messages: Parameters<typeof createTranslator>[0]["messages"]) => createTranslator({ locale, messages }) as unknown as Translate;
const en = translator("en", mergeMessages(frMessages, enMessages));
const fr = translator("fr", frMessages);

const db = createDb(E2E_DATABASE_URL);
const BASE = "http://localhost:3100";
const UNKNOWN_TOKEN = "0".repeat(64);

test("inscription, e-mail de confirmation, confirmation, back-office, désinscription", async ({ page, browser, baseURL, request }) => {
  const check = watchErrors(page);
  // Adresse IP propre à ce test : l'inscription est limitée à 10 par heure et par adresse IP.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.62" });
  const email = `lettre-confirmation-${Date.now()}@exemple.mg`;
  const subscribe = async () => {
    await page.goto("/en");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByText(en("footer.newsletterText"))).toBeVisible();
    await footer.getByLabel(en("footer.newsletterLabel")).fill(email);
    await footer.getByRole("button", { name: en("footer.subscribe") }).click();
    await expect(footer.getByRole("status")).toHaveText(en("notices.newsletterDone"));
  };

  // Inscription : un e-mail de confirmation, en anglais, avec le lien vers la page de confirmation en anglais.
  await subscribe();
  const mailsTo = async () => (await readOutbox()).filter((m) => m.to === email);
  await expect.poll(async () => (await mailsTo()).length).toBe(1);
  const [mail] = await mailsTo();
  expect(mail.subject).toBe(en("mail.newsletter.subject", { shop: "Alarobia" }));
  expect(mail.html).toMatch(/<html lang="en"/);
  const link = mail.text.match(new RegExp(`${BASE}/en/newsletter/confirm/([0-9a-f]{64})`));
  expect(link, mail.text).not.toBeNull();
  const [url, token] = link!;
  const row = () => db.newsletterSubscriber.findUnique({ where: { email } });
  expect(await row()).toMatchObject({ token, locale: "en", confirmedAt: null });

  // Même adresse une seconde fois : même réponse à l'écran, aucun second e-mail.
  const firstSent = (await row())?.confirmSentAt;
  await subscribe();
  expect((await row())?.confirmSentAt).toEqual(firstSent);
  expect(await mailsTo()).toHaveLength(1);

  // Un antivirus qui ouvre le lien ne confirme rien.
  expect((await request.get(url)).status()).toBe(200);
  expect((await row())?.confirmedAt).toBeNull();

  // Le bouton de la page confirme.
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en("newsletter.confirmTitle"));
  await expectAccessible(page, "confirmation de la lettre, avant le clic");
  await page.getByRole("button", { name: en("newsletter.confirmButton") }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en("newsletter.confirmedTitle"));
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.getByRole("link", { name: en("newsletter.home") })).toBeVisible();
  expect((await row())?.confirmedAt).toBeInstanceOf(Date);
  // Lien rouvert : déjà confirmée, plus de bouton.
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en("newsletter.confirmedTitle"));
  await expect(page.getByRole("button", { name: en("newsletter.confirmButton") })).toHaveCount(0);

  // Une adresse déjà confirmée qui se réinscrit : même réponse, aucun e-mail.
  await subscribe();
  expect(await mailsTo()).toHaveLength(1);

  // Back-office : l'adresse est confirmée, dans la page et dans l'export.
  const admin = await browser.newPage({ baseURL });
  await login(admin, ADMIN.email, ADMIN.password);
  await admin.waitForURL("**/admin");
  await admin.goto(`/fr/admin/newsletter?q=${encodeURIComponent(email)}`);
  await expect(admin.getByRole("columnheader", { name: fr("admin.newsletter.colConfirmed") })).toBeVisible();
  const adminRow = admin.getByRole("row", { name: new RegExp(email.replaceAll(".", "\\.")) });
  await expect(adminRow.getByRole("cell").nth(2)).toHaveText(/\d{4}$/);
  await admin.close();

  // Désinscription : ouvrir le lien ne retire rien, le bouton retire l'adresse.
  const unsubscribe = `/en/newsletter/unsubscribe/${token}`;
  expect((await request.get(unsubscribe)).status()).toBe(200);
  expect(await row()).not.toBeNull();
  await page.goto(unsubscribe);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en("newsletter.unsubscribeTitle"));
  await expectAccessible(page, "désinscription de la lettre, avant le clic");
  await page.getByRole("button", { name: en("newsletter.unsubscribeButton") }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en("newsletter.unsubscribedTitle"));
  expect(await row()).toBeNull();
  await expectAccessible(page, "désinscription de la lettre, après le clic");

  // Le lien de confirmation ne vaut plus rien : page neutre, sans bouton.
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en("newsletter.invalidTitle"));
  await expect(page.getByText(en("newsletter.invalidText"))).toBeVisible();
  await expect(page.getByRole("button", { name: en("newsletter.confirmButton") })).toHaveCount(0);
  check();
});

test("lien de confirmation inconnu : page neutre, sans session, sans bouton", async ({ page }) => {
  const check = watchErrors(page);
  const res = await page.goto(`/fr/newsletter/confirm/${UNKNOWN_TOKEN}`);
  expect(res?.status()).toBe(200);
  expect(page.url()).toBe(`${BASE}/fr/newsletter/confirm/${UNKNOWN_TOKEN}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(fr("newsletter.invalidTitle"));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expectAccessible(page, "lien de confirmation inconnu");
  // Désinscription d'un jeton inconnu : même réussite qu'une vraie désinscription.
  await page.goto(`/fr/newsletter/unsubscribe/${UNKNOWN_TOKEN}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.getByRole("button", { name: fr("newsletter.unsubscribeButton") }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(fr("newsletter.unsubscribedTitle"));
  check();
});

test("désinscription en un clic depuis la messagerie (RFC 8058) : POST seulement", async ({ request }) => {
  const email = `lettre-un-clic-${Date.now()}@exemple.mg`;
  const token = `${Date.now().toString(16).padStart(16, "0")}${"ab".repeat(24)}`;
  await db.newsletterSubscriber.create({ data: { email, token, confirmedAt: new Date() } });
  const route = `/api/newsletter/unsubscribe?token=${token}`;

  const get = await request.get(route);
  expect(get.status()).toBe(405);
  expect(await db.newsletterSubscriber.findUnique({ where: { email } })).not.toBeNull();

  const post = await request.post(route, { form: { "List-Unsubscribe": "One-Click" } });
  expect(post.status()).toBe(200);
  expect(await db.newsletterSubscriber.findUnique({ where: { email } })).toBeNull();

  // Jeton inconnu ou déjà utilisé : 200 aussi.
  expect((await request.post(route, { form: { "List-Unsubscribe": "One-Click" } })).status()).toBe(200);
});
