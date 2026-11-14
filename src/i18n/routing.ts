import { defineRouting } from "next-intl/routing";

export const locales = ["fr", "en", "mg"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

/** Nom de chaque langue, écrit dans cette langue. */
export const localeNames: Record<Locale, string> = { fr: "Français", en: "English", mg: "Malagasy" };

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Toujours /fr, /en ou /mg : une adresse désigne une seule langue, ce qui simplifie le référencement.
  localePrefix: "always",
});

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
