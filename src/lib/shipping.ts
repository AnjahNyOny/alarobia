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

/**
 * L'instant donné, exprimé à l'heure de Madagascar (UTC+3, sans heure d'été) dans les champs locaux de la date.
 * À utiliser pour « aujourd'hui » : le serveur peut tourner dans un autre fuseau que ses clients.
 */
export function madagascarTime(instant: Date = new Date()): Date {
  const shifted = new Date(instant.getTime() + 3 * 3600_000);
  return new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), shifted.getUTCHours(), shifted.getUTCMinutes(), shifted.getUTCSeconds());
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
