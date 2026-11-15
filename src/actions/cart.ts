"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { addCartLine, addResultState, getCart, PROMO_COOKIE, readCartEntries, writeCartEntries } from "@/lib/cart";
import { setEntryQuantity } from "@/lib/cart-lines";
import { evaluatePromo } from "@/lib/pricing";
import type { FormState } from "@/lib/form";

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
  const result = await evaluatePromo(code, subtotal);
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
