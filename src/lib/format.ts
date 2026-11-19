import { madagascarTime } from "./shipping";

export type FormatLocale = "fr" | "en" | "mg";

const NBSP = "\u00a0";
const intlLocale = (locale: string) => (locale === "en" ? "en-GB" : "fr-FR");

/**
 * Montant en unités mineures → texte. L'ariary s'écrit sans décimales avec « Ar »
 * (« 25 000 Ar ») : Intl afficherait « MGA », que personne n'utilise à Madagascar.
 */
export function formatPrice(cents: number, currency = "MGA", locale: string = "fr") {
  if (currency === "MGA") {
    const amount = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(Math.round(cents / 100));
    return locale === "en" ? `Ar${NBSP}${amount}` : `${amount}${NBSP}Ar`;
  }
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

// Le malgache est écrit à la main : tous les navigateurs ne le connaissent pas, et un rendu
// différent entre serveur et navigateur casserait l'hydratation.
const MG_WEEKDAYS = ["Alahady", "Alatsinainy", "Talata", "Alarobia", "Alakamisy", "Zoma", "Sabotsy"];
const MG_MONTHS = ["Janoary", "Febroary", "Martsa", "Aprily", "Mey", "Jona", "Jolay", "Aogositra", "Septambra", "Oktobra", "Novambra", "Desambra"];

export type DateStyle = "long" | "medium" | "short" | "weekday";

const STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { day: "numeric", month: "long", year: "numeric" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  short: { day: "numeric", month: "short" },
  weekday: { weekday: "long", day: "numeric", month: "long" },
};

/** Jour de la semaine d'une date du calendrier malgache (voir `formatDate`). */
export function weekdayName(date: Date, locale: string = "fr") {
  if (locale === "mg") return MG_WEEKDAYS[date.getDay()];
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long" }).format(date);
}

/*
 * Deux sortes de dates :
 * - les dates du calendrier malgache, dont les champs locaux (`getDate()`, `getHours()`…) valent déjà l'heure de Madagascar :
 *   « aujourd'hui » tiré de `madagascarTime()`, dates de livraison promises (`estimateDelivery(madagascarTime(), zone)`,
 *   `Order.estimatedDelivery`), jours de la frise. `formatDate` les écrit telles quelles ;
 * - les instants (`createdAt`, `paidAt`, `paymentDeclaredAt`), à écrire à l'heure de Madagascar quel que soit le fuseau du
 *   serveur (UTC en production) : `formatMoment` et `formatDateTime`. Passer un instant à `formatDate` donnerait le jour du serveur.
 */

/** Date du calendrier malgache → texte. Pour un instant, `formatMoment`. */
export function formatDate(date: Date, locale: string = "fr", style: DateStyle = "long") {
  if (locale === "mg") {
    const month = MG_MONTHS[date.getMonth()];
    const day = date.getDate();
    if (style === "weekday") return `${MG_WEEKDAYS[date.getDay()]} ${day} ${month}`;
    if (style === "short") return `${day} ${month.slice(0, 3)}`;
    return `${day} ${style === "medium" ? month.slice(0, 3) : month} ${date.getFullYear()}`;
  }
  // en-US pour l'ordre « November 18, 2026 », attendu par les lecteurs anglophones.
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", STYLES[style]).format(date);
}

/** Instant → sa date à Madagascar (« 17 novembre 2026 »). */
export function formatMoment(instant: Date, locale: string = "fr", style: DateStyle = "long") {
  return formatDate(madagascarTime(instant), locale, style);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Instant → sa date et son heure à Madagascar (« 17 nov. 2026, 23:30 »). */
export function formatDateTime(instant: Date, locale: string = "fr") {
  const wall = madagascarTime(instant);
  return `${formatDate(wall, locale, "medium")}, ${pad(wall.getHours())}:${pad(wall.getMinutes())}`;
}

/** Clé « AAAA-MM-JJ » d'une date du calendrier malgache, pour regrouper par jour. */
export function calendarDayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Clé « AAAA-MM-JJ » du jour à Madagascar où tombe un instant : une commande de 23 h 30 à Antananarivo compte pour ce jour-là. */
export function madagascarDayKey(instant: Date) {
  return calendarDayKey(madagascarTime(instant));
}

/** Devise telle qu'on l'écrit dans un libellé de champ : « Prix de vente (Ar) ». */
export function currencyLabel(currency: string) {
  return currency === "MGA" ? "Ar" : currency;
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "12,50" ou "12.5" → 1250. Renvoie NaN si la saisie est invalide. */
export function parseAmountToCents(input: string) {
  const n = Number(String(input).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function centsToInput(cents: number | null | undefined) {
  if (cents == null) return "";
  // Montant rond : pas de « ,00 », qui n'a aucun sens pour un prix en ariary.
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",");
}
