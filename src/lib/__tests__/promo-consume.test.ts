import type { Prisma } from "@prisma/client";
import type { Db } from "../db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "@/test/database";
import { consumePromo } from "../promo";

/*
 * Schéma PostgreSQL temporaire, créé depuis le schéma Prisma : la concurrence se prouve contre une vraie base,
 * pas contre une imitation. Des transactions envoyées en même temps, comme des commandes passées
 * à la même seconde avec un code déjà validé par leurs paniers.
 */
let database: ReturnType<typeof createTestDatabase>;
let db: Db;

beforeAll(() => {
  database = createTestDatabase("promo");
  db = database.db;
}, 60_000);

afterAll(() => database?.drop());

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

  // Vingt : sous SQLite (un seul écrivain à la fois), on s'arrêtait à cinq, les suivantes expiraient au bout de cinq secondes.
  it("ne dépasse jamais la limite, même avec vingt commandes simultanées", async () => {
    await create({ code: "TROIS", maxUses: 3 });
    const results = await Promise.all(Array.from({ length: 20 }, () => order("TROIS")));
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
