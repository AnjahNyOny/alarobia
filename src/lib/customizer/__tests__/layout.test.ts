import { describe, expect, it } from "vitest";
import { defaultDesign, graphemes, TEMPLATES, type CustomizerOptions, type Design } from "../../customization";
import { layoutDesign, PRINT_ZONES, printPixels, type Layout, type Measure } from "../layout";

// Mesure de remplacement : chaque caractère visible occupe la moitié du corps. Le navigateur fournit la vraie (texture.ts).
const measure: Measure = (text, _font, size) => graphemes(text).length * size * 0.5;

const options: CustomizerOptions = { template: "mug", colors: ["blanc", "laterite"], textMax: 20, allowImage: true, surchargeCents: 0 };
const design = (changes: Partial<Design> = {}): Design => ({ ...defaultDesign(options), ...changes });
const image = "perso-0b9f6c1e-7a52-4c1d-9e0f-3a1b2c3d4e5f.jpg";

const zone = PRINT_ZONES.mug;
const margin = Math.min(zone.width, zone.height) * 0.05;
const EPSILON = 1e-6;

/** Tout ce qui est dessiné reste dans la zone imprimable, marges comprises. */
function expectInsideZone(layout: Layout, label = "") {
  const m = Math.min(layout.width, layout.height) * 0.05;
  if (layout.text) {
    for (const line of layout.text.lines) {
      expect(line.width, `${label} largeur de « ${line.text} »`).toBeLessThanOrEqual(layout.width - 2 * m + EPSILON);
      expect(line.y - layout.text.lineHeight / 2, `${label} haut de « ${line.text} »`).toBeGreaterThanOrEqual(m - EPSILON);
      expect(line.y + layout.text.lineHeight / 2, `${label} bas de « ${line.text} »`).toBeLessThanOrEqual(layout.height - m + EPSILON);
    }
  }
  if (layout.image) {
    const { x, y, width, height } = layout.image;
    expect(x, `${label} image à gauche`).toBeGreaterThanOrEqual(m - EPSILON);
    expect(y, `${label} image en haut`).toBeGreaterThanOrEqual(m - EPSILON);
    expect(x + width, `${label} image à droite`).toBeLessThanOrEqual(layout.width - m + EPSILON);
    expect(y + height, `${label} image en bas`).toBeLessThanOrEqual(layout.height - m + EPSILON);
  }
}

describe("layoutDesign : zone", () => {
  it("rend la zone imprimable du gabarit, en millimètres", () => {
    expect(layoutDesign("mug", design(), measure)).toEqual({ width: zone.width, height: zone.height, text: null, image: null });
    expect(layoutDesign("tote", design(), measure)).toMatchObject(PRINT_ZONES.tote);
  });
});

describe("layoutDesign : texte", () => {
  it("place un texte court sur une ligne, centré, à la taille demandée", () => {
    const { text } = layoutDesign("mug", design({ text: "Anjah", textSize: 50, textY: 50 }), measure);
    expect(text?.lines).toHaveLength(1);
    expect(text?.lines[0]).toMatchObject({ text: "Anjah", x: zone.width / 2 });
    expect(text?.lines[0].y).toBeCloseTo(zone.height / 2);
    expect(text?.size).toBeCloseTo((0.08 + 0.26 * 0.5) * (zone.height - 2 * margin));
  });
  it("grossit avec le réglage de taille", () => {
    const small = layoutDesign("mug", design({ text: "Aina", textSize: 0 }), measure).text!;
    const large = layoutDesign("mug", design({ text: "Aina", textSize: 100 }), measure).text!;
    expect(large.size).toBeGreaterThan(small.size * 3);
  });
  it("monte en haut de la zone à 0 et descend en bas à 100, sans en sortir", () => {
    const top = layoutDesign("mug", design({ text: "Anjah", textY: 0 }), measure).text!;
    const bottom = layoutDesign("mug", design({ text: "Anjah", textY: 100 }), measure).text!;
    expect(top.lines[0].y - top.lineHeight / 2).toBeCloseTo(margin);
    expect(bottom.lines[0].y + bottom.lineHeight / 2).toBeCloseTo(zone.height - margin);
  });
  it("porte la police et la teinte de l'encre choisies", () => {
    const { text } = layoutDesign("mug", design({ text: "Anjah", font: "manuscrite", color: "laterite", ink: "blanc" }), measure);
    expect(text).toMatchObject({ font: "manuscrite", color: "#f7f5f0" });
  });
  it("passe à la ligne entre les mots quand le texte est trop large", () => {
    const layout = layoutDesign("mug", design({ text: "Bon anniversaire Anjah", textSize: 100 }), measure);
    expect(layout.text!.lines.length).toBeGreaterThan(1);
    expect(layout.text!.lines.map((l) => l.text).join(" ")).toBe("Bon anniversaire Anjah");
    expectInsideZone(layout);
  });
  it("réduit le corps d'un mot trop long pour la zone plutôt que de le couper", () => {
    const requested = layoutDesign("mug", design({ text: "Aina", textSize: 100 }), measure).text!.size;
    const layout = layoutDesign("mug", design({ text: "Andriamanantenasoa20", textSize: 100 }), measure);
    expect(layout.text!.lines).toHaveLength(1);
    expect(layout.text!.size).toBeLessThan(requested);
    expectInsideZone(layout);
  });
  it("garde dans la zone un texte de 200 caractères, avec ou sans espaces", () => {
    expectInsideZone(layoutDesign("mug", design({ text: "a".repeat(200), textSize: 100 }), measure), "sans espace :");
    expectInsideZone(layoutDesign("mug", design({ text: "mora ".repeat(40).trim(), textSize: 100 }), measure), "avec espaces :");
  });
  it("ne coupe jamais un mot à une apostrophe", () => {
    const { text } = layoutDesign("mug", design({ text: "L'île d’Aina n'attend pas", textSize: 100 }), measure);
    for (const line of text!.lines) for (const word of line.text.split(" ")) expect(["L'île", "d’Aina", "n'attend", "pas"]).toContain(word);
  });
  it("mesure un émoji composé comme un seul caractère et le garde entier", () => {
    const { text } = layoutDesign("mug", design({ text: "👨‍👩‍👧 Aina 🌺", textSize: 40 }), measure);
    expect(text!.lines.map((l) => l.text).join(" ")).toBe("👨‍👩‍👧 Aina 🌺");
    expect(text!.lines[0].width).toBeCloseTo(8 * text!.size * 0.5);
  });
  it("ne dessine rien pour un texte fait uniquement d'espaces", () => {
    expect(layoutDesign("mug", design({ text: "   \n " }), measure).text).toBeNull();
  });
});

describe("layoutDesign : image", () => {
  it("attend de connaître les proportions de l'image pour la placer", () => {
    expect(layoutDesign("mug", design({ image }), measure).image).toBeNull();
    expect(layoutDesign("mug", design({ image: null }), measure, 1.5).image).toBeNull();
  });
  it("occupe toute la largeur utile à 100 pour une image en paysage, sans la déformer", () => {
    const box = layoutDesign("mug", design({ image, imageSize: 100 }), measure, 2).image!;
    expect(box.width).toBeCloseTo(zone.width - 2 * margin);
    expect(box.width / box.height).toBeCloseTo(2);
  });
  it("occupe toute la hauteur utile à 100 pour une image en portrait", () => {
    const box = layoutDesign("mug", design({ image, imageSize: 100 }), measure, 0.5).image!;
    expect(box.height).toBeCloseTo(zone.height - 2 * margin);
    expect(box.width / box.height).toBeCloseTo(0.5);
  });
  it("reste visible à la taille minimale", () => {
    const full = layoutDesign("mug", design({ image, imageSize: 100 }), measure, 1).image!;
    const small = layoutDesign("mug", design({ image, imageSize: 0 }), measure, 1).image!;
    expect(small.width).toBeCloseTo(full.width * 0.2);
  });
  it("se cale contre les marges aux positions extrêmes et se centre à 50", () => {
    const at = (imageX: number, imageY: number) => layoutDesign("mug", design({ image, imageSize: 40, imageX, imageY }), measure, 1).image!;
    expect(at(0, 0)).toMatchObject({ x: margin, y: margin });
    const far = at(100, 100);
    expect(far.x + far.width).toBeCloseTo(zone.width - margin);
    expect(far.y + far.height).toBeCloseTo(zone.height - margin);
    const middle = at(50, 50);
    expect(middle.x + middle.width / 2).toBeCloseTo(zone.width / 2);
    expect(middle.y + middle.height / 2).toBeCloseTo(zone.height / 2);
  });
});

describe("layoutDesign : tous les gabarits", () => {
  it("garde texte et image dans la zone pour toutes les combinaisons de réglages", () => {
    const texts = ["A", "Anjah", "Bon anniversaire Anjah", "Andriamanantenasoa20", "🌺 L'île d’Aina 🌺"];
    const steps = [0, 50, 100];
    for (const template of TEMPLATES)
      for (const text of texts)
        for (const ratio of [0.4, 1, 2.5])
          for (const size of steps)
            for (const position of steps) {
              const layout = layoutDesign(template, design({ text, textSize: size, textY: position, image, imageSize: size, imageX: position, imageY: 100 - position }), measure, ratio);
              expectInsideZone(layout, `${template} « ${text} » taille ${size} position ${position} :`);
            }
  });
});

describe("printPixels", () => {
  it("donne au fichier d'impression 1600 pixels de grand côté, aux proportions de la zone", () => {
    expect(printPixels("mug")).toEqual({ width: 1600, height: Math.round((1600 * 75) / 90) });
    const tote = printPixels("tote");
    expect(tote.height).toBe(1600);
    expect(tote.width / tote.height).toBeCloseTo(260 / 280, 2);
  });
  it("imprime la tasse à 300 points par pouce au moins", () => {
    expect(printPixels("mug").width / (PRINT_ZONES.mug.width / 25.4)).toBeGreaterThanOrEqual(300);
  });
});
