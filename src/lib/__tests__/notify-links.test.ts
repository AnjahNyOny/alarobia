import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/routing";
import { isGsm7, nonGsm7 } from "@/test/gsm";
import { MAX_ORDER_CENTS } from "../constants";
import { formatPrice } from "../format";
import { translateMail } from "../mail/translate";
import { customerMessage, internationalPhone, notifyLocale, smsLink, whatsappLink, type NotifyOrder } from "../notify-links";

/*
 * Prévenir le client par WhatsApp ou par SMS (PLAN.md 7.15) : le back-office ouvre l'application du téléphone du
 * vendeur avec un message déjà écrit. Le message doit tenir dans un SMS : 160 caractères hors lien, alphabet GSM seul
 * (un seul caractère hors de la table fait tomber le SMS à 70 caractères). On le vérifie avec les valeurs les plus
 * longues que le site produit : numéro de commande du format réel, montant plafond, numéro de suivi de 20 caractères,
 * nom d'opérateur le plus long.
 */

const LOCALES: Locale[] = ["fr", "en", "mg"];
const BASE = "https://alarobia.example";
const ctx = { translate: translateMail, base: BASE, currency: "MGA" };

/** Numéro réel : « AL- » + Date.now() en base 36 (8 caractères jusqu'en 2059) + 1 caractère ; un de plus par prudence. */
const LONG_NUMBER = "AL-MIEW3K2PZ7Q";
const LONG_TRACKING = "RR123456789MG1234567";

const order = (extra: Partial<NotifyOrder> = {}): NotifyOrder => ({
  id: "cmord123",
  number: LONG_NUMBER,
  locale: "fr",
  status: "PENDING",
  paymentMethod: "AIRTEL_MONEY",
  paymentReference: null,
  paidAt: null,
  totalCents: MAX_ORDER_CENTS,
  trackingNumber: null,
  ...extra,
});

/** Montant tel qu'il doit figurer dans le message : espaces ordinaires (Intl met des espaces insécables, hors GSM). */
const plainPrice = (cents: number, locale: Locale) => formatPrice(cents, "MGA", locale).replace(/[   ]/g, " ");

/** Toutes les situations qui ont leur message, avec leurs valeurs les plus longues. */
const CASES: [string, Partial<NotifyOrder>][] = [
  ["en attente, Mobile Money à payer", {}],
  ["en attente, référence déclarée", { paymentReference: "ABCDEF1234567890ABCD" }],
  ["en attente, paiement à la livraison", { paymentMethod: "COD" }],
  ["payée", { status: "PAID", paidAt: new Date() }],
  ["expédiée, payée, avec suivi", { status: "SHIPPED", paidAt: new Date(), trackingNumber: LONG_TRACKING }],
  ["expédiée, payée, sans suivi", { status: "SHIPPED", paidAt: new Date() }],
  ["expédiée, à payer au livreur, avec suivi", { status: "SHIPPED", paymentMethod: "COD", trackingNumber: LONG_TRACKING }],
  ["livrée", { status: "DELIVERED", paidAt: new Date(), trackingNumber: LONG_TRACKING }],
  ["annulée", { status: "CANCELLED" }],
  ["remboursée", { status: "REFUNDED", paidAt: new Date() }],
];

describe("isGsm7 (utilitaire de test)", () => {
  it("accepte les lettres accentuées de la table GSM et refuse les autres", () => {
    expect(isGsm7("Commande livrée, à bientôt")).toBe(false); // ô
    expect(isGsm7("Commande livrée à 9 h, où ? Très bien. Ça marche")).toBe(true);
    expect(nonGsm7("l’été « oui » 20 000 Ar ça")).toEqual(["’", "«", "»", " ", " ", "ç"]);
  });
});

describe("internationalPhone", () => {
  it("met un numéro malgache valide sous la forme internationale, sans +", () => {
    expect(internationalPhone("034 12 345 67")).toBe("261341234567");
    expect(internationalPhone("+261 34 12 345 67")).toBe("261341234567");
    expect(internationalPhone("0341234567")).toBe("261341234567");
    expect(internationalPhone("261341234567")).toBe("261341234567");
    expect(internationalPhone("020 22 123 45")).toBe("261202212345");
  });

  it("renvoie null pour un numéro qui n'est pas malgache ou une chaîne vide", () => {
    expect(internationalPhone("06 12 34 56 78")).toBeNull();
    expect(internationalPhone("034 12 345")).toBeNull();
    expect(internationalPhone("abc")).toBeNull();
    expect(internationalPhone("")).toBeNull();
  });
});

describe("whatsappLink et smsLink", () => {
  const text = "Alarobia : a b&c?d#e\nlivrée à Antsirabe = 100%";
  const encoded = "Alarobia%20%3A%20a%20b%26c%3Fd%23e%0Alivr%C3%A9e%20%C3%A0%20Antsirabe%20%3D%20100%25";

  it("ouvre WhatsApp sur le numéro international, texte encodé", () => {
    expect(whatsappLink("034 12 345 67", text)).toBe(`https://wa.me/261341234567?text=${encoded}`);
  });

  it("ouvre l'application SMS sous la forme comprise par Android et iPhone", () => {
    expect(smsLink("034 12 345 67", text)).toBe(`sms:+261341234567?&body=${encoded}`);
  });

  it("rend le texte intact une fois décodé", () => {
    expect(decodeURIComponent(whatsappLink("0341234567", text)!.split("?text=")[1])).toBe(text);
    expect(decodeURIComponent(smsLink("0341234567", text)!.split("?&body=")[1])).toBe(text);
  });

  it("ne fait aucun lien pour un numéro invalide", () => {
    expect(whatsappLink("12", text)).toBeNull();
    expect(smsLink("", text)).toBeNull();
  });
});

describe("customerMessage", () => {
  for (const locale of LOCALES) {
    for (const [name, extra] of CASES) {
      it(`${locale}, ${name} : tient dans un SMS (160 caractères GSM hors lien) et finit par le lien de la commande`, () => {
        const message = customerMessage(order({ locale, ...extra }), ctx);
        const link = `${BASE}/${locale}/order/cmord123`;
        expect(message).not.toBeNull();
        const lines = message!.split("\n");
        expect(lines.at(-1)).toBe(link);
        const text = message!.replace(link, "");
        expect(text.length, text).toBeLessThanOrEqual(160);
        expect(nonGsm7(message!), message!).toEqual([]);
        expect(message).toContain(LONG_NUMBER);
        expect(message).toMatch(/^Alarobia/);
        // Aucune variable oubliée ni clé non traduite.
        expect(message).not.toMatch(/[{}]|admin\.notify/);
      });
    }
  }

  it("rappelle le montant et l'opérateur d'un paiement Mobile Money attendu, avec des espaces ordinaires", () => {
    for (const locale of LOCALES) {
      const message = customerMessage(order({ locale }), ctx)!;
      expect(message).toContain(plainPrice(MAX_ORDER_CENTS, locale));
      expect(message).toContain("Airtel Money");
    }
  });

  it("ne demande plus de payer quand le client a déjà indiqué sa référence", () => {
    const awaiting = customerMessage(order(), ctx);
    const declared = customerMessage(order({ paymentReference: "ABCD1234" }), ctx);
    expect(declared).not.toBe(awaiting);
    expect(declared).not.toContain(plainPrice(MAX_ORDER_CENTS, "fr"));
  });

  it("annonce le montant à préparer en espèces pour un paiement à la livraison", () => {
    for (const locale of LOCALES) {
      expect(customerMessage(order({ locale, paymentMethod: "COD" }), ctx)).toContain(plainPrice(MAX_ORDER_CENTS, locale));
      expect(customerMessage(order({ locale, paymentMethod: "COD", status: "SHIPPED" }), ctx)).toContain(plainPrice(MAX_ORDER_CENTS, locale));
      expect(customerMessage(order({ locale, status: "SHIPPED", paidAt: new Date() }), ctx)).not.toContain(plainPrice(MAX_ORDER_CENTS, locale));
    }
  });

  it("donne le numéro de suivi seulement quand il existe", () => {
    for (const locale of LOCALES) {
      const tracked = customerMessage(order({ locale, status: "SHIPPED", paidAt: new Date(), trackingNumber: ` ${LONG_TRACKING} ` }), ctx)!;
      const untracked = customerMessage(order({ locale, status: "SHIPPED", paidAt: new Date(), trackingNumber: null }), ctx)!;
      const blank = customerMessage(order({ locale, status: "SHIPPED", paidAt: new Date(), trackingNumber: "  " }), ctx)!;
      expect(tracked).toContain(` ${LONG_TRACKING}.`);
      expect(untracked).not.toContain(LONG_TRACKING);
      expect(blank).toBe(untracked);
      // Pas de libellé « numéro de suivi » sans numéro.
      expect(untracked.length).toBeLessThan(tracked.length - LONG_TRACKING.length);
    }
  });

  it("écrit dans la langue de la commande, le français servant de repli", () => {
    const fr = customerMessage(order({ status: "DELIVERED" }), ctx)!;
    const en = customerMessage(order({ status: "DELIVERED", locale: "en" }), ctx)!;
    const mg = customerMessage(order({ status: "DELIVERED", locale: "mg" }), ctx)!;
    expect(new Set([fr, en, mg]).size).toBe(3);
    expect(en).toContain(`${BASE}/en/order/cmord123`);
    expect(mg).toContain(`${BASE}/mg/order/cmord123`);
    expect(customerMessage(order({ status: "DELIVERED", locale: "de" }), ctx)).toBe(fr);
    expect(notifyLocale(order({ locale: "mg" }))).toBe("mg");
    expect(notifyLocale(order({ locale: "de" }))).toBe("fr");
  });

  it("n'écrit rien pour un statut inconnu", () => {
    expect(customerMessage(order({ status: "LOST" }), ctx)).toBeNull();
  });
});
