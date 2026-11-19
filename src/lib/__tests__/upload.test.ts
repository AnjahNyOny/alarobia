import { describe, expect, it } from "vitest";
import { CUSTOM_FILE } from "../customization";
import { checkAdminUpload, checkUpload, customFileName, MAX_UPLOAD_BYTES, scaleToFit, sniffImage, sniffType } from "../upload";

const bytes = (...parts: (number[] | string)[]) => Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p)));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number) => [(n >>> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >>> 8) & 255];
const le24 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];
const le32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

// En-têtes minimaux : assez pour reconnaître le type et lire les dimensions, comme le fait le serveur.
const png = (width: number, height: number) => bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a], be32(13), "IHDR", be32(width), be32(height), [8, 6, 0, 0, 0]);
const jpeg = (width: number, height: number, sof = 0xc0) =>
  bytes([0xff, 0xd8], [0xff, 0xe0], be16(16), "JFIF", [0, 1, 1, 0, 0, 1, 0, 1, 0, 0], [0xff, 0xdb], be16(4), [0, 0], [0xff, sof], be16(17), [8], be16(height), be16(width), [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const webpLossy = (width: number, height: number) => bytes("RIFF", le32(100), "WEBP", "VP8 ", le32(50), [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a], le16(width), le16(height));
const webpLossless = (width: number, height: number) => bytes("RIFF", le32(100), "WEBP", "VP8L", le32(50), [0x2f], le32(((height - 1) << 14) | (width - 1)));
const webpExtended = (width: number, height: number) => bytes("RIFF", le32(100), "WEBP", "VP8X", le32(10), [0x10, 0, 0, 0], le24(width - 1), le24(height - 1));
const heic = bytes(be32(24), "ftyp", "heic", be32(0), "mif1heic");
const avif = (brand = "avif") => bytes(be32(28), "ftyp", brand, be32(0), "mif1miafMA1B", be32(0));
const svg = bytes('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe("sniffImage : type lu dans le contenu", () => {
  it("reconnaît un PNG et ses dimensions", () => {
    expect(sniffImage(png(640, 480))).toEqual({ type: "png", width: 640, height: 480 });
  });
  it("reconnaît un JPEG, y compris progressif, et ses dimensions", () => {
    expect(sniffImage(jpeg(1200, 900))).toEqual({ type: "jpg", width: 1200, height: 900 });
    expect(sniffImage(jpeg(800, 600, 0xc2))).toEqual({ type: "jpg", width: 800, height: 600 });
  });
  it("reconnaît les trois variantes de WebP", () => {
    expect(sniffImage(webpLossy(320, 200))).toEqual({ type: "webp", width: 320, height: 200 });
    expect(sniffImage(webpLossless(321, 201))).toEqual({ type: "webp", width: 321, height: 201 });
    expect(sniffImage(webpExtended(2048, 1536))).toEqual({ type: "webp", width: 2048, height: 1536 });
  });
  it("signale à part une photo HEIC d'iPhone", () => {
    expect(sniffImage(heic)).toEqual({ error: "heic" });
  });
  it("refuse un SVG, même présenté comme une image", () => {
    expect(sniffImage(svg)).toEqual({ error: "type" });
    expect(sniffImage(bytes("<svg onload=alert(1)>"))).toEqual({ error: "type" });
  });
  it("refuse un fichier d'un autre type renommé en .jpg", () => {
    expect(sniffImage(bytes("%PDF-1.7 ceci n'est pas une photo"))).toEqual({ error: "type" });
    expect(sniffImage(bytes("GIF89a", [1, 0, 1, 0]))).toEqual({ error: "type" });
    expect(sniffImage(bytes("MZ", [0x90, 0, 3, 0]))).toEqual({ error: "type" });
  });
  it("refuse une image tronquée dont on ne peut pas lire les dimensions", () => {
    expect(sniffImage(bytes([0xff, 0xd8, 0xff, 0xe0], be16(16), "JFIF"))).toEqual({ error: "type" });
    expect(sniffImage(png(10, 10).slice(0, 20))).toEqual({ error: "type" });
    expect(sniffImage(bytes("RIFF", le32(100), "WEBP"))).toEqual({ error: "type" });
    expect(sniffImage(new Uint8Array())).toEqual({ error: "type" });
  });
});

describe("sniffType : premier tri, sur les tout premiers octets", () => {
  // Le navigateur ne lit que le début du fichier pour expliquer un refus sans rien envoyer.
  const head = (b: Uint8Array) => b.slice(0, 16);
  it("reconnaît les trois formats acceptés à leur signature", () => {
    expect(sniffType(head(png(640, 480)))).toBe("png");
    expect(sniffType(head(jpeg(1200, 900)))).toBe("jpg");
    expect(sniffType(head(webpExtended(2048, 1536)))).toBe("webp");
  });
  it("reconnaît une photo HEIC", () => {
    expect(sniffType(head(heic))).toBe("heic");
  });
  it("ne reconnaît rien d'autre", () => {
    expect(sniffType(head(svg))).toBeNull();
    expect(sniffType(bytes("GIF89a", [1, 0, 1, 0]))).toBeNull();
    expect(sniffType(new Uint8Array())).toBeNull();
  });
});

describe("checkUpload", () => {
  it("accepte une image valide et donne son extension d'après le contenu", () => {
    expect(checkUpload(jpeg(2048, 1536))).toEqual({ ok: true, ext: "jpg", width: 2048, height: 1536 });
  });
  it("refuse un fichier vide", () => {
    expect(checkUpload(new Uint8Array())).toEqual({ ok: false, error: "missing" });
  });
  it("refuse une photo de 12 Mo avant même de la lire", () => {
    const heavy = new Uint8Array(12 * 1024 * 1024);
    heavy.set(jpeg(4000, 3000));
    expect(checkUpload(heavy)).toEqual({ ok: false, error: "tooLarge" });
  });
  it("refuse une image de plus de 4 Mo : au-delà, la fonction Netlify refuserait la requête encodée en Base64", () => {
    const heavy = new Uint8Array(4 * 1024 * 1024 + 1);
    heavy.set(png(2048, 1536));
    expect(checkUpload(heavy)).toEqual({ ok: false, error: "tooLarge" });
    expect(checkAdminUpload(heavy)).toEqual({ ok: false, error: "tooLarge" });
  });
  it("accepte une image juste à la limite de poids", () => {
    const limit = new Uint8Array(MAX_UPLOAD_BYTES);
    limit.set(png(100, 100));
    expect(checkUpload(limit).ok).toBe(true);
  });
  it("refuse une image aux dimensions démesurées ou nulles", () => {
    expect(checkUpload(png(20000, 100))).toEqual({ ok: false, error: "dimensions" });
    expect(checkUpload(png(100, 5000))).toEqual({ ok: false, error: "dimensions" });
    expect(checkUpload(png(0, 100))).toEqual({ ok: false, error: "dimensions" });
  });
  it("transmet le motif du contenu : HEIC, ou type non accepté", () => {
    expect(checkUpload(heic)).toEqual({ ok: false, error: "heic" });
    expect(checkUpload(svg)).toEqual({ ok: false, error: "type" });
  });
});

describe("checkUpload : l'AVIF reste refusé au public", () => {
  it("refuse une image AVIF envoyée par un visiteur", () => {
    expect(checkUpload(avif())).toEqual({ ok: false, error: "type" });
  });
});

describe("checkAdminUpload : photos de produits envoyées par le vendeur", () => {
  it("accepte JPEG, PNG et WebP d'après leur contenu", () => {
    expect(checkAdminUpload(jpeg(1200, 900))).toEqual({ ok: true, ext: "jpg" });
    expect(checkAdminUpload(png(640, 480))).toEqual({ ok: true, ext: "png" });
    expect(checkAdminUpload(webpLossy(320, 200))).toEqual({ ok: true, ext: "webp" });
  });
  it("accepte l'AVIF, image fixe ou animée", () => {
    expect(checkAdminUpload(avif("avif"))).toEqual({ ok: true, ext: "avif" });
    expect(checkAdminUpload(avif("avis"))).toEqual({ ok: true, ext: "avif" });
  });
  it("garde les grandes photos d'appareil : pas de plafond de 4096 px pour le vendeur", () => {
    expect(checkAdminUpload(jpeg(6000, 4000))).toEqual({ ok: true, ext: "jpg" });
  });
  it("refuse un fichier texte renommé en .jpg, quel que soit le type annoncé", () => {
    expect(checkAdminUpload(bytes("Ceci n'est pas une photo."))).toEqual({ ok: false, error: "type" });
    expect(checkAdminUpload(svg)).toEqual({ ok: false, error: "type" });
  });
  it("ramène les autres refus aux codes que traduit le back-office", () => {
    // `admin.photos.errors` ne connaît que missing, type et tooLarge (plus forbidden, décidé par la route).
    expect(checkAdminUpload(heic)).toEqual({ ok: false, error: "type" });
    expect(checkAdminUpload(png(0, 100))).toEqual({ ok: false, error: "type" });
    expect(checkAdminUpload(bytes(be32(28), "ftyp", "isom"))).toEqual({ ok: false, error: "type" });
    expect(checkAdminUpload(new Uint8Array())).toEqual({ ok: false, error: "missing" });
    const heavy = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    heavy.set(jpeg(4000, 3000));
    expect(checkAdminUpload(heavy)).toEqual({ ok: false, error: "tooLarge" });
  });
});

describe("scaleToFit : réduction dans le navigateur avant l'envoi", () => {
  it("ramène une photo de téléphone à 2048 px de grand côté, sans la déformer", () => {
    expect(scaleToFit(4000, 3000)).toEqual({ width: 2048, height: 1536 });
    expect(scaleToFit(3000, 4000)).toEqual({ width: 1536, height: 2048 });
  });
  it("n'agrandit jamais une image déjà assez petite", () => {
    expect(scaleToFit(800, 600)).toEqual({ width: 800, height: 600 });
    expect(scaleToFit(2048, 2048)).toEqual({ width: 2048, height: 2048 });
  });
  it("garde au moins un pixel sur le petit côté d'une image très allongée", () => {
    expect(scaleToFit(20000, 5)).toEqual({ width: 2048, height: 1 });
  });
});

describe("customFileName", () => {
  it("génère un nom que le reste du code reconnaît comme fichier de personnalisation", () => {
    const name = customFileName("webp");
    expect(name).toMatch(CUSTOM_FILE);
    expect(name.endsWith(".webp")).toBe(true);
  });
  it("ne donne jamais deux fois le même nom", () => {
    expect(customFileName("jpg")).not.toBe(customFileName("jpg"));
  });
});
