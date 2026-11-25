import { defaultLocale, isLocale, type Locale } from "@/i18n/routing";
import { renderMail, SHOP_NAME } from "./layout";
import type { MailMessage } from "./transport";
import type { MailT } from "./translate";

/**
 * E-mails de la lettre d'information (PLAN.md 7.13) : fonctions pures, comme order-mails.ts. L'envoi est dans notify.ts.
 * Textes dans l'espace `mail.newsletter` des fichiers de messages, dans la langue de l'inscription.
 */

export type NewsletterMailContext = {
  /** Traducteur d'une langue : `translateMail` (translate.ts). */
  translate: (locale: Locale) => MailT;
  /** Adresse publique du site, sans barre finale : `siteBase()`. */
  base: string;
};

/**
 * Demande de confirmation : le bouton mène à la page `/{langue}/newsletter/confirm/{jeton}`, qui ne confirme qu'au clic
 * sur son propre bouton (un antivirus qui ouvre le lien ne confirme rien). Pas de lien de désinscription : tant que
 * l'adresse n'est pas confirmée, elle ne reçoit rien d'autre que ce message.
 */
export function confirmationMail(subscriber: { email: string; token: string; locale: string }, ctx: NewsletterMailContext): MailMessage {
  const locale = isLocale(subscriber.locale) ? subscriber.locale : defaultLocale;
  const t = ctx.translate(locale);
  const shop = SHOP_NAME;
  return {
    to: subscriber.email,
    subject: t("mail.newsletter.subject", { shop }),
    ...renderMail(locale, {
      title: t("mail.newsletter.title"),
      paragraphs: [t("mail.newsletter.body", { email: subscriber.email, shop }), t("mail.newsletter.ignore")],
      button: { label: t("mail.newsletter.button"), url: `${ctx.base}/${locale}/newsletter/confirm/${subscriber.token}` },
      footer: t("mail.newsletter.footer", { shop }),
    }),
  };
}

/** Lettre telle que le vendeur l'a écrite : objet et texte, dans une seule langue. */
export type LetterContent = { subject: string; body: string };

/** Paragraphes du texte : séparés par une ligne vide (espaces compris) ; les retours simples restent dans le paragraphe. */
export function letterParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Une lettre d'information pour un inscrit confirmé (PLAN.md 7.14). L'objet et le texte sont ceux du vendeur ; le pied
 * (pourquoi on la reçoit, lien « Se désinscrire ») est dans la langue de l'inscription. Le lien du pied mène à la page
 * qui désinscrit au clic sur son bouton (un antivirus qui l'ouvre ne désinscrit personne) ; les en-têtes
 * `List-Unsubscribe` et `List-Unsubscribe-Post` donnent à la messagerie son bouton « Se désinscrire » en un clic
 * (RFC 8058, route POST /api/newsletter/unsubscribe).
 */
export function newsletterIssueMail(letter: LetterContent, subscriber: { email: string; token: string; locale: string }, ctx: NewsletterMailContext): MailMessage {
  const locale = isLocale(subscriber.locale) ? subscriber.locale : defaultLocale;
  const t = ctx.translate(locale);
  return {
    to: subscriber.email,
    subject: letter.subject,
    headers: {
      "List-Unsubscribe": `<${ctx.base}/api/newsletter/unsubscribe?token=${subscriber.token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    ...renderMail(locale, {
      title: letter.subject,
      paragraphs: letterParagraphs(letter.body),
      links: true,
      footer: t("mail.letter.footer", { shop: SHOP_NAME }),
      footerLink: { label: t("mail.letter.unsubscribe"), url: `${ctx.base}/${locale}/newsletter/unsubscribe/${subscriber.token}` },
    }),
  };
}

/**
 * Jeton des aperçus et des essais : bien formé mais attribué à personne (les jetons sont tirés au hasard). Le lien de
 * désinscription d'un essai mène à la page neutre, et ne retire aucune adresse.
 */
export const PREVIEW_TOKEN = "0".repeat(64);

/** La lettre telle qu'elle partira, adressée au vendeur, en français et sans jeton réel : aperçu du back-office et essai. */
export function letterPreview(letter: LetterContent, ctx: NewsletterMailContext & { vendor: string }): MailMessage {
  return newsletterIssueMail(letter, { email: ctx.vendor, token: PREVIEW_TOKEN, locale: defaultLocale }, ctx);
}
