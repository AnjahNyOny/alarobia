/**
 * Alphabet GSM 03.38, table de base (sans la table d'extension ni le caractère d'échappement) : un SMS écrit avec ces
 * seuls caractères tient 160 caractères. Un seul caractère hors de la table (â, ê, ç minuscule, apostrophe typographique,
 * espace insécable…) fait passer tout le message en UCS-2, et le SMS tombe à 70 caractères.
 */
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅå" +
  "Δ_ΦΓΛΩΠΨΣΘΞÆæßÉ" +
  " !\"#¤%&'()*+,-./" +
  "0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNO" +
  "PQRSTUVWXYZÄÖÑÜ§" +
  "¿abcdefghijklmno" +
  "pqrstuvwxyzäöñüà";

const ALPHABET = new Set(GSM_BASIC);

/** Caractères du texte absents de la table de base, pour un message d'échec lisible ; vide si le texte est GSM. */
export function nonGsm7(text: string): string[] {
  return [...new Set([...text].filter((char) => !ALPHABET.has(char)))];
}

export function isGsm7(text: string): boolean {
  return nonGsm7(text).length === 0;
}
