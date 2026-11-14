"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { MAX_QTY, PROMO_COOKIE, readCartEntries, writeCartEntries } from "@/lib/cart";
import { evaluatePromo } from "@/lib/pricing";
import type { FormState } from "@/lib/form";

export async function addToCart(productId: string, quantity = 1): Promise<FormState> {
  if (!Number.isInteger(quantity) || quantity < 1) return { error: "Quantité invalide." };
  const product = await db.product.findFirst({ where: { id: productId, status: "ACTIVE" } });
  if (!product) return { error: "Ce produit n'est plus disponible." };

  const entries = await readCartEntries();
  const existing = entries.find((e) => e.id === productId);
  const wanted = (existing?.q ?? 0) + quantity;
  const allowed = Math.min(wanted, product.stock, MAX_QTY);
  if (allowed <= (existing?.q ?? 0))
    return { error: product.stock === 0 ? "Ce produit est en rupture de stock." : "Quantité maximale atteinte pour ce produit." };

  if (existing) existing.q = allowed;
  else entries.push({ id: productId, q: allowed });
  await writeCartEntries(entries);
  revalidatePath("/", "layout");
  return { ok: true, message: `${product.name} ajouté au panier.` };
}

export async function setCartQuantity(productId: string, quantity: number) {
  const entries = await readCartEntries();
  const next =
    quantity <= 0
      ? entries.filter((e) => e.id !== productId)
      : entries.map((e) => (e.id === productId ? { ...e, q: Math.min(Math.floor(quantity), MAX_QTY) } : e));
  await writeCartEntries(next);
  revalidatePath("/", "layout");
}

export async function applyPromo(_: FormState, formData: FormData): Promise<FormState> {
  const code = String(formData.get("code") ?? "");
  const entries = await readCartEntries();
  const products = await db.product.findMany({ where: { id: { in: entries.map((e) => e.id) }, status: "ACTIVE" } });
  const subtotal = entries.reduce((s, e) => s + (products.find((p) => p.id === e.id)?.priceCents ?? 0) * e.q, 0);
  const result = await evaluatePromo(code, subtotal);
  if (!result.ok) return { error: result.error };
  (await cookies()).set(PROMO_COOKIE, result.code, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  revalidatePath("/", "layout");
  return { ok: true, message: `Code ${result.code} appliqué.` };
}

export async function removePromo() {
  (await cookies()).delete(PROMO_COOKIE);
  revalidatePath("/", "layout");
}
