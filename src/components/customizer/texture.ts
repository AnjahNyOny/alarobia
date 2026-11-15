import { COLORS, type Design, type FontKey, type Template } from "@/lib/customization";
import { FLAT, FLAT_SIZE, flatScale, paintObject } from "@/lib/customizer/flat";
import { layoutDesign, PRINT_ZONES, printPixels, type Measure } from "@/lib/customizer/layout";
import { paintLayout } from "@/lib/customizer/paint";
import { fontCss } from "./fonts";

/**
 * Le dessin du client, peint dans le navigateur. Trois sorties, un seul tracé (`paintLayout`) :
 * la zone imprimable seule sur fond transparent (texture 3D et fichier d'impression, à deux
 * définitions), et l'objet vu à plat (aperçu sans WebGL, vignette du panier).
 */

let scratch: CanvasRenderingContext2D | null = null;

/** Largeur réelle d'un texte, mesurée par le navigateur dans la police du dessin. */
export const measure: Measure = (text, font, size) => {
  scratch ??= document.createElement("canvas").getContext("2d");
  if (!scratch) return text.length * size * 0.6;
  // Mesuré à 100 px puis ramené au corps demandé : pas d'arrondi sur les petits corps.
  scratch.font = fontCss(font, 100);
  return (scratch.measureText(text).width * size) / 100;
};

/** Attend que la police soit prête à être peinte. Un canevas, contrairement au HTML, ne se repeint pas tout seul quand elle arrive. */
export async function ensureFont(font: FontKey, text: string) {
  try {
    await document.fonts.load(fontCss(font, 48), text || "Aa");
  } catch {
    // Police indisponible : le navigateur peint avec sa police de repli.
  }
}

const images = new Map<string, Promise<HTMLImageElement>>();

/** Image envoyée par le client, chargée une fois. */
export function loadImage(url: string) {
  let pending = images.get(url);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        images.delete(url);
        reject(new Error(`image illisible : ${url}`));
      };
      img.src = url;
    });
    images.set(url, pending);
  }
  return pending;
}

const layoutFor = (template: Template, design: Design, image: HTMLImageElement | null) => layoutDesign(template, design, measure, image ? image.naturalWidth / image.naturalHeight : null);

function context(canvas: HTMLCanvasElement, width: number, height: number) {
  // Redimensionner un canevas l'efface ; ne le faire que si la taille change évite un clignotement.
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canevas 2D indisponible");
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

/** Grand côté de la texture 3D : assez fin pour un écran de téléphone, léger pour sa mémoire. */
export const TEXTURE_LONG_SIDE = 1024;

/**
 * La zone imprimable seule, sur fond transparent. Avec `longSide` par défaut c'est le fichier
 * d'impression (1600 px) ; la texture 3D est la même image en plus petit.
 */
export function paintZone(canvas: HTMLCanvasElement, template: Template, design: Design, image: HTMLImageElement | null, longSide?: number) {
  const full = printPixels(template);
  const ratio = longSide ? longSide / Math.max(full.width, full.height) : 1;
  const width = Math.round(full.width * ratio);
  const height = Math.round(full.height * ratio);
  const ctx = context(canvas, width, height);
  paintLayout(ctx, layoutFor(template, design, image), {
    scale: width / PRINT_ZONES[template].width,
    image,
    fontCss,
  });
}

/** L'objet vu de face dans sa couleur, avec le dessin, sur un carré de `size` pixels. `background` : fond plein (vignette), sinon transparent. */
export function paintFlat(canvas: HTMLCanvasElement, template: Template, design: Design, image: HTMLImageElement | null, size: number, background?: string) {
  const ctx = context(canvas, size, size);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }
  paintObject(ctx, template, COLORS[design.color], size);
  const unit = size / FLAT_SIZE;
  const { zone } = FLAT[template];
  paintLayout(ctx, layoutFor(template, design, image), {
    scale: flatScale(template) * unit,
    x: zone.x * unit,
    y: zone.y * unit,
    image,
    fontCss,
  });
}

export function canvasBlob(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg" | "image/webp", quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("export du canevas impossible"))), type, quality));
}
