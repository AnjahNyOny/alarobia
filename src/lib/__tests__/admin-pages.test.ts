import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Next peut rendre une page sans repasser par son layout (navigation côté client, préchargement) :
 * la vérification de `admin/layout.tsx` ne suffit pas. Chaque page du back-office revérifie la session
 * en tête de son composant. Ce test lit les sources, pour qu'une page ajoutée plus tard ne l'oublie pas.
 */
const ADMIN = path.resolve(import.meta.dirname, "../../app/[locale]/admin");
const pages = readdirSync(ADMIN, { recursive: true, encoding: "utf8" }).filter((f) => path.basename(f) === "page.tsx");

describe("pages du back-office", () => {
  it("sont toutes trouvées", () => {
    expect(pages.length).toBeGreaterThanOrEqual(13);
  });
  for (const page of pages) {
    it(`${page} vérifie la session dès la première ligne du composant`, () => {
      const source = readFileSync(path.join(ADMIN, page), "utf8");
      const body = source.slice(source.indexOf("export default async function"));
      expect(body.split("\n").slice(0, 2).join("\n")).toMatch(/\{\n {2}await requireAdmin\(\);$/);
    });
  }
});
