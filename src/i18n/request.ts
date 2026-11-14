import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale } from "./routing";
import { mergeMessages, type Messages } from "./messages";
import fr from "../../messages/fr.json";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : defaultLocale;
  // Le français sert de socle : une clé absente d'une autre langue s'affiche en français, jamais sous forme de clé.
  const messages: Messages = locale === "fr" ? fr : mergeMessages(fr, (await import(`../../messages/${locale}.json`)).default);
  return { locale, messages, timeZone: "Indian/Antananarivo" };
});
