import { describe, expect, it } from "vitest";
import { safeNext } from "../form";

describe("safeNext", () => {
  it("accepte un chemin interne", () => {
    expect(safeNext("/compte/favoris")).toBe("/compte/favoris");
  });
  it("refuse les redirections vers un autre site", () => {
    expect(safeNext("https://exemple.com")).toBe("/compte");
    expect(safeNext("//exemple.com")).toBe("/compte");
    expect(safeNext("/\\exemple.com")).toBe("/compte");
  });
  it("utilise la valeur de repli si rien n'est fourni", () => {
    expect(safeNext(null, "/admin")).toBe("/admin");
    expect(safeNext(undefined)).toBe("/compte");
  });
});
