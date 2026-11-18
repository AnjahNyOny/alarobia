import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "@/test/database";
import { stripNul } from "../nul";

describe("stripNul", () => {
  it("retire le caractère nul d'une chaîne seule", () => {
    expect(stripNul("a\u0000b\u0000")).toBe("ab");
  });

  it("parcourt les objets imbriqués", () => {
    expect(stripNul({ where: { email: "a\u0000b", n: { deep: ["x\u0000"] } }, k: 3, ok: true, nothing: null })).toEqual({
      where: { email: "ab", n: { deep: ["x"] } },
      k: 3,
      ok: true,
      nothing: null,
    });
  });

  it("parcourt un tableau d'objets", () => {
    expect(stripNul([{ a: "1\u0000" }, { a: "\u00002" }])).toEqual([{ a: "1" }, { a: "2" }]);
  });

  it("rend Date et Uint8Array tels quels, même instance", () => {
    const date = new Date();
    const bytes = new Uint8Array([0, 1, 2]);
    const out = stripNul({ date, bytes, buf: Buffer.from([0]) });
    expect(out.date).toBe(date);
    expect(out.bytes).toBe(bytes);
    expect(Array.from(out.bytes)).toEqual([0, 1, 2]);
  });

  it("ne modifie pas l'objet reçu", () => {
    const input = { a: "x\u0000", list: [{ b: "y\u0000" }] };
    const out = stripNul(input);
    expect(input).toEqual({ a: "x\u0000", list: [{ b: "y\u0000" }] });
    expect(out).not.toBe(input);
  });
});

describe("client de l'application (createDb), contre une vraie base", () => {
  let database: ReturnType<typeof createTestDatabase>;
  beforeAll(() => {
    database = createTestDatabase("nul");
  }, 60_000);
  afterAll(() => database?.drop());

  it("sans l'extension, PostgreSQL refuse le caractère nul", async () => {
    const plain = new PrismaClient({ datasourceUrl: database.url });
    try {
      await expect(plain.user.findUnique({ where: { email: "a\u0000b@x.mg" } })).rejects.toThrow();
    } finally {
      await plain.$disconnect();
    }
  });

  it("avec l'extension, la recherche rend null sans erreur", async () => {
    const safe = database.db;
    expect(await safe.user.findUnique({ where: { email: "a\u0000b@x.mg" } })).toBeNull();
  });

  it("avec l'extension, un nom enregistré perd son caractère nul", async () => {
    const safe = database.db;
    const user = await safe.user.create({ data: { name: "Ra\u0000do", email: "rado@x.mg", passwordHash: "x" } });
    expect(user.name).toBe("Rado");
  });
});
