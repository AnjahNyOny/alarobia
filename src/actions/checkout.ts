"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { CART_COOKIE, PROMO_COOKIE, getCart } from "@/lib/cart";
import { shippingCost } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { invalid, type FormState } from "@/lib/form";
import { addressSchema, emailSchema } from "@/lib/schemas";

const checkoutSchema = addressSchema.extend({
  email: emailSchema,
  shippingMethod: z.enum(["STANDARD", "EXPRESS"]),
  paymentMethod: z.enum(["CARD", "COD"]),
  note: z.string().trim().max(500).optional(),
});

class StockError extends Error {}

export async function placeOrder(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  const [user, cart, settings] = await Promise.all([getUser(), getCart(), getSettings()]);
  if (cart.lines.length === 0) return { error: "Votre panier est vide." };
  const short = cart.lines.find((l) => l.insufficientStock);
  if (short) return { error: `Stock insuffisant pour « ${short.product.name} ». Ajustez votre panier.` };

  const shippingCents = shippingCost(data.shippingMethod, cart.subtotalCents - cart.discountCents, settings);
  const totalCents = cart.subtotalCents - cart.discountCents + shippingCents;
  const number = `SV-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;
  const { email, shippingMethod, paymentMethod, note, ...address } = data;

  let orderId: string;
  try {
    orderId = await db.$transaction(async (tx) => {
      // Décrément conditionnel : deux commandes simultanées ne peuvent pas vendre le même dernier exemplaire.
      for (const line of cart.lines) {
        const res = await tx.product.updateMany({
          where: { id: line.product.id, status: "ACTIVE", stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (res.count === 0) throw new StockError(line.product.name);
      }
      if (cart.promo) {
        await tx.promoCode.update({ where: { code: cart.promo.code }, data: { usedCount: { increment: 1 } } });
      }
      if (user) {
        await tx.address.upsert({ where: { userId: user.id }, update: address, create: { ...address, userId: user.id } });
      }
      const order = await tx.order.create({
        data: {
          number,
          userId: user?.id,
          email,
          // Paiement simulé : une carte est considérée comme encaissée. À remplacer par un vrai prestataire (voir README).
          status: paymentMethod === "CARD" ? "PAID" : "PENDING",
          paymentMethod,
          shippingMethod,
          subtotalCents: cart.subtotalCents,
          discountCents: cart.discountCents,
          shippingCents,
          totalCents,
          promoCode: cart.promo?.code,
          note: note || null,
          ...address,
          line2: address.line2 || null,
          items: {
            create: cart.lines.map((l) => ({
              productId: l.product.id,
              name: l.product.name,
              imageUrl: l.image,
              priceCents: l.product.priceCents,
              quantity: l.quantity,
            })),
          },
        },
      });
      return order.id;
    });
  } catch (e) {
    if (e instanceof StockError) return { error: `« ${e.message} » vient d'être vendu. Ajustez votre panier.` };
    throw e;
  }

  const store = await cookies();
  store.delete(CART_COOKIE);
  store.delete(PROMO_COOKIE);
  revalidatePath("/", "layout");
  redirect(`/commande/${orderId}`);
}
