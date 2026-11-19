const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export type DeliveryDelay = { minDays: number; maxDays: number };

function addBusinessDays(from: Date, businessDays: number): Date {
  const date = startOfDay(from);
  let remaining = businessDays;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) remaining--;
  }
  return date;
}

/** Première et dernière dates de livraison possibles pour une zone : jours ouvrés, sans livraison le dimanche. */
export function deliveryWindow(orderedAt: Date, zone: DeliveryDelay) {
  return { earliest: addBusinessDays(orderedAt, zone.minDays), latest: addBusinessDays(orderedAt, zone.maxDays) };
}

/** Date de livraison promise : la plus tardive du délai de la zone. C'est elle qu'affiche la frise de la semaine. */
export function estimateDelivery(orderedAt: Date, zone: DeliveryDelay): Date {
  return deliveryWindow(orderedAt, zone).latest;
}

const MADAGASCAR_OFFSET_MS = 3 * 3600_000; // UTC+3, sans heure d'été

/**
 * L'instant donné, exprimé à l'heure de Madagascar (UTC+3, sans heure d'été) dans les champs locaux de la date.
 * À utiliser pour « aujourd'hui » : le serveur peut tourner dans un autre fuseau que ses clients.
 * Le résultat est une date du calendrier malgache : la convertir une seconde fois serait faux.
 */
export function madagascarTime(instant: Date = new Date()): Date {
  const shifted = new Date(instant.getTime() + MADAGASCAR_OFFSET_MS);
  return new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), shifted.getUTCHours(), shifted.getUTCMinutes(), shifted.getUTCSeconds());
}

/**
 * L'inverse de `madagascarTime` : l'instant où il est, à Madagascar, l'heure que portent les champs locaux de `wall`.
 * Sert aux bornes des requêtes (minuit à Antananarivo d'un jour du calendrier). `madagascarInstant(madagascarTime(x))`
 * vaut `x` à la seconde près.
 */
export function madagascarInstant(wall: Date): Date {
  const asUtc = Date.UTC(wall.getFullYear(), wall.getMonth(), wall.getDate(), wall.getHours(), wall.getMinutes(), wall.getSeconds(), wall.getMilliseconds());
  return new Date(asUtc - MADAGASCAR_OFFSET_MS);
}

/**
 * Fin d'un jour du calendrier malgache saisi « AAAA-MM-JJ » (champ `type="date"`) : l'instant de 23:59:59 à Antananarivo.
 * Sert à la date de fin d'un code promo. Date invalide (NaN) si la saisie n'a pas ce format.
 */
export function endOfMadagascarDay(isoDate: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59) - MADAGASCAR_OFFSET_MS);
}

/** Nom d'une zone dans la langue du visiteur ; le français sert de repli. */
export function zoneName(zone: { name: string; nameEn: string; nameMg: string }, locale: string) {
  const translated = locale === "en" ? zone.nameEn : locale === "mg" ? zone.nameMg : "";
  return translated.trim() || zone.name;
}

/** Les sept jours à partir d'une date, pour la frise de la semaine. */
export function weekFrom(from: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + i));
}
