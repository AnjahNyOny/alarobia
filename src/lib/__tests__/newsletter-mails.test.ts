import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/routing";
import { SHOP_NAME } from "../mail/layout";
import { confirmationMail } from "../mail/newsletter-mails";
import { translateMail } from "../mail/translate";

/*
 * E-mail de confirmation de la lettre d'information (PLAN.md 7.13) : fonction pure, inscription → message, dans la langue
 * de l'inscription, avec un lien absolu vers la page de confirmation dans cette langue.
 */

const LOCALES: Locale[] = ["fr", "en", "mg"];
const BASE = "https://alarobia.example";
const TOKEN = "a1".repeat(32);
const ctx = { translate: translateMail, base: BASE };

describe("confirmationMail", () => {
  for (const locale of LOCALES) {
    it(`en ${locale} : destinataire, sujet, bouton vers /${locale}/newsletter/confirm/{jeton}`, () => {
      const t = translateMail(locale);
      const mail = confirmationMail({ email: "rakoto@exemple.mg", token: TOKEN, locale }, ctx);
      const url = `${BASE}/${locale}/newsletter/confirm/${TOKEN}`;
      expect(mail.to).toBe("rakoto@exemple.mg");
      expect(mail.subject).toBe(t("mail.newsletter.subject", { shop: SHOP_NAME }));
      expect(mail.html).toMatch(new RegExp(`<html lang="${locale}"`));
      expect(mail.html).toContain(`href="${url}"`);
      expect(mail.html).toContain(t("mail.newsletter.button"));
      expect(mail.text).toContain(url);
      expect(mail.text).toContain(t("mail.newsletter.ignore"));
      // Aucune clé laissée telle quelle (traduction manquante : next-intl rend le chemin de la clé).
      expect(`${mail.subject}\n${mail.text}`).not.toMatch(/mail\.newsletter\./);
    });
  }

  it("les trois langues ont leur propre texte (pas de repli sur le français)", () => {
    const subjects = LOCALES.map((locale) => confirmationMail({ email: "a@exemple.mg", token: TOKEN, locale }, ctx).subject);
    expect(new Set(subjects).size).toBe(3);
  });

  it("langue inconnue en base : français", () => {
    const mail = confirmationMail({ email: "a@exemple.mg", token: TOKEN, locale: "de" }, ctx);
    expect(mail.text).toContain(`${BASE}/fr/newsletter/confirm/${TOKEN}`);
  });

  it("adresse piégée : échappée dans le HTML, intacte dans le texte", () => {
    const email = `"<script>alert(1)</script>"@exemple.mg`;
    const mail = confirmationMail({ email, token: TOKEN, locale: "fr" }, ctx);
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.text).toContain(email);
  });

  it("n'annonce pas de lien de désinscription (rien à retirer tant que l'adresse n'est pas confirmée)", () => {
    const mail = confirmationMail({ email: "a@exemple.mg", token: TOKEN, locale: "fr" }, ctx);
    expect(mail.text).not.toContain("/newsletter/unsubscribe/");
    expect(mail.headers?.["List-Unsubscribe"]).toBeUndefined();
  });
});
