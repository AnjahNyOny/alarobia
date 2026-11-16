import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { consumePromo } from "../promo";

/*
 * Base SQLite temporaire, créée depuis le schéma : la concurrence se prouve contre une vraie base,
 * pas contre une imitation. Deux transactions envoyées en même temps, comme deux commandes passées
 * à la même seconde avec un code déjà validé par leurs deux paniers.
 */
const dir = mkdtempSync(path.join(tmpdir(), "alarobia-promo-"));
const url = `file:${path.join(dir, "promo.db")}`;
let db: PrismaClient;

beforeAll(() => {
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
  db = new PrismaClient({ datasourceUrl: url });
}, 60_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.promoCode.deleteMany();
});

const create = (data: Partial<Prisma.PromoCodeCreateInput> & { code: string }) => db.promoCode.create({ data: { type: "PERCENT", value: 10, ...data } });

/** Une commande : le panier a validé le code (hors transaction), puis la transaction le consomme. */
async function order(code: string) {
  const seen = await db.promoCode.findUnique({ where: { code } });
  if (!seen || (seen.maxUses != null && seen.usedCount >= seen.maxUses)) return false;
  return db.$transaction((tx) => consumePromo(tx, code));
}

describe("consumePromo", () => {
  it("ne laisse passer qu'une commande sur deux simultanées avec un code à une utilisation", async () => {
    await create({ code: "UNEFOIS", maxUses: 1 });
    const results = await Promise.all([order("UNEFOIS"), order("UNEFOIS")]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await db.promoCode.findUniqueOrThrow({ where: { code: "UNEFOIS" } })).usedCount).toBe(1);
  });

  // Cinq et pas davantage : au-delà d'une dizaine de transactions simultanées, SQLite (un seul écrivain à la fois)
  // fait expirer les suivantes au bout de cinq secondes, avec ou sans code promo. Limite connue de la base, pas de ce code.
  it("ne dépasse jamais la limite, même avec cinq commandes simultanées", async () => {
    await create({ code: "TROIS", maxUses: 3 });
    const results = await Promise.all(Array.from({ length: 5 }, () => order("TROIS")));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect((await db.promoCode.findUniqueOrThrow({ where: { code: "TROIS" } })).usedCount).toBe(3);
  });

  it("compte chaque utilisation d'un code sans limite", async () => {
    await create({ code: "LIBRE" });
    expect(await Promise.all(Array.from({ length: 5 }, () => order("LIBRE")))).toEqual([true, true, true, true, true]);
    expect((await db.promoCode.findUniqueOrThrow({ where: { code: "LIBRE" } })).usedCount).toBe(5);
  });

  it("refuse un code désactivé ou expiré entre la validation du panier et la commande", async () => {
    await create({ code: "COUPE", active: false });
    await create({ code: "PASSE", expiresAt: new Date(Date.now() - 1000) });
    expect(await db.$transaction((tx) => consumePromo(tx, "COUPE"))).toBe(false);
    expect(await db.$transaction((tx) => consumePromo(tx, "PASSE"))).toBe(false);
    expect((await db.promoCode.findMany({ select: { usedCount: true } })).map((p) => p.usedCount)).toEqual([0, 0]);
  });

  it("refuse un code qui n'existe plus", async () => {
    expect(await db.$transaction((tx) => consumePromo(tx, "DISPARU"))).toBe(false);
  });
});
