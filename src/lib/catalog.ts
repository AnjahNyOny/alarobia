import type { Prisma } from "@prisma/client";

export const cardInclude = {
  images: { orderBy: { position: "asc" }, take: 2 },
  category: { include: { translations: true } },
  reviews: { where: { status: "PUBLISHED" }, select: { rating: true } },
  translations: true,
} satisfies Prisma.ProductInclude;

export type CardProduct = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export function ratingOf(reviews: { rating: number }[]) {
  if (reviews.length === 0) return { average: 0, count: 0 };
  return { average: reviews.reduce((s, r) => s + r.rating, 0) / reviews.length, count: reviews.length };
}

const NEW_DAYS = 14;
export function isNew(createdAt: Date) {
  return Date.now() - createdAt.getTime() < NEW_DAYS * 864e5;
}

export function discountPercent(priceCents: number, compareAtCents: number | null) {
  if (!compareAtCents || compareAtCents <= priceCents) return 0;
  return Math.round((1 - priceCents / compareAtCents) * 100);
}

export async function wishedIds(userId: string | undefined) {
  if (!userId) return new Set<string>();
  const { db } = await import("./db");
  const rows = await db.wishlistItem.findMany({ where: { userId }, select: { productId: true } });
  return new Set(rows.map((r) => r.productId));
}
