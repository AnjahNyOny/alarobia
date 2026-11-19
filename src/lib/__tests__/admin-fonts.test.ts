import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Les trois polices de la personnalisation (`components/customizer/fonts.ts`, `next/font/google`) ne doivent
 * jamais arriver dans le back-office : un module client qui les atteint, même par un détour, ajoute leurs
 * `@font-face` à la feuille de la page. Le back-office réduit pourtant ses photos avec le code de la
 * personnalisation (`send-image.ts`) : ce test suit les imports pour que ce partage reste sans polices.
 */
const SRC = path.resolve(import.meta.dirname, "../..");
const FORBIDDEN = "next/font/google";

const files = (dir: string) =>
  readdirSync(path.join(SRC, dir), { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f) && !f.includes("__tests__"))
    .map((f) => path.join(SRC, dir, f));

function resolve(from: string, specifier: string) {
  const base = specifier.startsWith("@/") ? path.join(SRC, specifier.slice(2)) : specifier.startsWith(".") ? path.resolve(path.dirname(from), specifier) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Imports exécutés d'un module (les `import type` n'emportent aucun code). */
function imports(file: string) {
  const source = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const m of source.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/gm)) if (!m[1]) found.push(m[2]);
  for (const m of source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) found.push(m[1]);
  return found;
}

/** Chemin d'imports qui mène de `entry` à `next/font/google`, ou null. */
function pathToFonts(entry: string): string[] | null {
  const seen = new Set<string>();
  const walk = (file: string, chain: string[]): string[] | null => {
    if (seen.has(file)) return null;
    seen.add(file);
    for (const specifier of imports(file)) {
      if (specifier === FORBIDDEN) return [...chain, FORBIDDEN];
      const next = resolve(file, specifier);
      if (!next || !/\.tsx?$/.test(next)) continue;
      const found = walk(next, [...chain, path.relative(SRC, next)]);
      if (found) return found;
    }
    return null;
  };
  return walk(entry, [path.relative(SRC, entry)]);
}

describe("polices de la personnalisation hors du back-office", () => {
  const entries = [...files("components/admin"), ...files("app/[locale]/admin"), path.join(SRC, "components/customizer/send-image.ts")];

  it("les modules du back-office sont tous trouvés", () => {
    expect(entries.some((f) => f.endsWith("image-uploader.tsx"))).toBe(true);
    expect(entries.filter((f) => f.endsWith("page.tsx")).length).toBeGreaterThanOrEqual(13);
  });

  it("le détecteur trouve bien le chemin de la fiche produit vers les polices (témoin)", () => {
    expect(pathToFonts(path.join(SRC, "components/customizer/controls.tsx"))).not.toBeNull();
  });

  for (const entry of entries) {
    it(`${path.relative(SRC, entry)} n'atteint pas ${FORBIDDEN}`, () => {
      expect(pathToFonts(entry)).toBeNull();
    });
  }
});
