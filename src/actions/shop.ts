"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { defaultLocale, isLocale } from "@/i18n/routing";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { invalid, type FormState } from "@/lib/form";
import { notifyNewsletterConfirmation } from "@/lib/mail/notify";
import { requestSubscription } from "@/lib/newsletter";
import { getLocale, getTranslations } from "next-intl/server";
import { makeSchemas } from "@/lib/schemas";
import { clientIp, createRateLimiter, withRateLimit } from "@/lib/rate-limit";

// Dix inscriptions à la lettre d'information par adresse et par heure.
const subscriptionsByIp = createRateLimiter({ limit: 10, windowMs: 60 * 60_000 });

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

/**
 * Inscription à la lettre d'information (PLAN.md 7.13) : la confirmation part par e-mail, après la réponse, au plus une
 * fois par 24 h. La réponse est la même que l'adresse soit nouvelle, en attente ou déjà confirmée : le formulaire ne
 * dit à personne qui est inscrit.
 */
export async function subscribeNewsletter(_: FormState, formData: FormData): Promise<FormState> {
  const [t, n, locale] = await Promise.all([getTranslations("errors"), getTranslations("notices"), getLocale()]);
  const parsed = makeSchemas(t).email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: t("emailInvalid") };
  const outcome = await withRateLimit(
    [[subscriptionsByIp, clientIp(await headers())]],
    () => requestSubscription(db, parsed.data, isLocale(locale) ? locale : defaultLocale),
    () => true,
  );
  if (outcome.limited) return { error: t("rateLimited", { minutes: outcome.minutes }) };
  const pending = outcome.value;
  if (pending) after(() => notifyNewsletterConfirmation(db, pending));
  return { ok: true, message: n("newsletterDone") };
}
