"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/constants";
import type { FormState } from "@/lib/form";
import { cancelOrder as cancel, changeOrderStatus, type StatusChange } from "@/lib/order-status";

/** Clé de `admin.errors` pour chaque refus. */
const REFUSAL: Record<Exclude<StatusChange, "ok">, string> = { notFound: "orderNotFound", closed: "orderClosed", changed: "orderChanged" };

export async function updateOrder(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const [t, n] = await Promise.all([getTranslations("admin.errors"), getTranslations("admin.notices")]);
  const parsed = z
    .object({ status: z.enum(ORDER_STATUSES), trackingNumber: z.string().trim().max(60).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t("orderInvalid") };
  const { status, trackingNumber } = parsed.data;

  const result = await changeOrderStatus(db, id, { status, trackingNumber: trackingNumber || null });
  if (result !== "ok") return { error: t(REFUSAL[result]) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: n("orderUpdated") };
}

/** Bouton « Annuler la commande » : même chemin que la liste « Statut », refusé si la commande est déjà close. */
export async function cancelOrder(id: string): Promise<FormState> {
  await requireAdmin();
  const [t, n] = await Promise.all([getTranslations("admin.errors"), getTranslations("admin.notices")]);
  const result = await cancel(db, id);
  if (result === "closed") return { error: t("orderAlreadyClosed") };
  if (result !== "ok") return { error: t(REFUSAL[result]) };
  // Toute la mise en page : le compteur des commandes à traiter et l'espace du client changent aussi.
  revalidatePath("/", "layout");
  return { ok: true, message: n("orderCancelled") };
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
