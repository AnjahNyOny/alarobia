import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Remplaçant d'Archivo (globals.css) : en 3G la police arrive après le premier affichage. Chaque largeur de police
 * employée par les utilitaires (`display`, `display-sm`) doit avoir sa face de remplacement, sinon le texte étroit
 * s'affiche d'abord en pleine largeur, passe à la ligne, puis remonte quand Archivo arrive (décalage de 0,11 sur le
 * panier). Deux familles : « Archivo Fallback » (Arial, ordinateurs et iPhone) puis « Archivo Fallback Roboto »
 * (Android, qui n'a pas Arial). Les rapports de largeur se mesurent dans le navigateur ; ce test garde la structure,
 * les hauteurs et l'ordre des familles.
 */
const css = readFileSync(resolve(__dirname, "../globals.css"), "utf8");
const layout = readFileSync(resolve(__dirname, "../[locale]/layout.tsx"), "utf8");

const blocks = (pattern: RegExp) => [...css.matchAll(pattern)].map((m) => m[1]);
const descriptor = (block: string, name: string) => block.match(new RegExp(`(?:^|[;\\s])${name}:\\s*([^;]+);`))?.[1].trim();
const percent = (value: string | undefined) => (value === undefined ? NaN : Number.parseFloat(value) / 100);
const localNames = (face: string) => [...(descriptor(face, "src") ?? "").matchAll(/local\("([^"]+)"\)/g)].map((m) => m[1]);

const FAMILIES = ["Archivo Fallback", "Archivo Fallback Roboto"];
const facesOf = (family: string) => blocks(/@font-face\s*\{([^}]*)\}/g).filter((b) => descriptor(b, "font-family") === `"${family}"`);
const utilityStretches = [...new Set(blocks(/@utility\s+[\w-]+\s*\{([^}]*)\}/g).flatMap((b) => descriptor(b, "font-stretch") ?? []))];

describe("remplaçant d'Archivo", () => {
  it("les utilitaires emploient des largeurs resserrées", () => {
    expect(utilityStretches.length).toBeGreaterThan(0);
  });

  // Le navigateur prend la première famille dont une face se charge : Arial là où elle existe, Roboto sur Android.
  it("le layout essaie Arial puis Roboto", () => {
    const fallback = layout.match(/fallback:\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect([...fallback.matchAll(/"([^"]+)"/g)].map((m) => m[1])).toEqual(FAMILIES);
  });

  describe.each(FAMILIES)("famille « %s »", (family) => {
    const faces = facesOf(family);

    it.each(utilityStretches)("une face existe pour font-stretch %s", (stretch) => {
      expect(faces.map((f) => descriptor(f, "font-stretch"))).toContain(stretch);
    });

    it("une face sans font-stretch couvre le texte courant", () => {
      expect(faces.some((f) => descriptor(f, "font-stretch") === undefined)).toBe(true);
    });

    // Les surcharges de hauteur sont multipliées par size-adjust : leur produit doit rester la montée (87,8 %) et la
    // descente (21 %) d'Archivo, pour que la ligne de base ne bouge pas à l'arrivée de la police.
    it("chaque face garde les hauteurs d'Archivo", () => {
      expect(faces.length).toBeGreaterThan(0);
      for (const face of faces) {
        const size = percent(descriptor(face, "size-adjust"));
        expect(percent(descriptor(face, "ascent-override")) * size).toBeCloseTo(0.878, 3);
        expect(percent(descriptor(face, "descent-override")) * size).toBeCloseTo(0.21, 3);
        expect(descriptor(face, "line-gap-override")).toBe("0%");
      }
    });
  });

  // Depuis Android 12, « Roboto-Regular » est une police variable : Chrome (130 et plus) y applique l'axe wdth d'après
  // le font-stretch de la face, et les faces étroites seraient resserrées deux fois. RobotoStatic-Regular, la même
  // Roboto en version fixe, livrée avec Android 12 et suivants, passe donc d'abord ; « Roboto-Regular » ne sert
  // qu'aux Android plus anciens, où elle est fixe.
  it("les faces Roboto prennent la Roboto fixe avant la variable", () => {
    const faces = facesOf("Archivo Fallback Roboto");
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) {
      const names = localNames(face);
      expect(names[0]).toBe("RobotoStatic-Regular");
      expect(names).toContain("Roboto-Regular");
      expect(descriptor(face, "src")).not.toMatch(/url\(/);
    }
  });
});
