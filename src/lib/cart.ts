import "server-only";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import type { Customization } from "@prisma/client";
import { addEntry, lineKey, MAX_QTY, parseCartEntries, quantityOf, type CartEntry } from "./cart-lines";
import { customizedUnitPrice, customizerOptions, describeDesign, type Design } from "./customization";
import { db } from "./db";
import type { FormState } from "./form";
import { localize } from "./localize";
import { evaluatePromo } from "./pricing";

export const CART_COOKIE = "cart";
export const PROMO_COOKIE = "promo";
const MAX_AGE = 60 * 60 * 24 * 30;
export { MAX_QTY };

export async function readCartEntries(): Promise<CartEntry[]> {
  return parseCartEntries((await cookies()).get(CART_COOKIE)?.value);
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

export type AddResult = { ok: true; name: string } | { ok: false; reason: "quantity" | "unavailable" | "outOfStock" | "max" };

/**
 * Ajoute une ligne au panier. N'est pas une action serveur : l'identifiant de personnalisation
 * ne vient jamais directement du navigateur, c'est `actions/customizer.ts` qui le crée et le passe ici.
 */
export async function addCartLine(target: Pick<CartEntry, "id" | "c">, quantity: number): Promise<AddResult> {
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: "quantity" };
  const product = await db.product.findFirst({ where: { id: target.id, status: "ACTIVE" } });
  if (!product) return { ok: false, reason: "unavailable" };
  const { entries, added } = addEntry(await readCartEntries(), target, quantity, product.stock);
  if (added === 0) return { ok: false, reason: product.stock === 0 ? "outOfStock" : "max" };
  await writeCartEntries(entries);
  revalidatePath("/", "layout");
  return { ok: true, name: product.name };
}

/** Traduit le résultat d'un ajout au panier dans la langue du visiteur. */
export async function addResultState(result: AddResult): Promise<FormState> {
  if (result.ok) return { ok: true, message: (await getTranslations("notices"))("addedToCart", { name: result.name }) };
  const t = await getTranslations("errors");
  return { error: t(({ quantity: "quantityInvalid", unavailable: "productUnavailable", outOfStock: "outOfStock", max: "maxQuantity" } as const)[result.reason]) };
}

/** Champs d'une personnalisation qui forment le dessin (le reste : fichiers et dates). */
export function designOf(c: Customization): Design {
  return { color: c.color, text: c.text, font: c.font, ink: c.ink, textSize: c.textSize, textY: c.textY, image: c.image, imageSize: c.imageSize, imageX: c.imageX, imageY: c.imageY } as Design;
}

/** Panier résolu contre la base : prix et stocks viennent toujours du serveur, jamais du cookie. */
export const getCart = cache(async () => {
  const [entries, locale] = await Promise.all([readCartEntries(), getLocale()]);
  const customIds = entries.flatMap((e) => (e.c ? [e.c] : []));
  const [products, customizations] = await Promise.all([
    entries.length
      ? db.product.findMany({
          where: { id: { in: entries.map((e) => e.id) }, status: "ACTIVE" },
          include: { images: { orderBy: { position: "asc" }, take: 1 }, translations: true },
        })
      : [],
    customIds.length ? db.customization.findMany({ where: { id: { in: customIds } } }) : [],
  ]);
  const lines = entries.flatMap((e) => {
    const product = products.find((p) => p.id === e.id);
    if (!product) return [];
    // Une personnalisation disparue (nettoyée), d'un autre produit ou d'un produit qui n'est plus personnalisable : la ligne tombe.
    const options = customizerOptions(product);
    const customization = e.c ? customizations.find((c) => c.id === e.c && c.productId === product.id) : null;
    if (e.c && (!customization || !options)) return [];
    const unitCents = customization && options ? customizedUnitPrice(product.priceCents, options, customization) : product.priceCents;
    return [
      {
        key: lineKey(e),
        product,
        customization: customization ?? null,
        /** Résumé affichable de la personnalisation (couleur, texte, image), ou null pour un article simple. */
        custom: customization ? describeDesign(customization) : null,
        // Nom dans la langue du visiteur, pour l'affichage. `product.name` reste le nom français, celui qu'enregistre la commande.
        displayName: localize(product, locale, ["name"]).name,
        quantity: e.q,
        /** Quantité maximale de cette ligne : le stock, moins ce que prennent les autres lignes du même produit. */
        maxQuantity: Math.min(MAX_QTY, product.stock - (quantityOf(entries, product.id) - e.q)),
        // L'aperçu de l'objet personnalisé remplace la photo du produit.
        image: (customization?.preview ? `/uploads/${customization.preview}` : null) ?? product.images[0]?.url ?? null,
        unitCents,
        lineTotalCents: unitCents * e.q,
        // Le stock est partagé entre toutes les lignes d'un même produit.
        insufficientStock: product.stock < quantityOf(entries, product.id),
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
