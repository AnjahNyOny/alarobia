import type { Db } from "../db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "@/test/database";
import { canCancel, cancelOrder, changeOrderStatus, isClosed } from "../order-status";

/*
 * Annulation depuis le back-office (bouton « Annuler la commande ») et changement de statut par la liste :
 * un seul chemin, qui relit la commande, refuse une commande close et rend le stock une seule fois.
 */
let database: ReturnType<typeof createTestDatabase>;
let db: Db;
let categoryId: string;
let n = 0;

beforeAll(async () => {
  database = createTestDatabase("order_status");
  db = database.db;
  categoryId = (await db.category.create({ data: { name: "Cuisine", slug: "cuisine" } })).id;
}, 60_000);

afterAll(() => database?.drop());

const product = (stock: number) => {
  const sku = `P-${n++}`;
  return db.product.create({ data: { name: sku, slug: sku.toLowerCase(), sku, description: "", priceCents: 1_000_000, stock, categoryId } });
};

const stockOf = async (id: string) => (await db.product.findUniqueOrThrow({ where: { id } })).stock;
const statusOf = async (id: string) => (await db.order.findUniqueOrThrow({ where: { id } })).status;

const makeOrder = (status: string, productId: string, quantity: number, extra: { trackingNumber?: string; paymentMethod?: string } = {}) =>
  db.order.create({
    data: {
      number: `T-${n++}`, email: "c@x.mg", status, paymentMethod: extra.paymentMethod ?? "COD", shippingZone: "Tana", trackingNumber: extra.trackingNumber,
      subtotalCents: 1, shippingCents: 0, totalCents: 1, fullName: "Rado", line1: "1 rue", city: "Tana", phone: "0340000000",
      items: { create: [{ productId, quantity, name: "x", priceCents: 1 }] },
    },
  });

describe("isClosed", () => {
  it("annulée et remboursée sont closes, les autres statuts non", () => {
    expect(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].map(isClosed)).toEqual([false, false, false, false, true, true]);
  });
});

describe("cancelOrder", () => {
  it("annule une commande payée, rend son stock et garde le numéro de suivi", async () => {
    const mug = await product(10);
    const order = await makeOrder("PAID", mug.id, 3, { trackingNumber: "TR-9", paymentMethod: "MVOLA" });
    expect(await cancelOrder(db, order.id)).toBe("ok");
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect([after.status, after.trackingNumber]).toEqual(["CANCELLED", "TR-9"]);
    expect(await stockOf(mug.id)).toBe(13);
  });

  it("refuse une commande livrée (le colis ne revient pas forcément) sans toucher au stock", async () => {
    const mug = await product(4);
    const order = await makeOrder("DELIVERED", mug.id, 1);
    expect(await cancelOrder(db, order.id)).toBe("delivered");
    expect([await statusOf(order.id), await stockOf(mug.id)]).toEqual(["DELIVERED", 4]);
  });

  it("canCancel : seules les commandes ni livrées ni closes ont le bouton", () => {
    expect(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].map(canCancel)).toEqual([true, true, true, false, false, false]);
  });

  it.each(["CANCELLED", "REFUNDED"])("refuse une commande déjà close (%s) sans toucher au stock", async (status) => {
    const mug = await product(7);
    const order = await makeOrder(status, mug.id, 2);
    expect(await cancelOrder(db, order.id)).toBe("closed");
    expect([await statusOf(order.id), await stockOf(mug.id)]).toEqual([status, 7]);
  });

  it("répond notFound pour une commande inexistante", async () => {
    expect(await cancelOrder(db, "inexistante")).toBe("notFound");
  });

  it("deux confirmations simultanées : une seule annule, le stock n'est rendu qu'une fois", async () => {
    const mug = await product(10);
    const order = await makeOrder("PENDING", mug.id, 2);
    const results = await Promise.all([cancelOrder(db, order.id), cancelOrder(db, order.id)]);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(results.filter((r) => r !== "ok")).toHaveLength(1);
    expect(await stockOf(mug.id)).toBe(12);
  });
});

describe("changeOrderStatus", () => {
  it("refuse de rouvrir une commande annulée", async () => {
    const mug = await product(5);
    const order = await makeOrder("CANCELLED", mug.id, 1);
    expect(await changeOrderStatus(db, order.id, { status: "PENDING", trackingNumber: null })).toBe("closed");
    expect(await statusOf(order.id)).toBe("CANCELLED");
  });

  it("passe d'annulée à remboursée sans rendre le stock une seconde fois", async () => {
    const mug = await product(5);
    const order = await makeOrder("CANCELLED", mug.id, 1);
    expect(await changeOrderStatus(db, order.id, { status: "REFUNDED", trackingNumber: null })).toBe("ok");
    expect([await statusOf(order.id), await stockOf(mug.id)]).toEqual(["REFUNDED", 5]);
  });

  it("enregistre le numéro de suivi donné", async () => {
    const mug = await product(5);
    const order = await makeOrder("PAID", mug.id, 1);
    expect(await changeOrderStatus(db, order.id, { status: "SHIPPED", trackingNumber: "COLIS-1" })).toBe("ok");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).trackingNumber).toBe("COLIS-1");
  });
});
