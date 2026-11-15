import { cleanText, COLORS, type Design, type FontKey, type Template } from "../customization";

/**
 * Mise en place du texte et de l'image dans la zone imprimable d'un gabarit.
 *
 * Fonction pure, en millimètres : le même calcul sert à la texture 3D, à l'aperçu à plat et au
 * fichier d'impression (`components/customizer/texture.ts` le peint à l'échelle voulue). Ce que
 * le client voit est donc ce que le vendeur imprime.
 */

/** Zone imprimable de chaque gabarit, en millimètres. Les modèles 3D et l'aperçu à plat s'y conforment. */
export const PRINT_ZONES: Record<Template, { width: number; height: number }> = {
  mug: { width: 90, height: 75 },
  gourde: { width: 60, height: 110 },
  carnet: { width: 110, height: 150 },
  tote: { width: 260, height: 280 },
};

/** Marge intérieure, en part du petit côté : rien ne s'imprime au ras du bord. */
const MARGIN = 0.05;
/** Corps du texte, en part du petit côté utile, pour un réglage de taille à 0 puis à 100. */
const TEXT_MIN = 0.08;
const TEXT_MAX = 0.34;
const LINE_HEIGHT = 1.15;
/** Part de la taille maximale que garde une image au réglage 0 : elle reste visible. */
const IMAGE_MIN = 0.2;
/** Grand côté du fichier d'impression, en pixels. */
const PRINT_LONG_SIDE = 1600;

/** Largeur d'un texte pour une police et un corps donnés, dans l'unité du corps. Fournie par le navigateur, ou par les tests. */
export type Measure = (text: string, font: FontKey, size: number) => number;

export type Box = { x: number; y: number; width: number; height: number };
/** Une ligne de texte : `x` et `y` désignent son centre. */
export type TextLine = { text: string; x: number; y: number; width: number };
export type TextLayout = { lines: TextLine[]; font: FontKey; color: string; size: number; lineHeight: number };
export type Layout = { width: number; height: number; text: TextLayout | null; image: Box | null };

function wrap(words: string[], font: FontKey, size: number, maxWidth: number, measure: Measure) {
  const lines: { text: string; width: number }[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    // Un mot plus large que la zone reste seul sur sa ligne : c'est le corps qui diminuera, on ne coupe pas un mot.
    if (current && measure(candidate, font, size) > maxWidth) {
      lines.push({ text: current, width: measure(current, font, size) });
      current = word;
    } else current = candidate;
  }
  lines.push({ text: current, width: measure(current, font, size) });
  return lines;
}

/** Plus grand corps, au plus égal au corps demandé, pour lequel le texte tient dans la largeur et la hauteur utiles. */
function fitText(words: string[], font: FontKey, requested: number, maxWidth: number, maxHeight: number, measure: Measure) {
  let size = requested;
  let lines = wrap(words, font, size, maxWidth, measure);
  // Le corps ne fait que diminuer et le nombre de lignes avec lui : deux ou trois passes suffisent.
  for (let pass = 0; pass < 12; pass++) {
    const widest = Math.max(...lines.map((l) => l.width));
    const factor = Math.min(1, maxWidth / widest, maxHeight / (lines.length * size * LINE_HEIGHT));
    if (factor >= 1) break;
    size *= factor * 0.995;
    lines = wrap(words, font, size, maxWidth, measure);
  }
  return { size, lines };
}

/**
 * @param imageRatio largeur / hauteur de l'image envoyée ; tant qu'il est inconnu (image en cours de chargement), l'image n'est pas placée.
 */
export function layoutDesign(template: Template, design: Design, measure: Measure, imageRatio?: number | null): Layout {
  const { width, height } = PRINT_ZONES[template];
  const margin = Math.min(width, height) * MARGIN;
  const innerWidth = width - 2 * margin;
  const innerHeight = height - 2 * margin;

  let image: Box | null = null;
  if (design.image && imageRatio && imageRatio > 0) {
    const scale = IMAGE_MIN + (1 - IMAGE_MIN) * (design.imageSize / 100);
    const fitWidth = Math.min(innerWidth, innerHeight * imageRatio);
    const boxWidth = fitWidth * scale;
    const boxHeight = (fitWidth / imageRatio) * scale;
    image = {
      x: margin + (innerWidth - boxWidth) * (design.imageX / 100),
      y: margin + (innerHeight - boxHeight) * (design.imageY / 100),
      width: boxWidth,
      height: boxHeight,
    };
  }

  let text: TextLayout | null = null;
  const content = cleanText(design.text);
  if (content) {
    const requested = (TEXT_MIN + (TEXT_MAX - TEXT_MIN) * (design.textSize / 100)) * Math.min(innerWidth, innerHeight);
    const { size, lines } = fitText(content.split(" "), design.font, requested, innerWidth, innerHeight, measure);
    const lineHeight = size * LINE_HEIGHT;
    const top = margin + (innerHeight - lines.length * lineHeight) * (design.textY / 100);
    text = {
      font: design.font,
      color: COLORS[design.ink],
      size,
      lineHeight,
      lines: lines.map((line, i) => ({ ...line, x: width / 2, y: top + (i + 0.5) * lineHeight })),
    };
  }

  return { width, height, text, image };
}

/** Dimensions en pixels du fichier d'impression : la zone imprimable seule, 1600 px de grand côté (plus de 300 points par pouce sur la tasse). */
export function printPixels(template: Template) {
  const { width, height } = PRINT_ZONES[template];
  const scale = PRINT_LONG_SIDE / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
