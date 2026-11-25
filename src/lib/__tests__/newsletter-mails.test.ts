import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/routing";
import { SHOP_NAME } from "../mail/layout";
import { confirmationMail, newsletterIssueMail } from "../mail/newsletter-mails";
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

/*
 * La lettre elle-même (PLAN.md 7.14) : titre et texte écrits par le vendeur, dans une seule langue ; pied et lien de
 * désinscription dans la langue de l'inscrit ; en-têtes de désinscription en un clic (RFC 8058).
 */
describe("newsletterIssueMail", () => {
  const letter = { subject: "Nouveautés de novembre", body: "Bonjour,\n\nDes paniers sont arrivés.\nEn raphia.\n\n\n  Bonne semaine.  " };
  const subscriber = (locale: string) => ({ email: "rakoto@exemple.mg", token: TOKEN, locale });

  it("objet en sujet et en titre, texte découpé en paragraphes sur les lignes vides", () => {
    const mail = newsletterIssueMail(letter, subscriber("fr"), ctx);
    expect(mail.to).toBe("rakoto@exemple.mg");
    expect(mail.subject).toBe("Nouveautés de novembre");
    expect(mail.html).toContain(">Nouveautés de novembre</h1>");
    expect(mail.html.match(/<p style=/g)).toHaveLength(3);
    expect(mail.html).toContain("Des paniers sont arrivés.<br>En raphia.");
    expect(mail.text).toContain("Bonjour,\n\nDes paniers sont arrivés.\nEn raphia.\n\nBonne semaine.\n");
  });

  for (const locale of LOCALES) {
    it(`en ${locale} : pied et lien « se désinscrire » dans la langue de l'inscrit`, () => {
      const t = translateMail(locale);
      const mail = newsletterIssueMail(letter, subscriber(locale), ctx);
      const url = `${BASE}/${locale}/newsletter/unsubscribe/${TOKEN}`;
      expect(mail.html).toMatch(new RegExp(`<html lang="${locale}"`));
      expect(mail.html).toContain(`href="${url}"`);
      expect(mail.html).toContain(`>${t("mail.letter.unsubscribe")}</a>`);
      expect(mail.text).toContain(t("mail.letter.footer", { shop: SHOP_NAME }));
      expect(mail.text).toContain(url);
      expect(mail.text).not.toMatch(/mail\.letter\./);
    });
  }

  it("les trois langues ont leur propre pied", () => {
    const footers = LOCALES.map((locale) => translateMail(locale)("mail.letter.footer", { shop: SHOP_NAME }));
    expect(new Set(footers).size).toBe(3);
    expect(new Set(LOCALES.map((locale) => translateMail(locale)("mail.letter.unsubscribe"))).size).toBe(3);
  });

  it("en-têtes de désinscription en un clic, avec le jeton de l'inscrit", () => {
    const mail = newsletterIssueMail(letter, subscriber("mg"), ctx);
    expect(mail.headers).toEqual({ "List-Unsubscribe": `<${BASE}/api/newsletter/unsubscribe?token=${TOKEN}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
  });

  it("objet et texte piégés : échappés dans le HTML, intacts dans le texte", () => {
    const trap = { subject: `Promo "<script>alert(1)</script>"`, body: `<img src=x onerror="alert(1)"> & <script>vol()</script>` };
    const mail = newsletterIssueMail(trap, subscriber("fr"), ctx);
    expect(mail.html).not.toMatch(/<script|<img/);
    expect(mail.html).toContain("Promo &quot;&lt;script&gt;alert(1)&lt;/script&gt;&quot;");
    expect(mail.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &lt;script&gt;vol()&lt;/script&gt;");
    expect(mail.subject).toBe(trap.subject);
    expect(mail.text).toContain(trap.body);
  });

  it("les adresses http(s) écrites dans le texte deviennent des liens, la ponctuation finale reste dehors", () => {
    const body = "Voir https://alarobia.mg/fr/products?category=cuisine&tri=prix. Ou (http://exemple.mg/a), et https://fr.wikipedia.org/wiki/Raphia_(fibre) ! Fin : https://x.mg/b?;";
    const mail = newsletterIssueMail({ subject: "Liens", body }, subscriber("fr"), ctx);
    const links = [...mail.html.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]);
    expect(links.slice(0, 4)).toEqual([
      ["https://alarobia.mg/fr/products?category=cuisine&amp;tri=prix", "https://alarobia.mg/fr/products?category=cuisine&amp;tri=prix"],
      ["http://exemple.mg/a", "http://exemple.mg/a"],
      ["https://fr.wikipedia.org/wiki/Raphia_(fibre)", "https://fr.wikipedia.org/wiki/Raphia_(fibre)"],
      ["https://x.mg/b", "https://x.mg/b"],
    ]);
    expect(mail.html).toContain("tri=prix</a>. Ou (<a ");
    expect(mail.html).toContain("exemple.mg/a</a>), et");
    expect(mail.html).toContain("x.mg/b</a>?;");
    // Version texte : les adresses telles qu'écrites.
    expect(mail.text).toContain(body);
  });

  it("javascript:, data: ou une adresse sans protocole ne deviennent jamais des liens", () => {
    const body = `javascript:alert(document.cookie) data:text/html,<b>x</b> www.exemple.mg ftp://exemple.mg "https://x.mg/" onclick="y`;
    const mail = newsletterIssueMail({ subject: "Pièges", body }, subscriber("fr"), ctx);
    const hrefs = [...mail.html.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1]);
    // Seuls le lien de la lettre et celui du pied.
    expect(hrefs).toEqual(["https://x.mg/", `${BASE}/fr/newsletter/unsubscribe/${TOKEN}`]);
    expect(mail.html).toContain("javascript:alert(document.cookie)");
    expect(mail.html).not.toContain('onclick="');
  });
});
