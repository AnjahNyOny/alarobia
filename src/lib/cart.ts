import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "./db";
import { evaluatePromo } from "./pricing";

export const CART_COOKIE = "cart";
export const PROMO_COOKIE = "promo";
const MAX_AGE = 60 * 60 * 24 * 30;
export const MAX_QTY = 10;

type CartEntry = { id: string; q: number };

export async function readCartEntries(): Promise<CartEntry[]> {
  const raw = (await cookies()).get(CART_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.id === "string" && Number.isInteger(e.q) && e.q > 0)
      .map((e) => ({ id: e.id, q: Math.min(e.q, MAX_QTY) }))
      .slice(0, 50);
  } catch {
    return [];
  }
}

export async function writeCartEntries(entries: CartEntry[]) {
  const store = await cookies();
  if (entries.length === 0) store.delete(CART_COOKIE);
  else
    store.set(CART_COOKIE, JSON.stringify(entries), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE,
    });
}

/** Panier résolu contre la base : prix et stocks viennent toujours du serveur, jamais du cookie. */
export const getCart = cache(async () => {
  const entries = await readCartEntries();
  const products = entries.length
    ? await db.product.findMany({
        where: { id: { in: entries.map((e) => e.id) }, status: "ACTIVE" },
        include: { images: { orderBy: { position: "asc" }, take: 1 } },
      })
    : [];
  const lines = entries.flatMap((e) => {
    const product = products.find((p) => p.id === e.id);
    if (!product) return [];
    return [
      {
        product,
        quantity: e.q,
        image: product.images[0]?.url ?? null,
        lineTotalCents: product.priceCents * e.q,
        insufficientStock: product.stock < e.q,
      },
    ];
  });
  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);

  const promoCode = (await cookies()).get(PROMO_COOKIE)?.value;
  const promo = promoCode && lines.length ? await evaluatePromo(promoCode, subtotalCents) : null;

  return {
    lines,
    count,
    subtotalCents,
    promo: promo?.ok ? promo : null,
    discountCents: promo?.ok ? promo.discountCents : 0,
  };
});

export type Cart = Awaited<ReturnType<typeof getCart>>;
