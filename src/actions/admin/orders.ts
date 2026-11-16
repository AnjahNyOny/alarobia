"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/constants";
import type { FormState } from "@/lib/form";
import { isMobileMoney } from "@/lib/payment";

const VOID = ["CANCELLED", "REFUNDED"];

export async function updateOrder(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const [t, n] = await Promise.all([getTranslations("admin.errors"), getTranslations("admin.notices")]);
  const parsed = z
    .object({ status: z.enum(ORDER_STATUSES), trackingNumber: z.string().trim().max(60).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t("orderInvalid") };
  const { status, trackingNumber } = parsed.data;

  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return { error: t("orderNotFound") };
  if (VOID.includes(order.status) && !VOID.includes(status)) return { error: t("orderClosed") };

  await db.$transaction(async (tx) => {
    // Annulation ou remboursement : les articles retournent en stock, une seule fois.
    if (!VOID.includes(order.status) && VOID.includes(status)) {
      for (const item of order.items) {
        if (item.productId)
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
    }
    // Date d'encaissement : au passage à « payée », ou à la remise du colis pour un paiement à la livraison.
    const collected = status === "PAID" || (status === "DELIVERED" && !isMobileMoney(order.paymentMethod));
    await tx.order.update({ where: { id }, data: { status, trackingNumber: trackingNumber || null, ...(collected && !order.paidAt && { paidAt: new Date() }) } });
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: n("orderUpdated") };
}

/** Le vendeur a vérifié sur son téléphone que l'argent est arrivé : la commande passe d'« en attente » à « payée ». */
export async function markPaid(id: string): Promise<FormState> {
  await requireAdmin();
  const [t, n] = await Promise.all([getTranslations("admin.errors"), getTranslations("admin.notices")]);
  // Condition sur le statut dans l'écriture : sans effet sur une commande déjà traitée ou annulée entre-temps.
  const { count } = await db.order.updateMany({ where: { id, status: "PENDING" }, data: { status: "PAID", paidAt: new Date() } });
  if (count === 0) return { error: t("orderNotPending") };
  revalidatePath("/", "layout");
  return { ok: true, message: n("paymentConfirmed") };
}
