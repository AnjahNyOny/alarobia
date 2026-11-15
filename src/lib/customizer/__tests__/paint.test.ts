import { describe, expect, it } from "vitest";
import { defaultDesign, TEMPLATES, type CustomizerOptions, type Design } from "../../customization";
import { FLAT, FLAT_SIZE, flatScale } from "../flat";
import { layoutDesign, PRINT_ZONES, printPixels, type Measure } from "../layout";
import { paintLayout } from "../paint";

const measure: Measure = (text, _font, size) => text.length * size * 0.5;
const options: CustomizerOptions = { template: "mug", colors: ["blanc", "laterite"], textMax: 20, allowImage: true, surchargeCents: 0 };
const design = (changes: Partial<Design> = {}): Design => ({ ...defaultDesign(options), ...changes });
const fontCss = (font: string, px: number) => `${px}px ${font}`;
const photo = { nom: "photo" } as unknown as CanvasImageSource;

type Call = { op: "image"; args: number[] } | { op: "text"; text: string; x: number; y: number; font: string; fill: string; align: string };

/** Contexte de dessin qui note ce qu'on lui demande : Node n'a pas de canevas, et seul l'ordre et la place des tracés comptent ici. */
function recorder() {
  const calls: Call[] = [];
  const ctx = {
    font: "",
    fillStyle: "",
    textAlign: "",
    textBaseline: "",
    save() {},
    restore() {},
    drawImage(_image: unknown, ...args: number[]) {
      calls.push({ op: "image", args });
    },
    fillText(text: string, x: number, y: number) {
      calls.push({ op: "text", text, x, y, font: this.font, fill: this.fillStyle, align: this.textAlign });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("paintLayout : le même dessin à toutes les échelles", () => {
  const layout = layoutDesign("mug", design({ text: "Miora sy Aina", ink: "laterite", image: "perso-x.jpg", imageSize: 40, imageX: 20, imageY: 80 }), measure, 1.5);

  it("peint l'image dans son cadre, à l'échelle demandée", () => {
    const { ctx, calls } = recorder();
    paintLayout(ctx, layout, { scale: 4, image: photo, fontCss });
    const box = layout.image!;
    expect(calls[0]).toEqual({ op: "image", args: [box.x * 4, box.y * 4, box.width * 4, box.height * 4] });
  });

  it("peint chaque ligne centrée sur son point, dans la police, le corps et l'encre du dessin", () => {
    const { ctx, calls } = recorder();
    paintLayout(ctx, layout, { scale: 4, image: photo, fontCss });
    const lines = calls.filter((c) => c.op === "text");
    expect(lines).toHaveLength(layout.text!.lines.length);
    lines.forEach((call, i) => {
      const line = layout.text!.lines[i];
      expect(call).toEqual({ op: "text", text: line.text, x: line.x * 4, y: line.y * 4, font: `${layout.text!.size * 4}px enseigne`, fill: layout.text!.color, align: "center" });
    });
  });

  it("peint le texte par-dessus l'image", () => {
    const { ctx, calls } = recorder();
    paintLayout(ctx, layout, { scale: 1, image: photo, fontCss });
    expect(calls.map((c) => c.op)).toEqual(["image", ...layout.text!.lines.map(() => "text")]);
  });

  it("décale tout le dessin quand la zone n'est pas au coin du canevas (aperçu à plat)", () => {
    const { ctx, calls } = recorder();
    paintLayout(ctx, layout, { scale: 2, x: 30, y: 50, image: photo, fontCss });
    const box = layout.image!;
    expect(calls[0]).toEqual({ op: "image", args: [30 + box.x * 2, 50 + box.y * 2, box.width * 2, box.height * 2] });
    const first = calls.find((c) => c.op === "text")!;
    expect(first).toMatchObject({ x: 30 + layout.text!.lines[0].x * 2, y: 50 + layout.text!.lines[0].y * 2 });
  });

  it("ne peint pas l'image tant qu'elle n'est pas chargée, mais peint le texte", () => {
    const { ctx, calls } = recorder();
    paintLayout(ctx, layout, { scale: 1, image: null, fontCss });
    expect(calls.every((c) => c.op === "text")).toBe(true);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("ne peint rien pour un objet sans texte ni image", () => {
    const { ctx, calls } = recorder();
    paintLayout(ctx, layoutDesign("mug", design(), measure), { scale: 4, image: null, fontCss });
    expect(calls).toEqual([]);
  });

  it("donne au fichier d'impression exactement ce que montre l'aperçu, agrandi", () => {
    // L'aperçu peint à l'échelle de l'objet à plat, le fichier d'impression à celle de `printPixels` : mêmes tracés, à un facteur près.
    const small = recorder();
    const large = recorder();
    const preview = flatScale("mug") * 6;
    const print = printPixels("mug").width / PRINT_ZONES.mug.width;
    paintLayout(small.ctx, layout, { scale: preview, image: photo, fontCss: () => "" });
    paintLayout(large.ctx, layout, { scale: print, image: photo, fontCss: () => "" });
    const factor = print / preview;
    small.calls.forEach((call, i) => {
      const other = large.calls[i];
      if (call.op === "image" && other.op === "image") call.args.forEach((value, k) => expect(other.args[k]).toBeCloseTo(value * factor));
      else if (call.op === "text" && other.op === "text") {
        expect(other.text).toBe(call.text);
        expect(other.x).toBeCloseTo(call.x * factor);
        expect(other.y).toBeCloseTo(call.y * factor);
      } else throw new Error("tracés différents entre l'aperçu et l'impression");
    });
  });
});

describe("FLAT : l'objet vu à plat", () => {
  it("donne à chaque gabarit une zone aux proportions exactes de sa zone imprimable", () => {
    for (const template of TEMPLATES) {
      const { zone } = FLAT[template];
      expect(zone.width / zone.height, template).toBeCloseTo(PRINT_ZONES[template].width / PRINT_ZONES[template].height, 3);
    }
  });
  it("garde la zone dans le corps de l'objet, lui-même dans le cadre", () => {
    for (const template of TEMPLATES) {
      const { zone, body } = FLAT[template];
      expect(zone.x, template).toBeGreaterThanOrEqual(body.x);
      expect(zone.y, template).toBeGreaterThanOrEqual(body.y);
      expect(zone.x + zone.width, template).toBeLessThanOrEqual(body.x + body.width);
      expect(zone.y + zone.height, template).toBeLessThanOrEqual(body.y + body.height);
      expect(body.x, template).toBeGreaterThanOrEqual(0);
      expect(body.y, template).toBeGreaterThanOrEqual(0);
      expect(body.x + body.width, template).toBeLessThanOrEqual(FLAT_SIZE);
      expect(body.y + body.height, template).toBeLessThanOrEqual(FLAT_SIZE);
    }
  });
  it("donne l'échelle de la zone, en unités du cadre par millimètre", () => {
    expect(flatScale("carnet") * PRINT_ZONES.carnet.width).toBeCloseTo(FLAT.carnet.zone.width);
  });
});
