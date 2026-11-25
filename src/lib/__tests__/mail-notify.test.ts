import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db";
import { createTestDatabase } from "@/test/database";
import { DEMO_VENDOR } from "../mail/order-mails";
import type { MailMessage } from "../mail/transport";
import { notifyOrderPlaced, notifyPaymentDeclared, notifyStatusChange } from "../mail/notify";

/*
 * Branchement des e-mails de commande (PLAN.md 7.12) : relit la commande et les réglages dans la base (schéma temporaire),
 * construit les messages et les confie à `sendMail`, ici simulé. Point de vigilance 2 : un envoi refusé, une exception
 * ou une base indisponible ne remontent jamais à l'action qui a enregistré la commande. Ces fonctions tournent dans
 * `after()`, après la réponse ; si l'une d'elles levait, Next journaliserait une erreur pour une commande pourtant
 * enregistrée. Un échec d'envoi n'est pas reproductible dans un test navigateur (l'outbox est toujours inscriptible) :
 * c'est ici qu'il est prouvé.
 */

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn<(message: MailMessage) => Promise<boolean>>() }));
vi.mock("../mail/transport", async (importOriginal) => ({ ...(await importOriginal<typeof import("../mail/transport")>()), sendMail }));

const BASE = "https://alarobia.example";
let database: ReturnType<typeof createTestDatabase>;
let db: Db;
let n = 0;

beforeAll(async () => {
  database = createTestDatabase("mail_notify");
  db = database.db;
  await db.storeSettings.create({ data: { id: 1, mvolaNumber: "034 00 123 45", mobileMoneyName: "Alarobia" } });
}, 60_000);

afterAll(() => database?.drop());

beforeEach(() => {
  sendMail.mockReset().mockResolvedValue(true);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", BASE);
  vi.stubEnv("SMTP_USER", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const makeOrder = (extra: { locale?: string; status?: string; paymentMethod?: string; paymentReference?: string; trackingNumber?: string } = {}) =>
  db.order.create({
    data: {
      number: `AL-N${++n}`,
      email: "rakoto@example.mg",
      status: extra.status ?? "PENDING",
      paymentMethod: extra.paymentMethod ?? "MVOLA",
      paymentReference: extra.paymentReference,
      trackingNumber: extra.trackingNumber,
      locale: extra.locale ?? "fr",
      shippingZone: "Antananarivo ville",
      subtotalCents: 2_400_000,
      shippingCents: 300_000,
      totalCents: 2_700_000,
      fullName: "<b>Rakoto</b>",
      line1: "Lot IVB 12",
      city: "Antananarivo",
      phone: "034 11 222 33",
      items: { create: [{ name: "Tasse en grès Vato", priceCents: 1_200_000, quantity: 2 }] },
    },
  });

const sent = () => sendMail.mock.calls.map(([message]) => message);
const silence = () => vi.spyOn(console, "error").mockImplementation(() => {});
const logged = (spy: ReturnType<typeof silence>) => spy.mock.calls.map((args) => args.map(String).join(" ")).join("\n");

describe("notifyOrderPlaced", () => {
  it("envoie le message du client, dans la langue de la commande, et l'avis au vendeur, en français", async () => {
    const order = await makeOrder({ locale: "en" });
    await notifyOrderPlaced(db, order.id);
    const [client, vendor] = [sent().find((m) => m.to === "rakoto@example.mg"), sent().find((m) => m.to === DEMO_VENDOR)];
    expect(sent()).toHaveLength(2);
    expect(client?.subject).toBe(`Order ${order.number} confirmed`);
    expect(client?.text).toContain(`${BASE}/en/order/${order.id}`);
    expect(client?.text).toContain("034 00 123 45");
    expect(vendor?.subject).toMatch(new RegExp(`^Nouvelle commande ${order.number} : `));
    expect(vendor?.text).toContain(`${BASE}/fr/admin/orders/${order.id}`);
  });

  it("lance les deux envois en même temps : chacun peut prendre jusqu'à 10 s", async () => {
    const order = await makeOrder();
    let release = () => {};
    const gate = new Promise<boolean>((resolve) => (release = () => resolve(true)));
    sendMail.mockImplementation(() => gate);
    const done = notifyOrderPlaced(db, order.id);
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(2));
    release();
    await done;
  });

  it("avis au vendeur : à l'adresse du compte d'envoi quand elle est configurée", async () => {
    vi.stubEnv("SMTP_USER", "alarobia.shop@gmail.com");
    const order = await makeOrder();
    await notifyOrderPlaced(db, order.id);
    expect(sent().map((m) => m.to).sort()).toEqual(["alarobia.shop@gmail.com", "rakoto@example.mg"]);
  });

  it("un envoi refusé ou qui lève ne fait rien échouer : l'autre part quand même, l'erreur est journalisée sans l'adresse", async () => {
    const order = await makeOrder();
    sendMail.mockRejectedValueOnce(new Error("socket fermé pour rakoto@example.mg")).mockResolvedValueOnce(false);
    const error = silence();
    await expect(notifyOrderPlaced(db, order.id)).resolves.toBeUndefined();
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(logged(error)).toContain(order.number);
    expect(logged(error)).not.toContain("rakoto@example.mg");
  });

  it("base indisponible : ne lève pas, journalise", async () => {
    const broken = { order: { findUnique: () => Promise.reject(new Error("connexion refusée")) } } as unknown as Db;
    const error = silence();
    await expect(notifyOrderPlaced(broken, "cmquelconque")).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
    expect(logged(error)).toContain("connexion refusée");
  });

  it("commande introuvable : rien n'est envoyé, rien ne lève", async () => {
    const error = silence();
    await expect(notifyOrderPlaced(db, "inexistante")).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});

describe("notifyPaymentDeclared", () => {
  it("un seul message, au vendeur, avec la référence déclarée", async () => {
    const order = await makeOrder({ locale: "mg", paymentReference: "PP261114.1010.A00002" });
    await notifyPaymentDeclared(db, order.id);
    expect(sent()).toHaveLength(1);
    expect(sent()[0].to).toBe(DEMO_VENDOR);
    expect(sent()[0].subject).toBe(`Paiement à vérifier : commande ${order.number}`);
    expect(sent()[0].text).toContain("PP261114.1010.A00002");
  });

  it("ne lève pas quand l'envoi lève", async () => {
    const order = await makeOrder({ paymentReference: "PP1" });
    sendMail.mockRejectedValue(new Error("panne"));
    silence();
    await expect(notifyPaymentDeclared(db, order.id)).resolves.toBeUndefined();
  });
});

describe("notifyStatusChange", () => {
  it("statut réellement changé : un message au client, avec le numéro de suivi relu dans la base", async () => {
    const order = await makeOrder({ locale: "mg", status: "SHIPPED", trackingNumber: "6A00011122233" });
    await notifyStatusChange(db, order.id, { from: "PAID", to: "SHIPPED" });
    expect(sent()).toHaveLength(1);
    expect(sent()[0].to).toBe("rakoto@example.mg");
    expect(sent()[0].subject).toBe(`Lasa ny komandy ${order.number}`);
    expect(sent()[0].text).toContain("6A00011122233");
    expect(sent()[0].text).toContain(`${BASE}/mg/order/${order.id}`);
  });

  it("statut inchangé ou « en attente » : rien n'est envoyé", async () => {
    const order = await makeOrder({ status: "PAID" });
    await notifyStatusChange(db, order.id, { from: "PAID", to: "PAID" });
    await notifyStatusChange(db, order.id, { from: "PAID", to: "PENDING" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("ne lève pas quand l'envoi lève", async () => {
    const order = await makeOrder({ status: "PAID" });
    sendMail.mockRejectedValue(new Error("panne"));
    silence();
    await expect(notifyStatusChange(db, order.id, { from: "PENDING", to: "PAID" })).resolves.toBeUndefined();
  });
});
