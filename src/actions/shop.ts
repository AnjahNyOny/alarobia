"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { invalid, type FormState } from "@/lib/form";
import { emailSchema } from "@/lib/schemas";

export async function toggleWishlist(productId: string): Promise<FormState & { active?: boolean }> {
  const user = await getUser();
  if (!user) return { error: "Connectez-vous pour enregistrer vos favoris." };
  const key = { userId_productId: { userId: user.id, productId } };
  const existing = await db.wishlistItem.findUnique({ where: key });
  if (existing) await db.wishlistItem.delete({ where: key });
  else {
    if (!(await db.product.findFirst({ where: { id: productId, status: "ACTIVE" } }))) return { error: "Produit introuvable." };
    await db.wishlistItem.create({ data: { userId: user.id, productId } });
  }
  revalidatePath("/", "layout");
  return { ok: true, active: !existing, message: existing ? "Retiré des favoris." : "Ajouté aux favoris." };
}

const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1, "Choisissez une note.").max(5),
  comment: z.string().trim().min(10, "Votre avis doit contenir au moins 10 caractères.").max(1000),
});

export async function submitReview(_: FormState, formData: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Connectez-vous pour donner votre avis." };
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { productId, rating, comment } = parsed.data;
  const product = await db.product.findFirst({ where: { id: productId, status: "ACTIVE" } });
  if (!product) return { error: "Produit introuvable." };
  await db.review.upsert({
    where: { productId_userId: { productId, userId: user.id } },
    update: { rating, comment },
    create: { productId, userId: user.id, rating, comment },
  });
  revalidatePath(`/produits/${product.slug}`);
  return { ok: true, message: "Merci, votre avis est publié." };
}

export async function subscribeNewsletter(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Adresse e-mail invalide." };
  await db.newsletterSubscriber.upsert({ where: { email: parsed.data }, update: {}, create: { email: parsed.data } });
  return { ok: true, message: "Inscription confirmée. À très vite." };
}
