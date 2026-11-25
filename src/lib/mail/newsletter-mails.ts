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
