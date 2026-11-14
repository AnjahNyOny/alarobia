import { describe, expect, it } from "vitest";
import { safeNext } from "../form";

describe("safeNext", () => {
  it("accepte un chemin interne", () => {
    expect(safeNext("/account/wishlist")).toBe("/account/wishlist");
  });
  it("refuse les redirections vers un autre site", () => {
    expect(safeNext("https://exemple.com")).toBe("/account");
    expect(safeNext("//exemple.com")).toBe("/account");
    expect(safeNext("/\\exemple.com")).toBe("/account");
  });
  it("utilise la valeur de repli si rien n'est fourni", () => {
    expect(safeNext(null, "/admin")).toBe("/admin");
    expect(safeNext(undefined)).toBe("/account");
  });
});
