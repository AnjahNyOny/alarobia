"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { invalid, type FormState } from "@/lib/form";
import { getTranslations } from "next-intl/server";
import { makeSchemas } from "@/lib/schemas";

export async function toggleWishlist(productId: string): Promise<FormState & { active?: boolean }> {
  const [user, t, n] = await Promise.all([getUser(), getTranslations("errors"), getTranslations("notices")]);
  if (!user) return { error: t("loginForWishlist") };
  const key = { userId_productId: { userId: user.id, productId } };
  const existing = await db.wishlistItem.findUnique({ where: key });
  if (existing) await db.wishlistItem.delete({ where: key });
  else {
    if (!(await db.product.findFirst({ where: { id: productId, status: "ACTIVE" } }))) return { error: t("productNotFound") };
    await db.wishlistItem.create({ data: { userId: user.id, productId } });
  }
  revalidatePath("/", "layout");
  return { ok: true, active: !existing, message: existing ? n("wishlistRemoved") : n("wishlistAdded") };
}

export async function submitReview(_: FormState, formData: FormData): Promise<FormState> {
  const [user, t, n] = await Promise.all([getUser(), getTranslations("errors"), getTranslations("notices")]);
  if (!user) return { error: t("loginForReview") };
  const parsed = z
    .object({
      productId: z.string().min(1),
      rating: z.coerce.number().int().min(1, t("ratingRequired")).max(5),
      comment: z.string().trim().min(10, t("reviewMin")).max(1000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, t("formInvalid"));
  const { productId, rating, comment } = parsed.data;
  const product = await db.product.findFirst({ where: { id: productId, status: "ACTIVE" } });
  if (!product) return { error: t("productNotFound") };
  await db.review.upsert({
    where: { productId_userId: { productId, userId: user.id } },
    update: { rating, comment },
    create: { productId, userId: user.id, rating, comment },
  });
  revalidatePath(`/products/${product.slug}`);
  return { ok: true, message: n("reviewPublished") };
}

export async function subscribeNewsletter(_: FormState, formData: FormData): Promise<FormState> {
  const [t, n] = await Promise.all([getTranslations("errors"), getTranslations("notices")]);
  const parsed = makeSchemas(t).email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: t("emailInvalid") };
  await db.newsletterSubscriber.upsert({ where: { email: parsed.data }, update: {}, create: { email: parsed.data } });
  return { ok: true, message: n("newsletterDone") };
}
