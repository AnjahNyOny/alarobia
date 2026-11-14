import { describe, expect, it } from "vitest";
import { protectionFor, splitLocale } from "../paths";

describe("splitLocale", () => {
  it("sépare la langue du reste du chemin", () => {
    expect(splitLocale("/mg/admin/orders")).toEqual({ locale: "mg", path: "/admin/orders" });
    expect(splitLocale("/en")).toEqual({ locale: "en", path: "/" });
    expect(splitLocale("/fr/")).toEqual({ locale: "fr", path: "/" });
  });
  it("ne prend pas un segment quelconque pour une langue", () => {
    expect(splitLocale("/admin")).toEqual({ locale: null, path: "/admin" });
    expect(splitLocale("/english/admin")).toEqual({ locale: null, path: "/english/admin" });
    expect(splitLocale("/")).toEqual({ locale: null, path: "/" });
  });
});

describe("protectionFor", () => {
  it("protège le back-office et l'espace client, avec ou sans sous-chemin", () => {
    expect(protectionFor("/admin")).toBe("admin");
    expect(protectionFor("/admin/products/new")).toBe("admin");
    expect(protectionFor("/account")).toBe("account");
    expect(protectionFor("/account/orders/abc")).toBe("account");
  });
  it("laisse le reste public, y compris les chemins qui commencent pareil", () => {
    expect(protectionFor("/")).toBeNull();
    expect(protectionFor("/products")).toBeNull();
    expect(protectionFor("/administration")).toBeNull();
    expect(protectionFor("/accounting")).toBeNull();
  });
});
