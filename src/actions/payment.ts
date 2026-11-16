"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import type { FormState } from "@/lib/form";
import { isMobileMoney, normalizePaymentReference } from "@/lib/payment";
import { createRateLimiter, withRateLimit } from "@/lib/rate-limit";

// Dix déclarations par commande et par dizaine de minutes : de quoi corriger une référence mal recopiée.
const declarationsByOrder = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

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
  const outcome = await withRateLimit(
    [[declarationsByOrder, orderId]],
    async () => (await db.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { paymentReference: reference, paymentDeclaredAt: new Date() } })).count,
    (count) => count > 0,
  );
  if (outcome.limited) return { error: t("formInvalid"), fieldErrors: { reference: t("rateLimited", { minutes: outcome.minutes }) } };
  if (outcome.value === 0) return { error: t("paymentClosed") };
  revalidatePath("/", "layout");
  return { ok: true, message: n("referenceSaved") };
}
