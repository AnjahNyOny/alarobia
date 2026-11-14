/** Les six provinces de Madagascar, dans l'ordre alphabétique. Noms propres : identiques dans les trois langues. */
export const PROVINCES = ["Antananarivo", "Antsiranana", "Fianarantsoa", "Mahajanga", "Toamasina", "Toliara"] as const;
export type Province = (typeof PROVINCES)[number];

/**
 * Numéro malgache → forme nationale « 034 12 345 67 », ou null s'il n'est pas reconnu.
 * Accepte l'indicatif +261, le 0 initial ou son absence, et les séparateurs courants.
 * Mobiles : 03x. Fixe : 020.
 */
export function normalizePhone(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!/^[+\d][\d\s().-]*$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("261")) digits = digits.slice(3);
  if (digits.length === 10 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^(3[2-478]|20)\d{7}$/.test(digits)) return null;
  return `0${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

export type AddressParts = {
  fullName: string;
  line1: string;
  /** Repère pour le livreur (« en face de l'épicerie »). */
  line2?: string | null;
  district: string;
  postalCode: string;
  city: string;
  province: string;
  phone?: string | null;
};

/** Lignes d'une adresse dans l'ordre où on la lit à Madagascar ; aucune ligne vide. */
export function addressLines(a: AddressParts): string[] {
  const city = [a.postalCode, a.city].filter((part) => part?.trim()).join(" ");
  const cityLine = a.province && a.province !== a.city ? `${city}, ${a.province}` : city;
  return [a.fullName, a.line1, a.district, a.line2, cityLine, a.phone].filter((line): line is string => !!line?.trim());
}
