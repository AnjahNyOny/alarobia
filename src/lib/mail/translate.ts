import { createTranslator } from "next-intl";
import { mergeMessages, type Messages } from "@/i18n/messages";
import type { Locale } from "@/i18n/routing";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import mg from "../../../messages/mg.json";

/**
 * Traduction des e-mails, hors de toute requête : un e-mail part après la réponse (`after()`), dans la langue de la
 * commande et non dans celle de la page qui l'a déclenché (le vendeur confirme en français un paiement d'une commande
 * passée en malgache). Même socle et même moteur ICU que le site (src/i18n/request.ts) : le français sert de repli.
 * Les trois fichiers sont lus ici, côté serveur seulement : seuls les modules d'envoi l'importent.
 */
export type MailT = (key: string, values?: Record<string, string | number>) => string;

const MESSAGES: Record<Locale, Messages> = { fr, en: mergeMessages(fr, en), mg: mergeMessages(fr, mg) };

export function translateMail(locale: Locale): MailT {
  const t = createTranslator({ locale, messages: MESSAGES[locale] }) as unknown as MailT;
  return (key, values) => t(key, values);
}
