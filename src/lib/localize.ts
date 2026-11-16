import { locales, type Locale } from "@/i18n/routing";

type Translation = { locale: string } & Record<string, unknown>;

/**
 * Applique la traduction d'une langue sur un enregistrement dont les champs de base sont en français.
 * Un champ non traduit (absent, vide ou fait d'espaces) reste en français : jamais de trou à l'écran.
 */
export function localize<T extends { translations?: Translation[] }, K extends keyof T & string>(record: T, locale: string, fields: readonly K[]): T {
  if (locale === "fr") return record;
  const translation = record.translations?.find((t) => t.locale === locale);
  if (!translation) return record;
  const out = { ...record };
  for (const field of fields) {
    const value = translation[field];
    if (typeof value === "string" && value.trim() !== "") out[field] = value as T[K];
  }
  return out;
}

/** Langues (hors français) pour lesquelles au moins un des champs demandés n'est pas traduit. */
export function missingLocales(record: { translations?: Translation[] }, required: readonly string[]): Locale[] {
  return locales.filter((locale) => {
    if (locale === "fr") return false;
    const translation = record.translations?.find((t) => t.locale === locale);
    return required.some((field) => typeof translation?.[field] !== "string" || (translation[field] as string).trim() === "");
  });
}

const filled = (value: unknown) => typeof value === "string" && value.trim() !== "";

/**
 * Champs à traduire : remplis en français, vides (absents ou faits d'espaces) dans la traduction.
 * Un champ vide en français n'est jamais réclamé. Sert au compteur des onglets de langue du back-office.
 */
export function untranslatedFields<K extends string>(base: Partial<Record<K, unknown>>, translation: Partial<Record<K, unknown>> | undefined, fields: readonly K[]): K[] {
  return fields.filter((field) => filled(base[field]) && !filled(translation?.[field]));
}

export const PRODUCT_FIELDS = ["name", "tagline", "description", "details"] as const;
export const CATEGORY_FIELDS = ["name", "description"] as const;
