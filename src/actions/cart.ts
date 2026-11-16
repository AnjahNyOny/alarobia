"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { addCartLine, addResultState, getCart, PROMO_COOKIE, readCartEntries, writeCartEntries } from "@/lib/cart";
import { setEntryQuantity } from "@/lib/cart-lines";
import { evaluatePromo } from "@/lib/pricing";
import type { FormState } from "@/lib/form";
import { clientIp, createRateLimiter, withRateLimit } from "@/lib/rate-limit";

// Vingt codes inconnus par adresse et par dizaine de minutes : assez pour les fautes de frappe, pas pour essayer des codes au hasard.
const unknownPromosByIp = createRateLimiter({ limit: 20, windowMs: 10 * 60_000 });

export async function addToCart(productId: string, quantity = 1): Promise<FormState> {
  return addResultState(await addCartLine({ id: productId }, quantity));
}

/** `key` est la clé de la ligne (`lineKey`) : un produit peut occuper plusieurs lignes s'il est personnalisé. */
export async function setCartQuantity(key: string, quantity: number) {
  await writeCartEntries(setEntryQuantity(await readCartEntries(), key, quantity));
  revalidatePath("/", "layout");
}

export async function applyPromo(_: FormState, formData: FormData): Promise<FormState> {
  const code = String(formData.get("code") ?? "");
  // Le sous-total vient du panier résolu : il compte les suppléments de personnalisation.
  const subtotal = (await getCart()).subtotalCents;
  const outcome = await withRateLimit([[unknownPromosByIp, clientIp(await headers())]], () => evaluatePromo(code, subtotal), (r) => !r.ok && r.reason === "unknown");
  if (outcome.limited) return { error: (await getTranslations("errors"))("rateLimited", { minutes: outcome.minutes }) };
  const result = outcome.value;
  if (!result.ok) {
    const t = await getTranslations("errors");
    if (result.reason === "minimum") {
      const [{ currency }, locale] = await Promise.all([getSettings(), getLocale()]);
      return { error: t("promoMinimum", { amount: formatPrice(result.minSubtotalCents, currency, locale) }) };
    }
    return { error: t(({ empty: "promoEmpty", unknown: "promoUnknown", expired: "promoExpired", exhausted: "promoExhausted" } as const)[result.reason]) };
  }
  (await cookies()).set(PROMO_COOKIE, result.code, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  revalidatePath("/", "layout");
  return { ok: true, message: (await getTranslations("notices"))("promoApplied", { code: result.code }) };
}

export async function removePromo() {
  (await cookies()).delete(PROMO_COOKIE);
  revalidatePath("/", "layout");
}
