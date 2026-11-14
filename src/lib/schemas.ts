import { z } from "zod";
import { COUNTRIES } from "./constants";

/** Traducteur de l'espace de noms "errors" (getTranslations côté serveur). */
export type ErrorT = (key: string, values?: Record<string, string | number>) => string;

/** Schémas de validation dont les messages sont dans la langue du visiteur. */
export function makeSchemas(t: ErrorT) {
  const required = (max = 120) => z.string().trim().min(1, t("required")).max(max);
  const email = z.string().trim().toLowerCase().pipe(z.email(t("emailInvalid")));
  const password = z.string().min(8, t("passwordMin")).max(100);
  const name = z.string().trim().min(2, t("nameRequired")).max(80);
  const address = z.object({
    fullName: required(),
    line1: required(200),
    line2: z.string().trim().max(200).optional(),
    postalCode: required(12),
    city: required(),
    country: z.enum(COUNTRIES as [string, ...string[]], t("countryUnsupported")),
    phone: z.string().trim().regex(/^[+\d][\d\s.-]{7,18}$/, t("phoneInvalid")),
  });
  return { required, email, password, name, address };
}

/** Version française, pour le back-office tant qu'il n'est pas traduit (phase 5). */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide."));
