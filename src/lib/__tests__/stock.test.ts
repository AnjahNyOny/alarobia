import type { Db } from "../db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "@/test/database";
import { transitionOrder } from "../order-status";
import { releaseStock, reserveStock, type StockLine } from "../stock";

/*
 * Point de vigilance 9, contre une vraie base PostgreSQL (schéma temporaire) : la concurrence ne se prouve pas
 * contre une imitation. Chaque commande est une transaction, comme dans src/actions/checkout.ts.
 */
let database: ReturnType<typeof createTestDatabase>;
let db: Db;
let categoryId: string;

beforeAll(async () => {
  database = createTestDatabase("stock");
  db = database.db;
  categoryId = (await db.category.create({ data: { name: "Cuisine", slug: "cuisine" } })).id;
}, 60_000);

afterAll(() => database?.drop());

beforeEach(async () => {
  await db.product.deleteMany();
});

const product = (sku: string, stock: number, status = "ACTIVE") =>
  db.product.create({ data: { name: sku, slug: sku.toLowerCase(), sku, description: "", priceCents: 1_000_000, stock, status, categoryId } });

const stockOf = async (id: string) => (await db.product.findUniqueOrThrow({ where: { id } })).stock;

class Shortage extends Error {}

/** Une commande : la transaction est annulée dès qu'un produit manque. Renvoie le produit qui manque, ou `null`. */
const order = (lines: StockLine[]) =>
  db
    .$transaction(async (tx) => {
      const short = await reserveStock(tx, lines);
      if (short) throw new Shortage(short);
    })
    .then(
      () => null,
      (e) => {
        if (e instanceof Shortage) return e.message;
        throw e;
      },
    );

describe("reserveStock", () => {
  it("cinq exemplaires, vingt commandes simultanées : cinq passent, quinze sont refusées, le stock finit à 0", async () => {
    const mug = await product("DERNIERS", 5);
    const results = await Promise.all(Array.from({ length: 20 }, () => order([{ productId: mug.id, quantity: 1 }])));
    expect(results.filter((r) => r === null)).toHaveLength(5);
    expect(results.filter((r) => r === mug.id)).toHaveLength(15);
    expect(await stockOf(mug.id)).toBe(0);
  });

  it("annule toute la commande quand la seconde ligne manque : la première garde son stock", async () => {
    const mug = await product("TASSE", 3);
    const bottle = await product("GOURDE", 1);
    expect(await order([{ productId: mug.id, quantity: 1 }, { productId: bottle.id, quantity: 2 }])).toBe(bottle.id);
    expect(await stockOf(mug.id)).toBe(3);
    expect(await stockOf(bottle.id)).toBe(1);
  });

  it("vend le dernier exemplaire : une quantité égale au stock passe", async () => {
    const mug = await product("PILE", 2);
    expect(await order([{ productId: mug.id, quantity: 2 }])).toBeNull();
    expect(await stockOf(mug.id)).toBe(0);
  });

  it("additionne deux lignes du même produit (un objet personnalisé et un objet simple)", async () => {
    const mug = await product("DOUBLE", 3);
    expect(await order([{ productId: mug.id, quantity: 2 }, { productId: mug.id, quantity: 2 }])).toBe(mug.id);
    expect(await stockOf(mug.id)).toBe(3);
  });

  // Sans ordre fixe, A puis B d'un côté et B puis A de l'autre : chacune attend le verrou que l'autre tient,
  // PostgreSQL en annule une au bout d'une seconde (« deadlock detected ») et le client voit une erreur.
  it("deux paniers avec les mêmes produits dans un ordre inverse ne s'interbloquent pas", async () => {
    const mug = await product("CROISE-A", 100);
    const bottle = await product("CROISE-B", 100);
    const ab = [{ productId: mug.id, quantity: 1 }, { productId: bottle.id, quantity: 1 }];
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => order(i % 2 ? ab : [...ab].reverse())));
    expect(results).toEqual(Array(20).fill(null));
    expect([await stockOf(mug.id), await stockOf(bottle.id)]).toEqual([80, 80]);
  });

  it("refuse un produit retiré de la vente depuis la mise au panier", async () => {
    const mug = await product("RETIRE", 5, "DRAFT");
    expect(await order([{ productId: mug.id, quantity: 1 }])).toBe(mug.id);
    expect(await stockOf(mug.id)).toBe(5);
  });
});

describe("releaseStock", () => {
  it("remet les quantités de chaque ligne", async () => {
    const mug = await product("RENDU-A", 1);
    const bottle = await product("RENDU-B", 4);
    await db.$transaction((tx) => releaseStock(tx, [{ productId: bottle.id, quantity: 3 }, { productId: mug.id, quantity: 2 }]));
    expect([await stockOf(mug.id), await stockOf(bottle.id)]).toEqual([3, 7]);
  });
});

describe("transitionOrder", () => {
  let n = 0;
  const makeOrder = async (status: string, lines: { productId: string; quantity: number }[]) => {
    const created = await db.order.create({
      data: {
        number: `T-${Date.now()}-${n++}`, email: "c@x.mg", status, paymentMethod: "COD", shippingZone: "Tana",
        subtotalCents: 1, shippingCents: 0, totalCents: 1, fullName: "Rado", line1: "1 rue", city: "Tana", phone: "0340000000",
        items: { create: lines.map((l) => ({ ...l, name: "x", priceCents: 1 })) },
      },
      include: { items: true },
    });
    return created;
  };

  it("deux annulations simultanées : une seule réussit, le stock n'est rendu qu'une fois", async () => {
    const mug = await product("COURSE-A", 10);
    const bottle = await product("COURSE-B", 20);
    const order = await makeOrder("PENDING", [{ productId: mug.id, quantity: 2 }, { productId: bottle.id, quantity: 3 }]);
    const cancel = () => db.$transaction((tx) => transitionOrder(tx, order, { status: "CANCELLED", trackingNumber: null }));
    const results = await Promise.all([cancel(), cancel()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect([await stockOf(mug.id), await stockOf(bottle.id)]).toEqual([12, 23]);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
  });

  it("SHIPPED vers DELIVERED ne touche pas au stock", async () => {
    const mug = await product("LIVRE", 10);
    const order = await makeOrder("SHIPPED", [{ productId: mug.id, quantity: 2 }]);
    expect(await db.$transaction((tx) => transitionOrder(tx, order, { status: "DELIVERED", trackingNumber: "TR1" }))).toBe(true);
    expect(await stockOf(mug.id)).toBe(10);
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect([after.status, after.trackingNumber, after.paidAt !== null]).toEqual(["DELIVERED", "TR1", true]);
  });
});
