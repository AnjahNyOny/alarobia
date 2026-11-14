"use server";

import { cookies } from "next/headers";
import { redirectTo } from "@/i18n/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { CART_COOKIE, PROMO_COOKIE, getCart } from "@/lib/cart";
import { MAX_ORDER_CENTS, orderWithinLimit, shippingCost } from "@/lib/pricing";
import { formatPrice } from "@/lib/format";
import { estimateDelivery, madagascarTime } from "@/lib/shipping";
import { getSettings } from "@/lib/settings";
import { invalid, type FormState } from "@/lib/form";
import { getLocale, getTranslations } from "next-intl/server";
import { makeSchemas } from "@/lib/schemas";

class StockError extends Error {}

export async function placeOrder(_: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("errors");
  const schemas = makeSchemas(t);
  const parsed = schemas.address
    .extend({
      email: schemas.email,
      shippingZoneId: z.string(t("zoneRequired")).min(1, t("zoneRequired")),
      paymentMethod: z.enum(["CARD", "COD"]),
      note: z.string().trim().max(500).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, t("formInvalid"));
  const { email, shippingZoneId, paymentMethod, note, ...fields } = parsed.data;
  const address = { ...fields, line2: fields.line2 || null, country: "Madagascar" };

  const [user, cart, settings] = await Promise.all([getUser(), getCart(), getSettings()]);
  if (cart.lines.length === 0) return { error: t("cartEmpty") };
  const short = cart.lines.find((l) => l.insufficientStock);
  if (short) return { error: t("stockInsufficient", { name: short.product.name }) };

  // Le tarif vient de la zone en base, jamais du formulaire. Une zone fermée entre-temps n'est plus acceptée.
  const zone = await db.shippingZone.findFirst({ where: { id: shippingZoneId, active: true } });
  if (!zone) return { error: t("formInvalid"), fieldErrors: { shippingZoneId: t("zoneRequired") } };
  const shippingCents = shippingCost(zone, cart.subtotalCents - cart.discountCents, settings.freeShippingThresholdCents);
  const totalCents = cart.subtotalCents - cart.discountCents + shippingCents;
  if (!orderWithinLimit(totalCents)) return { error: t("orderTooLarge", { amount: formatPrice(MAX_ORDER_CENTS, settings.currency, await getLocale()) }) };
  const number = `SV-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;

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
          shippingZone: zone.name,
          estimatedDelivery: estimateDelivery(madagascarTime(), zone),
          subtotalCents: cart.subtotalCents,
          discountCents: cart.discountCents,
          shippingCents,
          totalCents,
          promoCode: cart.promo?.code,
          note: note || null,
          ...address,
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
    if (e instanceof StockError) return { error: t("justSold", { name: e.message }) };
    throw e;
  }

  const store = await cookies();
  store.delete(CART_COOKIE);
  store.delete(PROMO_COOKIE);
  revalidatePath("/", "layout");
  return redirectTo(`/order/${orderId}`);
}
