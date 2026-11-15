import type { Template } from "../customization";
import { PRINT_ZONES, type Box } from "./layout";

/**
 * L'objet vu de face, à plat, dans un cadre carré de 100 unités. Sert d'aperçu quand la 3D n'est pas
 * disponible (pas de WebGL, appareil qui peine) et de vignette dans le panier et la commande.
 * La zone imprimable y garde ses proportions exactes : le dessin y est peint par `paintLayout`,
 * comme partout ailleurs.
 */
export const FLAT_SIZE = 100;

/** Zone placée par son coin et sa largeur ; la hauteur suit les proportions de la zone imprimable. */
const zoneAt = (template: Template, x: number, y: number, width: number): Box => ({ x, y, width, height: (width * PRINT_ZONES[template].height) / PRINT_ZONES[template].width });

/** `body` : rectangle qui contient tout l'objet (anses comprises). `zone` : là où le dessin est peint. */
export const FLAT: Record<Template, { body: Box; zone: Box }> = {
  mug: { body: { x: 22, y: 24, width: 66, height: 56 }, zone: zoneAt("mug", 25, 36.5, 42) },
  gourde: { body: { x: 37.5, y: 8, width: 25, height: 84 }, zone: zoneAt("gourde", 39.5, 42, 21) },
  carnet: { body: { x: 22, y: 10, width: 56, height: 80 }, zone: zoneAt("carnet", 29.6, 21.5, 41.8) },
  tote: { body: { x: 22, y: 6, width: 56, height: 90 }, zone: zoneAt("tote", 30.8, 46, 38.4) },
};

/** Unités du cadre par millimètre de zone imprimable. */
export const flatScale = (template: Template) => FLAT[template].zone.width / PRINT_ZONES[template].width;

const INK = "31, 37, 71"; // l'indigo du site, pour les ombres et les contours
const outline = (ctx: CanvasRenderingContext2D) => {
  ctx.strokeStyle = `rgba(${INK}, 0.22)`;
  ctx.lineWidth = 0.5;
  ctx.stroke();
};
const ground = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${INK}, 0.14)`;
  ctx.fill();
};
/** Ombre d'un volume rond : les bords s'assombrissent, un reflet reste à gauche du centre. */
const roundShade = (ctx: CanvasRenderingContext2D, left: number, right: number) => {
  const shade = ctx.createLinearGradient(left, 0, right, 0);
  shade.addColorStop(0, "rgba(0, 0, 0, 0.2)");
  shade.addColorStop(0.22, "rgba(255, 255, 255, 0.1)");
  shade.addColorStop(0.5, "rgba(0, 0, 0, 0)");
  shade.addColorStop(1, "rgba(0, 0, 0, 0.24)");
  ctx.fillStyle = shade;
  ctx.fill();
};

const SHAPES: Record<Template, (ctx: CanvasRenderingContext2D, color: string) => void> = {
  mug(ctx, color) {
    ground(ctx, 47, 80.5, 30, 2.6);
    // L'anse d'abord : le corps passe devant ses attaches.
    ctx.beginPath();
    ctx.moveTo(68, 35);
    ctx.bezierCurveTo(92, 32, 92, 70, 68, 67);
    ctx.lineCap = "round";
    ctx.lineWidth = 6.5;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.14)";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(22, 24);
    ctx.lineTo(70, 24);
    ctx.lineTo(70, 72);
    ctx.quadraticCurveTo(70, 80, 62, 80);
    ctx.lineTo(30, 80);
    ctx.quadraticCurveTo(22, 80, 22, 72);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    roundShade(ctx, 22, 70);
    outline(ctx);
    // Le bord : une ellipse sombre laisse deviner l'ouverture.
    ctx.beginPath();
    ctx.ellipse(46, 24, 24, 2.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fill();
    outline(ctx);
  },
  gourde(ctx, color) {
    ground(ctx, 50, 92.2, 16, 2);
    ctx.beginPath();
    ctx.roundRect(44, 8, 12, 9, 1.5);
    ctx.fillStyle = "#b9bcc4";
    ctx.fill();
    roundShade(ctx, 44, 56);
    outline(ctx);

    ctx.beginPath();
    ctx.moveTo(45, 17);
    ctx.lineTo(55, 17);
    ctx.bezierCurveTo(55, 23, 62.5, 23, 62.5, 31);
    ctx.lineTo(62.5, 88);
    ctx.quadraticCurveTo(62.5, 92, 58.5, 92);
    ctx.lineTo(41.5, 92);
    ctx.quadraticCurveTo(37.5, 92, 37.5, 88);
    ctx.lineTo(37.5, 31);
    ctx.bezierCurveTo(37.5, 23, 45, 23, 45, 17);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    roundShade(ctx, 37.5, 62.5);
    outline(ctx);
  },
  carnet(ctx, color) {
    ctx.fillStyle = `rgba(${INK}, 0.14)`;
    ctx.beginPath();
    ctx.roundRect(23.5, 11.8, 56, 80, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(22, 10, 56, 80, 2);
    ctx.fillStyle = color;
    ctx.fill();
    outline(ctx);
    // Le dos, puis l'élastique de fermeture.
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    ctx.fillRect(22, 10, 4.5, 80);
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(73.4, 10, 1.6, 80);
  },
  tote(ctx, color) {
    ground(ctx, 50, 96, 29, 1.8);
    ctx.beginPath();
    ctx.moveTo(37, 37);
    ctx.bezierCurveTo(37, 2, 63, 2, 63, 37);
    ctx.lineWidth = 3.4;
    ctx.lineCap = "butt";
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.16)";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(22, 34);
    ctx.lineTo(78, 34);
    ctx.lineTo(76.5, 96);
    ctx.lineTo(23.5, 96);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    outline(ctx);
    // L'ourlet du haut.
    ctx.beginPath();
    ctx.moveTo(22.2, 38.5);
    ctx.lineTo(77.8, 38.5);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.16)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  },
};

/** Dessine l'objet nu, dans sa couleur, sur un canevas carré de `size` pixels. Le dessin du client se peint ensuite dans `FLAT[template].zone`. */
export function paintObject(ctx: CanvasRenderingContext2D, template: Template, color: string, size: number) {
  ctx.save();
  ctx.scale(size / FLAT_SIZE, size / FLAT_SIZE);
  SHAPES[template](ctx, color);
  ctx.restore();
}
