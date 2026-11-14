"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/constants";
import type { FormState } from "@/lib/form";

const VOID = ["CANCELLED", "REFUNDED"];

export async function updateOrder(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = z
    .object({ status: z.enum(ORDER_STATUSES), trackingNumber: z.string().trim().max(60).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Données invalides." };
  const { status, trackingNumber } = parsed.data;

  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return { error: "Commande introuvable." };
  if (VOID.includes(order.status) && !VOID.includes(status))
    return { error: "Une commande annulée ou remboursée ne peut pas être réactivée : son stock a déjà été remis en vente." };

  await db.$transaction(async (tx) => {
    // Annulation ou remboursement : les articles retournent en stock, une seule fois.
    if (!VOID.includes(order.status) && VOID.includes(status)) {
      for (const item of order.items) {
        if (item.productId)
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
    }
    await tx.order.update({ where: { id }, data: { status, trackingNumber: trackingNumber || null } });
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Commande mise à jour." };
}
