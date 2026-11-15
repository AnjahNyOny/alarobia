import type { FontKey } from "../customization";
import type { Layout } from "./layout";

/**
 * Peint une mise en place (`layoutDesign`) sur un canevas. C'est le seul endroit où texte et image
 * sont tracés : texture 3D, aperçu à plat et fichier d'impression passent tous par ici, à des
 * échelles différentes. Aucune dépendance au navigateur hors du contexte reçu : testé sans canevas.
 */
export type PaintOptions = {
  /** Pixels par millimètre. */
  scale: number;
  /** Coin haut-gauche de la zone imprimable dans le canevas, en pixels. */
  x?: number;
  y?: number;
  /** Image du client, une fois chargée ; null tant qu'elle ne l'est pas. */
  image: CanvasImageSource | null;
  /** Police CSS d'un canevas pour une police du dessin et un corps en pixels (`components/customizer/fonts.ts`). */
  fontCss: (font: FontKey, px: number) => string;
};

export function paintLayout(ctx: CanvasRenderingContext2D, layout: Layout, { scale, x = 0, y = 0, image, fontCss }: PaintOptions) {
  if (layout.image && image) {
    const box = layout.image;
    ctx.drawImage(image, x + box.x * scale, y + box.y * scale, box.width * scale, box.height * scale);
  }
  if (layout.text) {
    ctx.save();
    ctx.font = fontCss(layout.text.font, layout.text.size * scale);
    ctx.fillStyle = layout.text.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const line of layout.text.lines) ctx.fillText(line.text, x + line.x * scale, y + line.y * scale);
    ctx.restore();
  }
}
