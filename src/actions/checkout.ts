"use server";

import { cookies, headers } from "next/headers";
import { redirectTo } from "@/i18n/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { CART_COOKIE, PROMO_COOKIE, designOf, getCart } from "@/lib/cart";
import { availablePaymentMethods, PAYMENT_METHODS } from "@/lib/payment";
import { MAX_ORDER_CENTS, orderWithinLimit, shippingCost } from "@/lib/pricing";
import { formatPrice } from "@/lib/format";
import { estimateDelivery, madagascarTime } from "@/lib/shipping";
import { getSettings } from "@/lib/settings";
import { invalid, type FormState } from "@/lib/form";
import { getLocale, getTranslations } from "next-intl/server";
import { makeSchemas } from "@/lib/schemas";
import { consumePromo } from "@/lib/promo";
import { reserveStock } from "@/lib/stock";
import { clientIp, createRateLimiter, withRateLimit } from "@/lib/rate-limit";

class StockError extends Error {}
class PromoError extends Error {}

// Quarante commandes passées par adresse et par dizaine de minutes : une commande réserve du stock,
// des commandes en série pourraient vider la boutique. Les tentatives refusées (formulaire, stock) ne comptent pas.
const ordersByIp = createRateLimiter({ limit: 40, windowMs: 10 * 60_000 });

export async function placeOrder(_: FormState, formData: FormData): Promise<FormState> {
  const outcome = await withRateLimit([[ordersByIp, clientIp(await headers())]], () => createOrder(formData), (result) => typeof result === "string");
  if (outcome.limited) return { error: (await getTranslations("errors"))("rateLimited", { minutes: outcome.minutes }) };
  if (typeof outcome.value !== "string") return outcome.value;

  const store = await cookies();
  store.delete(CART_COOKIE);
  store.delete(PROMO_COOKIE);
  revalidatePath("/", "layout");
  return redirectTo(`/order/${outcome.value}`);
}

/** Crée la commande et renvoie son identifiant, ou l'état du formulaire à réafficher. */
async function createOrder(formData: FormData): Promise<FormState | string> {
  const t = await getTranslations("errors");
  const schemas = makeSchemas(t);
  const parsed = schemas.address
    .extend({
      email: schemas.email,
      shippingZoneId: z.string(t("zoneRequired")).min(1, t("zoneRequired")),
      paymentMethod: z.enum(PAYMENT_METHODS, t("paymentUnavailable")),
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
  if (!availablePaymentMethods(settings).includes(paymentMethod)) return { error: t("formInvalid"), fieldErrors: { paymentMethod: t("paymentUnavailable") } };
  if (!zone) return { error: t("formInvalid"), fieldErrors: { shippingZoneId: t("zoneRequired") } };
  const shippingCents = shippingCost(zone, cart.subtotalCents - cart.discountCents, settings.freeShippingThresholdCents);
  const totalCents = cart.subtotalCents - cart.discountCents + shippingCents;
  if (!orderWithinLimit(totalCents)) return { error: t("orderTooLarge", { amount: formatPrice(MAX_ORDER_CENTS, settings.currency, await getLocale()) }) };
  const number = `AL-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;

  let orderId: string;
  try {
    orderId = await db.$transaction(async (tx) => {
      // Décrément conditionnel : deux commandes simultanées ne peuvent pas vendre le même dernier exemplaire.
      const short = await reserveStock(tx, cart.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })));
      if (short) throw new StockError(cart.lines.find((l) => l.product.id === short)?.product.name ?? "");
      // Même principe pour le code promo : épuisé, expiré ou coupé depuis la validation du panier, il annule tout (stock compris).
      if (cart.promo && !(await consumePromo(tx, cart.promo.code))) throw new PromoError(cart.promo.code);
      if (user) {
        await tx.address.upsert({ where: { userId: user.id }, update: address, create: { ...address, userId: user.id } });
      }
      const order = await tx.order.create({
        data: {
          number,
          userId: user?.id,
          email,
          // Toujours « en attente » : le Mobile Money est confirmé par le vendeur après vérification, la livraison se paie au livreur.
          status: "PENDING",
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
              priceCents: l.unitCents,
              quantity: l.quantity,
              // Copie figée : la commande ne dépend plus de la personnalisation ni du produit, qui peuvent changer.
              customization: l.customization ? JSON.stringify({ template: l.product.customTemplate, ...designOf(l.customization) }) : null,
              printUrl: l.customization?.print ? `/uploads/${l.customization.print}` : null,
            })),
          },
        },
      });
      // Une personnalisation commandée n'est plus jamais nettoyée : ses fichiers servent au vendeur.
      const ordered = cart.lines.flatMap((l) => (l.customization ? [l.customization.id] : []));
      if (ordered.length) await tx.customization.updateMany({ where: { id: { in: ordered }, orderedAt: null }, data: { orderedAt: new Date() } });
      return order.id;
    });
  } catch (e) {
    if (e instanceof StockError) return { error: t("justSold", { name: e.message }) };
    if (e instanceof PromoError) {
      // Le code est retiré : le panier se réaffiche sans la remise, que le client vérifie avant de valider à nouveau.
      (await cookies()).delete(PROMO_COOKIE);
      revalidatePath("/", "layout");
      return { error: t("promoNoLongerValid", { code: e.message }) };
    }
    throw e;
  }
  return orderId;
}
