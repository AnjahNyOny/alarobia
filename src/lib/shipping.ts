const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Date de livraison prévue : `businessDays` jours ouvrés après la commande, sans livraison le dimanche. */
export function estimateDelivery(orderedAt: Date, businessDays: number): Date {
  const date = startOfDay(orderedAt);
  let remaining = businessDays;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) remaining--;
  }
  return date;
}

/** Les sept jours à partir d'une date, pour la frise de la semaine. */
export function weekFrom(from: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + i));
}

/** Délais par défaut, en jours ouvrés. Les zones de livraison (phase 3.2) les remplaceront. */
export const DELIVERY_DAYS = { STANDARD: 3, EXPRESS: 1 } as const;
