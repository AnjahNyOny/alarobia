/**
 * Personnalisation d'un produit : ce que le vendeur autorise (gabarit, couleurs, texte, image, supplément)
 * et ce que le client a choisi (le « dessin »). Fonctions pures, partagées par le navigateur et le serveur :
 * le serveur revalide toujours un dessin avec `parseDesign` avant de l'enregistrer.
 */

import { MAX_ORDER_CENTS } from "./constants";
import { parseAmountToCents } from "./format";

export const TEMPLATES = ["mug", "gourde", "carnet", "tote"] as const;
export type Template = (typeof TEMPLATES)[number];

/**
 * Couleurs d'objet et d'encre. La clé est enregistrée en base ; le nom affiché vient des messages
 * (`customizer.colors.<clé>`), la teinte d'ici.
 */
export const COLORS = {
  blanc: "#f7f5f0",
  vanille: "#eadfc4",
  raphia: "#ebc45a",
  laterite: "#b4401f",
  lagon: "#2b8a96",
  foret: "#2f5d46",
  indigo: "#1f2547",
  charbon: "#26262b",
} as const;
export type ColorKey = keyof typeof COLORS;
export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[];
const isColor = (value: unknown): value is ColorKey => typeof value === "string" && Object.hasOwn(COLORS, value);

/** Polices proposées pour le texte ; les fichiers sont déclarés dans `src/components/customizer/fonts.ts`. */
export const FONTS = ["enseigne", "ronde", "classique", "manuscrite"] as const;
export type FontKey = (typeof FONTS)[number];

/** Plafond du texte, quel que soit le réglage du produit : au-delà, rien n'est lisible sur un objet. */
export const MAX_TEXT = 40;

/** Nom d'un fichier de personnalisation, toujours généré par le serveur (`src/lib/upload.ts`). */
export const CUSTOM_FILE = /^perso-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export type CustomizerOptions = {
  template: Template;
  colors: ColorKey[];
  /** 0 : pas de texte sur ce produit. */
  textMax: number;
  allowImage: boolean;
  /** Ajouté au prix dès qu'il y a quelque chose à imprimer (texte ou image). */
  surchargeCents: number;
};

type ProductCustomFields = { customTemplate: string; customColors: string; customTextMax: number; customImage: boolean; customSurchargeCents: number };

/** Réglages de personnalisation d'un produit, ou null s'il n'est pas personnalisable. */
export function customizerOptions(product: ProductCustomFields): CustomizerOptions | null {
  const template = TEMPLATES.find((t) => t === product.customTemplate);
  if (!template) return null;
  const colors = [...new Set(product.customColors.split(",").map((c) => c.trim()))].filter(isColor);
  return {
    template,
    colors: colors.length ? colors : ["blanc"],
    textMax: Math.min(Math.max(Math.trunc(product.customTextMax) || 0, 0), MAX_TEXT),
    allowImage: product.customImage,
    surchargeCents: Math.max(product.customSurchargeCents, 0),
  };
}

export type CustomSettingsField = "customTemplate" | "customColors" | "customTextMax" | "customSurcharge";
export type CustomSettingsError = "template" | "colorsMissing" | "colorUnknown" | "textMax" | "surcharge" | "surchargeTooHigh";
export type CustomSettings = { customTemplate: "" } | ({ customTemplate: Template } & Omit<ProductCustomFields, "customTemplate">);

/**
 * Valide les réglages saisis par le vendeur dans le back-office (champs bruts du formulaire).
 * Sans gabarit, seul le gabarit vide est rendu : les autres colonnes restent telles quelles en base,
 * et le vendeur retrouve ses réglages s'il réactive la personnalisation. Les erreurs sont des codes
 * par champ, traduits par l'action.
 */
export function parseCustomSettings(
  input: { template: string; colors: string[]; textMax: string; image: boolean; surcharge: string },
  priceCents: number,
): { ok: true; data: CustomSettings } | { ok: false; errors: Partial<Record<CustomSettingsField, CustomSettingsError>> } {
  if (input.template === "") return { ok: true, data: { customTemplate: "" } };
  const errors: Partial<Record<CustomSettingsField, CustomSettingsError>> = {};

  const template = TEMPLATES.find((t) => t === input.template);
  if (!template) errors.customTemplate = "template";

  if (input.colors.length === 0) errors.customColors = "colorsMissing";
  else if (!input.colors.every(isColor)) errors.customColors = "colorUnknown";

  const textRaw = input.textMax.trim();
  const textMax = /^\d+$/.test(textRaw) ? Number(textRaw) : NaN;
  if (!(textMax >= 0 && textMax <= MAX_TEXT)) errors.customTextMax = "textMax";

  const surcharge = input.surcharge.trim() === "" ? 0 : parseAmountToCents(input.surcharge);
  if (!Number.isInteger(surcharge) || surcharge < 0) errors.customSurcharge = "surcharge";
  else if ((Number.isFinite(priceCents) ? priceCents : 0) + surcharge > MAX_ORDER_CENTS) errors.customSurcharge = "surchargeTooHigh";

  if (!template || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      customTemplate: template,
      customColors: COLOR_KEYS.filter((c) => input.colors.includes(c)).join(","),
      customTextMax: textMax,
      customImage: input.image,
      customSurchargeCents: surcharge,
    },
  };
}

// Caractères invisibles qui n'ont rien à faire sur un objet imprimé. Le liant U+200D reste : il assemble les émojis composés.
const INVISIBLE = /[\u0000-\u0008\u000e-\u001f\u007f-\u009f​‌‎‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Texte tel qu'il sera imprimé : une seule ligne, sans espaces superflus ni caractères invisibles. */
export function cleanText(raw: string) {
  return raw.normalize("NFC").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Découpe en caractères tels que les voit le lecteur : un émoji composé ou une lettre accentuée compte pour un. */
export function graphemes(text: string) {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

export function textLength(text: string) {
  return graphemes(text).length;
}

function luminance(hex: string) {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Rapport de contraste WCAG entre deux couleurs « #rrggbb » (de 1 à 21). */
export function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** En dessous, l'encre se confond avec l'objet : un texte blanc sur une tasse blanche ne s'imprime pas. */
const MIN_INK_CONTRAST = 1.6;

export const inkReadable = (ink: ColorKey, body: ColorKey) => contrast(COLORS[ink], COLORS[body]) >= MIN_INK_CONTRAST;

/** Encre demandée si elle se lit sur l'objet ; sinon blanc sur un objet sombre, indigo sur un objet clair. */
export function inkFor(body: ColorKey, wanted?: ColorKey): ColorKey {
  if (wanted && inkReadable(wanted, body)) return wanted;
  return contrast(COLORS.blanc, COLORS[body]) >= contrast(COLORS.indigo, COLORS[body]) ? "blanc" : "indigo";
}

/** Ce que le client a choisi. Tailles et positions vont de 0 à 100 ; leur traduction en millimètres est dans `customizer/layout.ts`. */
export type Design = {
  color: ColorKey;
  text: string;
  font: FontKey;
  /** Couleur du texte. */
  ink: ColorKey;
  textSize: number;
  /** Position verticale du texte : 0 en haut de la zone imprimable, 100 en bas. */
  textY: number;
  /** Fichier envoyé par le client, ou null. */
  image: string | null;
  imageSize: number;
  imageX: number;
  imageY: number;
};

export function defaultDesign(options: CustomizerOptions): Design {
  const color = options.colors[0];
  return { color, text: "", font: "enseigne", ink: inkFor(color), textSize: 50, textY: 50, image: null, imageSize: 60, imageX: 50, imageY: 50 };
}

export type DesignError = "color" | "textTooLong" | "image";

const setting = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 0), 100) : 50);

/**
 * Valide un dessin reçu du navigateur contre les réglages du produit. Les réglages de confort
 * (police, encre, curseurs) sont corrigés en silence ; ce qui engage le vendeur (couleur, longueur
 * du texte, fichier) est refusé avec un motif, traduit là où la langue est connue.
 */
export function parseDesign(input: unknown, options: CustomizerOptions): { ok: true; design: Design } | { ok: false; error: DesignError } {
  if (typeof input !== "object" || input === null) return { ok: false, error: "color" };
  const raw = input as Record<string, unknown>;

  const color = raw.color;
  if (!isColor(color) || !options.colors.includes(color)) return { ok: false, error: "color" };

  const text = options.textMax > 0 && typeof raw.text === "string" ? cleanText(raw.text) : "";
  if (textLength(text) > options.textMax) return { ok: false, error: "textTooLong" };

  let image: string | null = null;
  if (raw.image != null && raw.image !== "") {
    if (!options.allowImage || typeof raw.image !== "string" || !CUSTOM_FILE.test(raw.image)) return { ok: false, error: "image" };
    image = raw.image;
  }

  return {
    ok: true,
    design: {
      color,
      text,
      font: FONTS.find((f) => f === raw.font) ?? "enseigne",
      ink: inkFor(color, isColor(raw.ink) ? raw.ink : undefined),
      textSize: setting(raw.textSize),
      textY: setting(raw.textY),
      image,
      imageSize: setting(raw.imageSize),
      imageX: setting(raw.imageX),
      imageY: setting(raw.imageY),
    },
  };
}

/** Y a-t-il quelque chose à imprimer ? Un simple choix de couleur ne demande aucun travail au vendeur. */
export function isPrinted<D extends Pick<Design, "text" | "image">>(design: D) {
  return design.text !== "" || design.image !== null;
}

/** Prix unitaire d'un article personnalisé, en unités mineures. */
export function customizedUnitPrice<D extends Pick<Design, "text" | "image">>(priceCents: number, options: Pick<CustomizerOptions, "surchargeCents">, design: D) {
  return priceCents + (isPrinted(design) ? options.surchargeCents : 0);
}

/** Deux dessins donnent-ils le même objet ? Les réglages d'un texte ou d'une image absents ne comptent pas. */
export function sameDesign(a: Design, b: Design) {
  if (a.color !== b.color || a.text !== b.text || a.image !== b.image) return false;
  if (a.text && (a.font !== b.font || a.ink !== b.ink || a.textSize !== b.textSize || a.textY !== b.textY)) return false;
  if (a.image && (a.imageSize !== b.imageSize || a.imageX !== b.imageX || a.imageY !== b.imageY)) return false;
  return true;
}

/** Toutes les couleurs, aucune limite de texte : une commande relue n'est pas revalidée contre les réglages actuels du produit. */
const ANY_PRODUCT: Omit<CustomizerOptions, "template"> = { colors: COLOR_KEYS, textMax: Number.POSITIVE_INFINITY, allowImage: true, surchargeCents: 0 };

/**
 * Copie figée d'une ligne de commande (JSON écrit par `placeOrder`), relue pour le vendeur : gabarit
 * et dessin complet, ou null si elle est absente ou illisible (JSON cassé, gabarit ou couleur inconnus,
 * nom d'image qui n'est pas un fichier généré par le serveur). La ligne s'affiche alors comme un article ordinaire.
 */
export function readOrderDesign(raw: string | null | undefined): { template: Template; design: Design } | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const template = TEMPLATES.find((t) => t === (value as Record<string, unknown>).template);
  if (!template) return null;
  const parsed = parseDesign(value, { template, ...ANY_PRODUCT });
  return parsed.ok ? { template, design: parsed.design } : null;
}

export type DesignSummary = { color: ColorKey; text: string; hasImage: boolean };

/**
 * Résumé affichable d'un dessin (« Latérite, « Miora », avec image »). Accepte aussi la copie figée
 * d'une ligne de commande (JSON) ; rend null si elle est absente ou illisible.
 */
export function describeDesign(input: { color: string; text: string; image: string | null } | string | null | undefined): DesignSummary | null {
  let value: unknown = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null) return null;
  const { color, text, image } = value as Record<string, unknown>;
  if (!isColor(color)) return null;
  return { color, text: typeof text === "string" ? text : "", hasImage: typeof image === "string" && image !== "" };
}
