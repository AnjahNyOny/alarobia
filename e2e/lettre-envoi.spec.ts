import { expect, test } from "@playwright/test";
import { createTranslator } from "next-intl";
import enMessages from "../messages/en.json";
import frMessages from "../messages/fr.json";
import mgMessages from "../messages/mg.json";
import { mergeMessages } from "../src/i18n/messages";
import { createDb } from "../src/lib/db";
import { newsletterToken } from "../src/lib/newsletter";
import { E2E_DATABASE_URL } from "./database";
import { ADMIN, expectAccessible, login, readOutbox, watchErrors } from "./helpers";

/*
 * Lettre d'information : rédaction et envoi (PLAN.md 7.14). Trois inscrits confirmés sont créés en base (fr, en, mg) ;
 * le vendeur rédige une lettre, s'envoie un essai, puis l'envoie. Chaque inscrit reçoit un message, avec son propre lien
 * de désinscription (dans sa langue) et l'en-tête List-Unsubscribe. D'autres tests créent des inscrits confirmés dans la
 * même base : l'outbox est filtrée sur l'objet, propre à ce test, et le nombre total d'inscrits n'est pas supposé.
 */

type Translate = (key: string, values?: Record<string, string | number>) => string;
type AnyMessages = Parameters<typeof createTranslator>[0]["messages"];
const translator = (locale: "fr" | "en" | "mg", messages: AnyMessages) => createTranslator({ locale, messages }) as unknown as Translate;
const fr = translator("fr", frMessages);
const T = { fr, en: translator("en", mergeMessages(frMessages, enMessages)), mg: translator("mg", mergeMessages(frMessages, mgMessages)) };

const db = createDb(E2E_DATABASE_URL);
const BASE = "http://localhost:3100";
/** Destinataire des essais sans SMTP (`DEMO_VENDOR`, src/lib/mail/order-mails.ts). */
const VENDOR = "vendeur@alarobia.example";

test("rédaction, essai au vendeur, envoi à trois inscrits confirmés, chacun avec son lien", async ({ page }) => {
  const check = watchErrors(page);
  const stamp = Date.now();
  const subject = `Paniers en raphia ${stamp}`;
  const subscribers = await Promise.all(
    (["fr", "en", "mg"] as const).map((locale) => db.newsletterSubscriber.create({ data: { email: `lettre-envoi-${locale}-${stamp}@exemple.mg`, token: newsletterToken(), locale, confirmedAt: new Date() } })),
  );

  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto("/fr/admin/newsletter");
  await expect(page.getByText(/^\d+ adresses? confirmées? sur \d+\./)).toBeVisible();
  await page.getByRole("link", { name: fr("admin.newsletter.write") }).click();
  await expect(page.getByRole("heading", { level: 1, name: fr("admin.newsletter.writeTitle") })).toBeVisible();

  // Formulaire refusé : l'erreur est sur le champ, la saisie reste.
  await page.getByLabel(fr("admin.newsletter.body")).fill("Bonjour,\n\nDes paniers sont arrivés : https://exemple.mg/paniers.");
  await page.getByLabel(fr("admin.newsletter.subject")).fill("   ");
  await page.getByRole("button", { name: fr("admin.newsletter.save") }).click();
  await expect(page.getByText(fr("admin.errors.issueSubjectRequired"))).toBeVisible();
  await expect(page.getByLabel(fr("admin.newsletter.subject"))).toBeFocused();
  await expectAccessible(page, "rédaction d'une lettre, objet refusé");

  await page.getByLabel(fr("admin.newsletter.subject")).fill(subject);
  await page.getByRole("button", { name: fr("admin.newsletter.save") }).click();
  await page.waitForURL(/\/fr\/admin\/newsletter\/issues\/c[a-z0-9]+$/);
  await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();
  const issueId = page.url().split("/").pop()!;

  // Aperçu : l'e-mail lui-même, dans un cadre isolé (ni script, ni navigation), avec le lien de la lettre et le pied.
  // Lu par son attribut `srcdoc` : entrer dans un cadre `sandbox=""` (localisateurs, axe) y fait tenter un script à
  // l'outil de test, que Chrome bloque et signale en console. L'e-mail n'est pas analysé par axe (voir expectAccessible).
  const preview = page.locator("iframe[sandbox]");
  await expect(preview).toHaveAttribute("sandbox", "");
  await expect(preview).toHaveAttribute("title", fr("admin.newsletter.previewFrame", { subject }));
  const srcdoc = (await preview.getAttribute("srcdoc")) ?? "";
  expect(srcdoc).toMatch(new RegExp(`<h1 [^>]*>${subject}</h1>`));
  expect(srcdoc).toContain('<a href="https://exemple.mg/paniers"');
  expect(srcdoc).toContain(`>${fr("mail.letter.unsubscribe")}</a>`);
  await expect(preview).toBeVisible();
  await expectAccessible(page, "lettre avant l'envoi", { exclude: ["iframe[sandbox]"] });

  // Essai : au vendeur seulement, objet préfixé, aucune livraison enregistrée.
  await page.getByRole("button", { name: fr("admin.newsletter.testButton") }).click();
  await expect(page.getByText(fr("admin.notices.testSent", { email: VENDOR }))).toBeVisible();
  const trial = (await readOutbox()).filter((m) => m.subject === `${fr("admin.newsletter.testPrefix")} ${subject}`);
  expect(trial).toHaveLength(1);
  expect(trial[0].to).toBe(VENDOR);
  expect(await db.newsletterDelivery.count({ where: { issueId } })).toBe(0);

  // Envoi, après confirmation.
  await page.getByRole("button", { name: /^Envoyer aux? \d+ inscrits? confirmés?$/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: fr("admin.newsletter.sendConfirmTitle", { subject }) })).toBeVisible();
  await dialog.getByRole("button", { name: fr("admin.newsletter.sendConfirm") }).click();
  // Fin de l'envoi : la page relue montre la date d'envoi, plus de bouton d'envoi ni de formulaire.
  await expect(page.locator("#lettre-envoyee")).toContainText("Envoyée le", { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /^Envoyer aux?/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: fr("admin.newsletter.editTitle") })).toHaveCount(0);
  await expectAccessible(page, "lettre envoyée", { exclude: ["iframe[sandbox]"] });

  // Un message par inscrit, avec son jeton, dans sa langue, et l'en-tête de désinscription en un clic.
  const sent = (await readOutbox()).filter((m) => m.subject === subject);
  for (const s of subscribers) {
    const mine = sent.filter((m) => m.to === s.email);
    expect(mine, s.email).toHaveLength(1);
    const [mail] = mine;
    const t = T[s.locale as keyof typeof T];
    expect(mail.text).toContain(`${BASE}/${s.locale}/newsletter/unsubscribe/${s.token}`);
    expect(mail.text).toContain(t("mail.letter.unsubscribe"));
    expect(mail.html).toContain('<a href="https://exemple.mg/paniers"');
    expect(mail.headers?.["List-Unsubscribe"]).toBe(`<${BASE}/api/newsletter/unsubscribe?token=${s.token}>`);
    expect(mail.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  }
  // Aucun inscrit n'a reçu deux fois la lettre, et le jeton d'un autre n'apparaît jamais.
  expect(new Set(sent.map((m) => m.to)).size).toBe(sent.length);
  for (const mail of sent) for (const other of subscribers.filter((s) => s.email !== mail.to)) expect(mail.text).not.toContain(other.token);

  // Historique : la lettre est envoyée.
  await page.goto("/fr/admin/newsletter");
  const row = page.getByRole("row", { name: new RegExp(subject) });
  await expect(row).toContainText("Envoyée le");
  // Le total n'est pas supposé : un test voisin peut désinscrire son adresse (et ses livraisons) entre-temps.
  await expect(row).toContainText(/\d+ réussis sur \d+/);
  check();
});
