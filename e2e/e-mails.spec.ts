import { expect, test } from "@playwright/test";
import { createTranslator } from "next-intl";
import frMessages from "../messages/fr.json";
import mgMessages from "../messages/mg.json";
import { mergeMessages } from "../src/i18n/messages";
import { createDb } from "../src/lib/db";
import { formatPrice } from "../src/lib/format";
import { E2E_DATABASE_URL } from "./database";
import { ADMIN, CART_ADD_TIMEOUT, login, readOutbox, watchErrors } from "./helpers";

/*
 * E-mails de commande (PLAN.md 7.12), lus dans l'outbox du serveur de test (`MAIL_OUTBOX`) : une commande passée en
 * malgache, payée par MVola, puis traitée par le vendeur. Chaque e-mail part après la réponse (`after()`) : on l'attend
 * avec `expect.poll`. Toute la suite partage l'outbox : les messages sont filtrés sur le numéro de la commande.
 * Un envoi qui échoue ne bloque pas la commande : prouvé par src/lib/__tests__/mail-notify.test.ts (l'outbox du serveur
 * de test ne peut pas échouer sur commande).
 */

test.describe.configure({ mode: "serial" });

type Translate = (key: string, values?: Record<string, string | number>) => string;
const translator = (locale: "fr" | "mg", messages: Parameters<typeof createTranslator>[0]["messages"]) => createTranslator({ locale, messages }) as unknown as Translate;
const mg = translator("mg", mergeMessages(frMessages, mgMessages));
const fr = translator("fr", frMessages);

const db = createDb(E2E_DATABASE_URL);
const BASE = "http://localhost:3100";
/** Destinataire des avis au vendeur sans SMTP (`DEMO_VENDOR`, src/lib/mail/order-mails.ts), écrit ici : le changer doit faire échouer ce test. */
const VENDOR = "vendeur@alarobia.example";
const email = `e-mails.${Date.now() % 1_000_000}@example.com`;
const reference = `MP${Date.now().toString(36).toUpperCase()}`;
const tracking = `6A${Date.now().toString().slice(-11)}`;
let orderId = "";
let number = "";

/** Messages de cette commande, du plus ancien au plus récent. */
const mailsOf = async (to: string) => (await readOutbox()).filter((m) => m.to === to && m.subject.includes(number));

test("commande Mobile Money en malgache : un e-mail au client, en malgache, et un avis au vendeur, en français", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/mg/products/tasse-en-gres-vato");
  await page.getByRole("button", { name: mg("product.add"), exact: true }).click();
  await expect(page.getByRole("heading", { name: mg("cart.title") })).toBeVisible({ timeout: CART_ADD_TIMEOUT });
  await page.goto("/mg/checkout");
  const field = (key: string) => page.getByLabel(mg(key), { exact: true });
  await field("checkout.email").fill(email);
  await field("address.fullName").fill("Fanja Rakotomalala");
  await field("address.phone").fill("034 21 654 98");
  await field("address.line1").fill("Lot IVD 27 bis");
  await field("address.district").fill("Ambatonakanga");
  await field("address.city").fill("Antananarivo");
  await field("address.province").selectOption("Antananarivo");
  await page.getByRole("radio", { name: /MVola/ }).check();
  await page.getByRole("button", { name: mg("payment.submit"), exact: true }).click();
  await page.waitForURL(/\/mg\/order\/c/);
  orderId = new URL(page.url()).pathname.split("/").pop()!;

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const settings = await db.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
  number = order.number;
  expect(order.locale).toBe("mg");

  await expect.poll(async () => (await mailsOf(email)).length + (await mailsOf(VENDOR)).length).toBe(2);
  const [client] = await mailsOf(email);
  expect(client.subject).toBe(mg("mail.received.subject", { number }));
  expect(client.html).toMatch(/<html lang="mg"/);
  expect(client.text).toContain(`${BASE}/mg/order/${orderId}`);
  expect(client.text).toContain(formatPrice(order.totalCents, "MGA", "mg"));
  expect(client.text).toContain(settings.mvolaNumber);
  expect(client.text).toContain("Fanja Rakotomalala");

  const [vendor] = await mailsOf(VENDOR);
  expect(vendor.subject).toBe(fr("mail.vendor.newOrder.subject", { number, amount: formatPrice(order.totalCents, "MGA", "fr") }));
  expect(vendor.html).toMatch(/<html lang="fr"/);
  expect(vendor.text).toContain(`${BASE}/fr/admin/orders/${orderId}`);
  expect(vendor.text).toContain("034 21 654 98");
  check();
});

test("le client indique sa référence : un avis au vendeur, rien au client", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto(`/mg/order/${orderId}`);
  const panel = page.getByRole("region", { name: mg("payment.title", { operator: "MVola" }) });
  await panel.getByLabel(mg("payment.referenceLabel")).fill(reference);
  await panel.getByRole("button", { name: mg("payment.referenceSubmit") }).click();
  await expect(panel.getByText(new RegExp(reference))).toBeVisible();

  await expect.poll(async () => (await mailsOf(VENDOR)).length).toBe(2);
  const declared = (await mailsOf(VENDOR))[1];
  expect(declared.subject).toBe(fr("mail.vendor.declared.subject", { number }));
  expect(declared.text).toContain(reference);
  expect(declared.text).toContain(`${BASE}/fr/admin/orders/${orderId}`);
  expect(await mailsOf(email)).toHaveLength(1);
  check();
});

test("« Paiement reçu » : un e-mail au client, dans la langue de sa commande", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto(`/fr/admin/orders/${orderId}`);
  await page.getByRole("button", { name: "Paiement reçu" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Paiement reçu" }).click();
  await expect(page.getByText("Paiement confirmé : la commande est à préparer.")).toBeVisible();

  await expect.poll(async () => (await mailsOf(email)).length).toBe(2);
  const paid = (await mailsOf(email))[1];
  expect(paid.subject).toBe(mg("mail.status.PAID.subject", { number }));
  expect(paid.text).toContain(`${BASE}/mg/order/${orderId}`);
  // Rien de plus au vendeur : c'est lui qui a confirmé.
  expect(await mailsOf(VENDOR)).toHaveLength(2);
  check();
});

test("numéro de suivi ajouté seul : pas d'e-mail ; passage à « expédiée » : un e-mail avec le numéro", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto(`/fr/admin/orders/${orderId}`);
  await page.getByLabel("Numéro de suivi").fill(tracking);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Commande mise à jour.")).toBeVisible();

  await page.getByLabel("Statut").selectOption("SHIPPED");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  const shippedSubject = mg("mail.status.SHIPPED.subject", { number });
  await expect.poll(async () => (await mailsOf(email)).map((m) => m.subject)).toContain(shippedSubject);
  // Reçu, payé, expédié : l'enregistrement du seul numéro de suivi, fait avant, n'a rien envoyé.
  const mails = await mailsOf(email);
  expect(mails.map((m) => m.subject)).toEqual([mg("mail.received.subject", { number }), mg("mail.status.PAID.subject", { number }), shippedSubject]);
  expect(mails[2].text).toContain(tracking);
  check();
});
