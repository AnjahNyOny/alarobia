import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Remplaçant d'Archivo (globals.css) : en 3G la police arrive après le premier affichage. Chaque largeur de police
 * employée par les utilitaires (`display`, `display-sm`) doit avoir sa face « Archivo Fallback », sinon le texte
 * étroit s'affiche d'abord en Arial pleine largeur, passe à la ligne, puis remonte quand Archivo arrive (décalage
 * de 0,11 sur le panier). Les rapports de largeur se mesurent dans le navigateur ; ce test garde la structure et
 * les hauteurs.
 */
const css = readFileSync(resolve(__dirname, "../globals.css"), "utf8");

const blocks = (pattern: RegExp) => [...css.matchAll(pattern)].map((m) => m[1]);
const descriptor = (block: string, name: string) => block.match(new RegExp(`(?:^|[;\\s])${name}:\\s*([^;]+);`))?.[1].trim();
const percent = (value: string | undefined) => (value === undefined ? NaN : Number.parseFloat(value) / 100);

const fallbackFaces = blocks(/@font-face\s*\{([^}]*)\}/g).filter((b) => descriptor(b, "font-family") === '"Archivo Fallback"');
const utilityStretches = [...new Set(blocks(/@utility\s+[\w-]+\s*\{([^}]*)\}/g).flatMap((b) => descriptor(b, "font-stretch") ?? []))];

describe("remplaçant d'Archivo", () => {
  it("les utilitaires emploient des largeurs resserrées", () => {
    expect(utilityStretches.length).toBeGreaterThan(0);
  });

  it.each(utilityStretches)("une face « Archivo Fallback » existe pour font-stretch %s", (stretch) => {
    expect(fallbackFaces.map((f) => descriptor(f, "font-stretch"))).toContain(stretch);
  });

  it("une face sans font-stretch couvre le texte courant", () => {
    expect(fallbackFaces.some((f) => descriptor(f, "font-stretch") === undefined)).toBe(true);
  });

  // Les surcharges de hauteur sont multipliées par size-adjust : leur produit doit rester la montée (87,8 %) et la
  // descente (21 %) d'Archivo, pour que la ligne de base ne bouge pas à l'arrivée de la police.
  it.each(fallbackFaces.map((f) => [descriptor(f, "font-stretch") ?? "100%", f]))("face %s : hauteurs d'Archivo", (_, face) => {
    const size = percent(descriptor(face, "size-adjust"));
    expect(percent(descriptor(face, "ascent-override")) * size).toBeCloseTo(0.878, 3);
    expect(percent(descriptor(face, "descent-override")) * size).toBeCloseTo(0.21, 3);
    expect(descriptor(face, "line-gap-override")).toBe("0%");
  });
});
