"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseAmountToCents } from "@/lib/format";
import { invalid, type FormState } from "@/lib/form";
import { emailSchema } from "@/lib/schemas";

const amount = (msg: string) =>
  z.string().transform((v) => parseAmountToCents(v || "0")).refine((n) => Number.isInteger(n) && n >= 0, msg);

const promoSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,24}$/, "3 à 24 caractères : lettres, chiffres, tirets."),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.string().trim().min(1, "Indiquez une valeur."),
  minSubtotal: amount("Montant invalide."),
  maxUses: z.string().trim().optional(),
  expiresAt: z.string().trim().optional(),
});

export async function createPromo(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = promoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const value = d.type === "PERCENT" ? Number(d.value.replace(",", ".")) : parseAmountToCents(d.value);
  if (!Number.isInteger(value) || value <= 0 || (d.type === "PERCENT" && value > 90))
    return { fieldErrors: { value: d.type === "PERCENT" ? "Pourcentage entier entre 1 et 90." : "Montant invalide." } };
  const maxUses = d.maxUses ? Number(d.maxUses) : null;
  if (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 1)) return { fieldErrors: { maxUses: "Nombre entier positif." } };
  const expiresAt = d.expiresAt ? new Date(`${d.expiresAt}T23:59:59`) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return { fieldErrors: { expiresAt: "Date invalide." } };
  if (await db.promoCode.findUnique({ where: { code: d.code } })) return { fieldErrors: { code: "Ce code existe déjà." } };

  await db.promoCode.create({ data: { code: d.code, type: d.type, value, minSubtotalCents: d.minSubtotal, maxUses, expiresAt } });
  revalidatePath("/admin/promotions");
  return { ok: true, message: `Code ${d.code} créé.` };
}

export async function togglePromo(id: string, active: boolean) {
  await requireAdmin();
  await db.promoCode.update({ where: { id }, data: { active } });
  revalidatePath("/admin/promotions");
}

export async function deletePromo(id: string): Promise<FormState> {
  await requireAdmin();
  await db.promoCode.delete({ where: { id } });
  revalidatePath("/admin/promotions");
  return { ok: true, message: "Code supprimé." };
}

export async function setReviewStatus(id: string, status: "PUBLISHED" | "HIDDEN") {
  await requireAdmin();
  if (status !== "PUBLISHED" && status !== "HIDDEN") return;
  await db.review.update({ where: { id }, data: { status } });
  revalidatePath("/", "layout");
}

export async function deleteReview(id: string): Promise<FormState> {
  await requireAdmin();
  await db.review.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Avis supprimé." };
}

const settingsSchema = z.object({
  storeName: z.string().trim().min(1, "Le nom est requis.").max(40),
  contactEmail: emailSchema,
  currency: z.enum(["EUR", "USD", "CHF", "CAD", "MGA"]),
  announcement: z.string().trim().max(120).default(""),
  shippingStandard: amount("Montant invalide."),
  shippingExpress: amount("Montant invalide."),
  freeShippingThreshold: amount("Montant invalide."),
});

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { shippingStandard, shippingExpress, freeShippingThreshold, ...rest } = parsed.data;
  const data = {
    ...rest,
    shippingStandardCents: shippingStandard,
    shippingExpressCents: shippingExpress,
    freeShippingThresholdCents: freeShippingThreshold,
  };
  await db.storeSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Réglages enregistrés." };
}
