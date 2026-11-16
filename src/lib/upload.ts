/**
 * Contrôle des fichiers envoyés par les visiteurs (personnalisation) et, plus bas, par le vendeur
 * (photos de produits, `checkAdminUpload`). Le point d'envoi des visiteurs est public :
 * rien de ce que dit le navigateur n'est cru. Le type est lu dans le contenu, jamais dans le nom
 * ni dans l'en-tête Content-Type, et le nom du fichier enregistré est généré ici.
 *
 * Module sans dépendance au serveur : le navigateur s'en sert aussi pour réduire l'image et
 * expliquer un refus avant d'envoyer quoi que ce soit.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Côté maximal, en pixels. Le navigateur réduit déjà les photos à 2048 px ; au-delà de 4096, c'est une erreur ou une attaque. */
export const MAX_SIDE = 4096;
/** Grand côté d'une image après réduction dans le navigateur : assez pour imprimer, léger à envoyer en données mobiles. */
export const RESIZE_SIDE = 2048;

export type ImageType = "jpg" | "png" | "webp";
export type UploadError = "missing" | "tooLarge" | "heic" | "type" | "dimensions" | "rate";
type Sniffed = { type: ImageType; width: number; height: number } | { error: "heic" | "type" };

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const be32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const le24 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

const UNKNOWN = { error: "type" } as const;
// Marques « ftyp » des photos HEIC/HEIF, le format par défaut des iPhone.
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

function jpegSize(b: Uint8Array): Sniffed {
  // Suite de segments « FF marqueur longueur… » ; les dimensions sont dans le segment SOF (C0 à CF, sauf C4, C8 et CC).
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return UNKNOWN;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++; // octet de remplissage
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { type: "jpg", height: be16(b, i + 5), width: be16(b, i + 7) };
    if (marker === 0xd9 || marker === 0xda) return UNKNOWN; // fin de l'image ou début des données sans avoir vu les dimensions
    i += 2 + be16(b, i + 2);
  }
  return UNKNOWN;
}

function webpSize(b: Uint8Array): Sniffed {
  // Chaque variante range ses dimensions ailleurs : 30 octets suffisent pour « VP8 » et « VP8X », 25 pour « VP8L ».
  if (b.length < 25) return UNKNOWN;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8L" && b[20] === 0x2f) {
    const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
    return { type: "webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (b.length < 30) return UNKNOWN;
  if (chunk === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { type: "webp", width: le16(b, 26) & 0x3fff, height: le16(b, 28) & 0x3fff };
  if (chunk === "VP8X") return { type: "webp", width: le24(b, 24) + 1, height: le24(b, 27) + 1 };
  return UNKNOWN;
}

/** Format d'après la signature seule (les douze premiers octets suffisent). `null` : ni JPEG, ni PNG, ni WebP, ni HEIC. */
export function sniffType(b: Uint8Array): ImageType | "heic" | null {
  if (b.length >= 8 && be32(b, 0) === 0x89504e47 && be32(b, 4) === 0x0d0a1a0a) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  if (b.length >= 12 && ascii(b, 4, 4) === "ftyp" && HEIC_BRANDS.has(ascii(b, 8, 4))) return "heic";
  return null;
}

/** Type et dimensions lus dans le contenu du fichier. Tout ce qui n'est pas un JPEG, un PNG ou un WebP lisible est refusé. */
export function sniffImage(b: Uint8Array): Sniffed {
  switch (sniffType(b)) {
    case "png":
      return b.length >= 24 && ascii(b, 12, 4) === "IHDR" ? { type: "png", width: be32(b, 16), height: be32(b, 20) } : UNKNOWN;
    case "jpg":
      return jpegSize(b);
    case "webp":
      return webpSize(b);
    case "heic":
      return { error: "heic" };
    default:
      return UNKNOWN;
  }
}

/** Décision complète sur un fichier reçu : poids, type réel, dimensions. */
export function checkUpload(bytes: Uint8Array): { ok: true; ext: ImageType; width: number; height: number } | { ok: false; error: UploadError } {
  if (bytes.length === 0) return { ok: false, error: "missing" };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: "tooLarge" };
  const sniffed = sniffImage(bytes);
  if ("error" in sniffed) return { ok: false, error: sniffed.error };
  const { type, width, height } = sniffed;
  if (width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) return { ok: false, error: "dimensions" };
  return { ok: true, ext: type, width, height };
}

/** Codes d'erreur de l'envoi du vendeur, traduits dans `admin.photos.errors`. */
export type AdminUploadError = "missing" | "tooLarge" | "type";
// Marques « ftyp » de l'AVIF : image fixe, ou suite d'images.
const AVIF_BRANDS = new Set(["avif", "avis"]);

/**
 * Photo de produit envoyée depuis le back-office. Même contrôle sur le contenu que pour les visiteurs, avec deux
 * différences : l'AVIF est accepté (réservé au vendeur, le public ne l'a pas), et la taille en pixels n'est pas
 * plafonnée (une photo d'appareil dépasse souvent 4096 px ; le poids reste limité à 5 Mo).
 */
export function checkAdminUpload(bytes: Uint8Array): { ok: true; ext: ImageType | "avif" } | { ok: false; error: AdminUploadError } {
  if (bytes.length === 0) return { ok: false, error: "missing" };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: "tooLarge" };
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp" && AVIF_BRANDS.has(ascii(bytes, 8, 4))) return { ok: true, ext: "avif" };
  const sniffed = sniffImage(bytes);
  if ("error" in sniffed || sniffed.width < 1 || sniffed.height < 1) return { ok: false, error: "type" };
  return { ok: true, ext: sniffed.type };
}

/** Dimensions d'une image ramenée à `max` pixels de grand côté. Ne l'agrandit jamais, ne la déforme pas. */
export function scaleToFit(width: number, height: number, max = RESIZE_SIDE) {
  const factor = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * factor)), height: Math.max(1, Math.round(height * factor)) };
}

/** Nom d'enregistrement : rien de ce que fournit le client n'atteint le système de fichiers. */
export function customFileName(ext: ImageType) {
  return `perso-${crypto.randomUUID()}.${ext}`;
}
