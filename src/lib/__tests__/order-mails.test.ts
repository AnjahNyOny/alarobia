import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatPrice } from "../format";
import {
  customerReplyTo,
  DEMO_VENDOR,
  newOrderVendorMail,
  NOTIFIED_STATUSES,
  orderReceivedMail,
  paymentDeclaredVendorMail,
  statusMail,
  statusToNotify,
  vendorAddress,
  type MailContext,
  type MailOrder,
  type MailSettings,
} from "../mail/order-mails";
import { translateMail } from "../mail/translate";

/*
 * E-mails de commande (PLAN.md 7.12) : fonctions pures, commande + réglages → message. Textes dans `mail` des trois
 * fichiers de messages, traduits par le même moteur que le site. Chaque fonction est vérifiée en fr, en et mg ; le nom
 * du client (`<b>Rakoto</b>`) est échappé dans le HTML et intact dans le texte ; les liens sont absolus, dans la langue
 * de la commande pour le client, en français pour le vendeur.
 */

const LOCALES: Locale[] = ["fr", "en", "mg"];
const BASE = "https://alarobia.example";

const order = (extra: Partial<MailOrder> = {}): MailOrder => ({
  id: "cmord123",
  number: "AL-TEST1",
  email: "rakoto@example.mg",
  locale: "fr",
  status: "PENDING",
  paymentMethod: "MVOLA",
  paymentReference: null,
  paidAt: null,
  fullName: "<b>Rakoto</b>",
  phone: "034 11 222 33",
  line1: "Lot IVB 12",
  line2: null,
  district: "Ambohijatovo",
  postalCode: "",
  city: "Antananarivo",
  province: "Antananarivo",
  shippingZone: "Antananarivo ville",
  // Date du calendrier malgache (champs locaux), comme Order.estimatedDelivery.
  estimatedDelivery: new Date(2026, 10, 27),
  discountCents: 0,
  promoCode: null,
  shippingCents: 300_000,
  totalCents: 2_700_000,
  trackingNumber: null,
  note: null,
  items: [{ name: "Tasse en grès Vato", quantity: 2, priceCents: 1_200_000 }],
  ...extra,
});

const settings = (extra: Partial<MailSettings> = {}): MailSettings => ({
  currency: "MGA",
  contactEmail: "bonjour@alarobia.example",
  mvolaNumber: "034 00 123 45",
  orangeMoneyNumber: "032 00 123 45",
  airtelMoneyNumber: "",
  mobileMoneyName: "Alarobia",
  ...extra,
});

// Mercredi 25 novembre 2026, 11 h à Antananarivo.
const ctx: MailContext = { translate: translateMail, base: BASE, vendor: DEMO_VENDOR, now: new Date("2026-11-25T08:00:00Z") };

const amount = (cents: number, locale: Locale) => formatPrice(cents, "MGA", locale);
/** Texte du message sans retours à la ligne ni espaces insécables, pour y chercher une phrase. */
const flat = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ");

describe("orderReceivedMail (client)", () => {
  for (const locale of LOCALES) {
    it(`en ${locale} : destinataire, numéro, articles, total en ariary, zone, date promise, lien absolu dans la langue`, () => {
      const mail = orderReceivedMail(order({ locale }), settings(), ctx);
      expect(mail.to).toBe("rakoto@example.mg");
      expect(mail.subject).toContain("AL-TEST1");
      expect(mail.html).toMatch(new RegExp(`<html lang="${locale}"`));
      for (const body of [mail.text, mail.html]) {
        expect(body).toContain(`${BASE}/${locale}/order/cmord123`);
        expect(body).toContain("2 × Tasse en grès Vato");
        expect(body).toContain(amount(2_400_000, locale));
        expect(body).toContain(amount(2_700_000, locale));
        expect(body).toContain("Antananarivo ville");
        expect(body).toContain(formatDate(new Date(2026, 10, 27), locale, "weekday"));
      }
    });
  }

  it("écrit dans la langue de la commande : sujet propre à chaque langue", () => {
    const subjects = LOCALES.map((locale) => orderReceivedMail(order({ locale }), settings(), ctx).subject);
    expect(subjects[0]).toBe("Commande AL-TEST1 enregistrée");
    expect(new Set(subjects).size).toBe(3);
  });

  it("une langue inconnue retombe sur le français", () => {
    const mail = orderReceivedMail(order({ locale: "de" }), settings(), ctx);
    expect(mail.subject).toBe("Commande AL-TEST1 enregistrée");
    expect(mail.text).toContain(`${BASE}/fr/order/cmord123`);
  });

  it("Mobile Money : montant, numéro, opérateur et titulaire du vendeur, puis le bouton pour indiquer la référence", () => {
    const mail = orderReceivedMail(order(), settings(), ctx);
    const text = flat(mail.text);
    expect(text).toContain("envoyez 27 000 Ar au 034 00 123 45");
    expect(text).toContain("MVola");
    expect(text).toContain("Titulaire du compte : Alarobia.");
    expect(text).toContain("indiquez le numéro de commande AL-TEST1");
    expect(text).toContain(`Indiquer la référence ${BASE}/fr/order/cmord123`);
    expect(mail.html).toContain(`href="${BASE}/fr/order/cmord123"`);
  });

  it("Mobile Money : lit le numéro de l'opérateur choisi (Orange Money ici)", () => {
    const text = flat(orderReceivedMail(order({ paymentMethod: "ORANGE_MONEY" }), settings(), ctx).text);
    expect(text).toContain("032 00 123 45");
    expect(text).toContain("Orange Money");
    expect(text).not.toContain("034 00 123 45");
  });

  it("Mobile Money sans titulaire renseigné : pas de phrase sur le titulaire", () => {
    expect(orderReceivedMail(order(), settings({ mobileMoneyName: "" }), ctx).text).not.toContain("Titulaire du compte");
  });

  it("Mobile Money dont l'opérateur n'a plus de numéro : renvoie seulement vers la page de la commande", () => {
    const mail = orderReceivedMail(order({ paymentMethod: "AIRTEL_MONEY" }), settings(), ctx);
    const text = flat(mail.text);
    expect(text).toContain("Airtel Money");
    expect(text).toContain("les indications sont sur la page de votre commande");
    expect(text).not.toMatch(/envoyez|033 00/);
    expect(mail.text).toContain(`${BASE}/fr/order/cmord123`);
  });

  it("paiement à la livraison : le montant à régler au livreur, aucune indication Mobile Money", () => {
    const text = flat(orderReceivedMail(order({ paymentMethod: "COD" }), settings(), ctx).text);
    expect(text).toContain("Vous réglerez 27 000 Ar en espèces au livreur.");
    expect(text).not.toMatch(/MVola|référence/);
  });

  it("annonce l'e-mail d'expédition (promesse de la page de confirmation)", () => {
    expect(flat(orderReceivedMail(order(), settings(), ctx).text)).toContain("Nous vous écrirons à nouveau dès l'expédition du colis.");
  });

  it("réduction et livraison offerte", () => {
    const text = flat(orderReceivedMail(order({ discountCents: 270_000, promoCode: "BIENVENUE10", shippingCents: 0, totalCents: 2_130_000 }), settings(), ctx).text);
    expect(text).toContain("Réduction (BIENVENUE10) : −2 700 Ar");
    expect(text).toContain("Livraison : offerte");
    expect(text).toContain("Total : 21 300 Ar");
  });

  it("sans date promise, n'en écrit pas", () => {
    expect(orderReceivedMail(order({ estimatedDelivery: null }), settings(), ctx).text).not.toContain("au plus tard");
  });

  it("nom du client : échappé dans le HTML, intact dans le texte", () => {
    const mail = orderReceivedMail(order(), settings(), ctx);
    expect(mail.html).toContain("&lt;b&gt;Rakoto&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Rakoto</b>");
    expect(mail.text).toContain("<b>Rakoto</b>");
  });

  it("Reply-To : l'adresse de contact des réglages, sauf l'adresse d'exemple", () => {
    expect(orderReceivedMail(order(), settings(), ctx).replyTo).toBeUndefined();
    expect(orderReceivedMail(order(), settings({ contactEmail: "alarobia.shop@gmail.com" }), ctx).replyTo).toBe("alarobia.shop@gmail.com");
  });
});

describe("customerReplyTo et vendorAddress", () => {
  it("customerReplyTo : rien pour l'adresse d'exemple ou une adresse vide", () => {
    expect(customerReplyTo("bonjour@alarobia.example")).toBeUndefined();
    expect(customerReplyTo(" ")).toBeUndefined();
    expect(customerReplyTo(" alarobia.shop@gmail.com ")).toBe("alarobia.shop@gmail.com");
  });

  it("vendorAddress : le compte d'envoi s'il est configuré, sinon l'adresse de démonstration", () => {
    expect(vendorAddress("alarobia.shop@gmail.com")).toBe("alarobia.shop@gmail.com");
    expect(vendorAddress("")).toBe(DEMO_VENDOR);
    expect(vendorAddress(undefined)).toBe(DEMO_VENDOR);
    expect(DEMO_VENDOR).toBe("vendeur@alarobia.example");
  });
});

describe("newOrderVendorMail (vendeur)", () => {
  it("en français même pour une commande en malgache : numéro, total, paiement, nom, téléphone, lien vers le back-office", () => {
    const mail = newOrderVendorMail(order({ locale: "mg" }), settings(), ctx);
    expect(mail.to).toBe(DEMO_VENDOR);
    expect(mail.subject).toBe(`Nouvelle commande AL-TEST1 : ${amount(2_700_000, "fr")}`);
    expect(mail.html).toMatch(/<html lang="fr"/);
    const text = flat(mail.text);
    expect(text).toContain("Client : <b>Rakoto</b>, 034 11 222 33");
    expect(text).toContain("Paiement : MVola, en attente du client.");
    expect(text).toContain("2 × Tasse en grès Vato");
    expect(text).toContain(`Ouvrir la commande ${BASE}/fr/admin/orders/cmord123`);
    expect(mail.html).toContain(`href="${BASE}/fr/admin/orders/cmord123"`);
  });

  it("à l'adresse du vendeur donnée par le contexte", () => {
    expect(newOrderVendorMail(order(), settings(), { ...ctx, vendor: "alarobia.shop@gmail.com" }).to).toBe("alarobia.shop@gmail.com");
  });

  it("paiement à la livraison", () => {
    expect(flat(newOrderVendorMail(order({ paymentMethod: "COD" }), settings(), ctx).text)).toContain("Paiement : à la livraison, 27 000 Ar en espèces.");
  });

  it("nom et note du client échappés dans le HTML, intacts dans le texte", () => {
    const mail = newOrderVendorMail(order({ note: "Sonnez <fort> & attendez" }), settings(), ctx);
    expect(mail.html).toContain("&lt;b&gt;Rakoto&lt;/b&gt;");
    expect(mail.html).toContain("Sonnez &lt;fort&gt; &amp; attendez");
    expect(mail.html).not.toContain("<b>Rakoto</b>");
    expect(mail.text).toContain("<b>Rakoto</b>");
    expect(mail.text).toContain("Sonnez <fort> & attendez");
  });

  it("Reply-To : l'adresse du client, pour que le vendeur lui réponde directement", () => {
    expect(newOrderVendorMail(order(), settings({ contactEmail: "alarobia.shop@gmail.com" }), ctx).replyTo).toBe(order().email);
  });
});

describe("paymentDeclaredVendorMail (vendeur)", () => {
  const declared = order({ locale: "en", paymentReference: "PP261114.1010.A00002" });

  it("en français : référence déclarée, opérateur, montant, numéro crédité, lien vers la commande", () => {
    const mail = paymentDeclaredVendorMail(declared, settings(), ctx);
    expect(mail.to).toBe(DEMO_VENDOR);
    expect(mail.subject).toBe("Paiement à vérifier : commande AL-TEST1");
    const text = flat(mail.text);
    expect(text).toContain("PP261114.1010.A00002");
    expect(text).toContain("27 000 Ar par MVola");
    expect(text).toContain("034 00 123 45");
    expect(text).toContain(`${BASE}/fr/admin/orders/cmord123`);
    expect(mail.html).toMatch(/<html lang="fr"/);
    expect(mail.replyTo).toBe(declared.email);
  });

  it("référence échappée dans le HTML", () => {
    // Le formulaire n'accepte que lettres, chiffres, points et tirets ; le gabarit échappe quand même.
    const mail = paymentDeclaredVendorMail(order({ paymentReference: "<x>" }), settings(), ctx);
    expect(mail.html).toContain("&lt;x&gt;");
    expect(mail.html).not.toContain("<x>");
  });
});

describe("statusToNotify (décision d'envoi)", () => {
  it("prévient pour payée, expédiée, livrée, annulée, remboursée", () => {
    expect(NOTIFIED_STATUSES).toEqual(["PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]);
    for (const status of NOTIFIED_STATUSES) expect(statusToNotify("PENDING", status)).toBe(status);
    expect(statusToNotify("CANCELLED", "REFUNDED")).toBe("REFUNDED");
  });

  it("rien pour un statut inchangé (numéro de suivi ajouté seul)", () => {
    for (const status of ["PENDING", ...NOTIFIED_STATUSES]) expect(statusToNotify(status, status)).toBeNull();
  });

  it("rien pour un retour à « en attente », ni pour un statut inconnu", () => {
    expect(statusToNotify("PAID", "PENDING")).toBeNull();
    expect(statusToNotify("PENDING", "LOST")).toBeNull();
  });
});

describe("statusMail (client)", () => {
  it("aucun e-mail pour un statut inchangé ou « en attente »", () => {
    expect(statusMail(order({ status: "SHIPPED" }), { from: "SHIPPED", to: "SHIPPED" }, settings(), ctx)).toBeNull();
    expect(statusMail(order(), { from: "PAID", to: "PENDING" }, settings(), ctx)).toBeNull();
  });

  for (const locale of LOCALES) {
    it(`en ${locale} : un sujet propre à chaque statut, avec le numéro, et le lien dans la langue`, () => {
      const subjects = NOTIFIED_STATUSES.map((to) => {
        const mail = statusMail(order({ locale, status: to }), { from: to === "REFUNDED" ? "CANCELLED" : "PENDING", to }, settings(), ctx)!;
        expect(mail.to).toBe("rakoto@example.mg");
        expect(mail.subject).toContain("AL-TEST1");
        expect(mail.text).toContain(`${BASE}/${locale}/order/cmord123`);
        expect(mail.html).toMatch(new RegExp(`<html lang="${locale}"`));
        return mail.subject;
      });
      expect(new Set(subjects).size).toBe(NOTIFIED_STATUSES.length);
    });
  }

  it("payée : le montant reçu", () => {
    const mail = statusMail(order({ status: "PAID" }), { from: "PENDING", to: "PAID" }, settings(), ctx)!;
    expect(mail.subject).toBe("Paiement reçu : commande AL-TEST1");
    expect(flat(mail.text)).toContain("Nous avons bien reçu votre paiement de 27 000 Ar pour la commande AL-TEST1.");
  });

  it("expédiée : numéro de suivi s'il y en a, date promise si elle n'est pas passée", () => {
    const shipped = statusMail(order({ status: "SHIPPED", trackingNumber: "6A00011122233" }), { from: "PAID", to: "SHIPPED" }, settings(), ctx)!;
    expect(shipped.subject).toBe("Commande AL-TEST1 expédiée");
    const text = flat(shipped.text);
    expect(text).toContain("Numéro de suivi : 6A00011122233");
    expect(text).toContain("Livraison prévue au plus tard vendredi 27 novembre.");
    const bare = flat(statusMail(order({ status: "SHIPPED" }), { from: "PAID", to: "SHIPPED" }, settings(), ctx)!.text);
    expect(bare).not.toContain("suivi");
    const late = flat(statusMail(order({ status: "SHIPPED", estimatedDelivery: new Date(2026, 10, 24) }), { from: "PAID", to: "SHIPPED" }, settings(), ctx)!.text);
    expect(late).not.toContain("au plus tard");
  });

  it("expédiée, à payer à la livraison : le montant à préparer pour le livreur", () => {
    const text = flat(statusMail(order({ status: "SHIPPED", paymentMethod: "COD" }), { from: "PENDING", to: "SHIPPED" }, settings(), ctx)!.text);
    expect(text).toContain("Prévoyez 27 000 Ar en espèces pour le livreur.");
    const paid = flat(statusMail(order({ status: "SHIPPED" }), { from: "PAID", to: "SHIPPED" }, settings(), ctx)!.text);
    expect(paid).not.toContain("Prévoyez");
  });

  it("numéro de suivi échappé dans le HTML", () => {
    const mail = statusMail(order({ status: "SHIPPED", trackingNumber: "<script>x</script>" }), { from: "PAID", to: "SHIPPED" }, settings(), ctx)!;
    expect(mail.html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(mail.html).not.toContain("<script>");
  });

  it("annulée : phrase de remboursement seulement si le paiement Mobile Money avait été confirmé", () => {
    const refund = "Vous aviez payé 27 000 Ar par MVola : nous vous remboursons.";
    const cancel = (method: string, from: string) => flat(statusMail(order({ status: "CANCELLED", paymentMethod: method }), { from, to: "CANCELLED" }, settings(), ctx)!.text);
    expect(cancel("MVOLA", "PAID")).toContain(refund);
    expect(cancel("MVOLA", "SHIPPED")).toContain(refund);
    expect(cancel("MVOLA", "PENDING")).not.toContain("rembours");
    expect(cancel("COD", "DELIVERED")).not.toContain("rembours");
    expect(cancel("COD", "PENDING")).toContain("La commande AL-TEST1 est annulée.");
  });

  it("Reply-To des e-mails de statut : même règle", () => {
    const change = { from: "PENDING", to: "PAID" };
    expect(statusMail(order(), change, settings(), ctx)!.replyTo).toBeUndefined();
    expect(statusMail(order(), change, settings({ contactEmail: "alarobia.shop@gmail.com" }), ctx)!.replyTo).toBe("alarobia.shop@gmail.com");
  });

  it("nom du client échappé dans le HTML, intact dans le texte", () => {
    const mail = statusMail(order({ status: "DELIVERED" }), { from: "SHIPPED", to: "DELIVERED" }, settings(), ctx)!;
    expect(mail.html).toContain("&lt;b&gt;Rakoto&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Rakoto</b>");
    expect(mail.text).toContain("<b>Rakoto</b>");
  });
});
