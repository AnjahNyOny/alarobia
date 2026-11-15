"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import type { FormState } from "@/lib/form";
import { isMobileMoney, normalizePaymentReference } from "@/lib/payment";

/**
 * Le client indique la référence de sa transaction Mobile Money. La commande reste « en attente » :
 * seul le vendeur, après avoir vérifié qu'il a reçu l'argent, la passe à « payée » dans le back-office.
 */
export async function declarePayment(orderId: string, _: FormState, formData: FormData): Promise<FormState> {
  const [t, n, user] = await Promise.all([getTranslations("errors"), getTranslations("notices"), getUser()]);
  const order = await db.order.findUnique({ where: { id: orderId }, select: { userId: true, status: true, paymentMethod: true } });
  // Même règle que la page de la commande : celle d'un compte n'appartient qu'à ce compte, celle d'un invité se retrouve par son lien non devinable.
  if (!order || (order.userId && order.userId !== user?.id && user?.role !== "ADMIN")) return { error: t("paymentClosed") };
  if (!isMobileMoney(order.paymentMethod) || order.status !== "PENDING") return { error: t("paymentClosed") };

  const reference = normalizePaymentReference(String(formData.get("reference") ?? ""));
  if (!reference) return { error: t("formInvalid"), fieldErrors: { reference: t("referenceInvalid") } };

  // Condition sur le statut dans l'écriture elle-même : une commande annulée entre-temps n'est pas modifiée.
  const { count } = await db.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { paymentReference: reference, paymentDeclaredAt: new Date() } });
  if (count === 0) return { error: t("paymentClosed") };
  revalidatePath("/", "layout");
  return { ok: true, message: n("referenceSaved") };
}
