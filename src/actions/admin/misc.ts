"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseAmountToCents } from "@/lib/format";
import { invalid, type FormState } from "@/lib/form";
import { checkMerchantNumber, OPERATOR_NAME } from "@/lib/payment";

const amount = (msg: string) =>
  z.string().transform((v) => parseAmountToCents(v || "0")).refine((n) => Number.isInteger(n) && n >= 0, msg);

type ErrorT = Awaited<ReturnType<typeof getTranslations<"admin.errors">>>;

function promoSchema(t: ErrorT) {
  return z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,24}$/, t("promoCodeFormat")),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.string().trim().min(1, t("promoValueRequired")),
    minSubtotal: amount(t("amountInvalid")),
    maxUses: z.string().trim().optional(),
    expiresAt: z.string().trim().optional(),
  });
}

export async function createPromo(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const [t, tn] = await Promise.all([getTranslations("admin.errors"), getTranslations("admin.notices")]);
  const parsed = promoSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, t("formInvalid"));
  const d = parsed.data;
  const value = d.type === "PERCENT" ? Number(d.value.replace(",", ".")) : parseAmountToCents(d.value);
  if (!Number.isInteger(value) || value <= 0 || (d.type === "PERCENT" && value > 90))
    return { fieldErrors: { value: d.type === "PERCENT" ? t("promoPercentInvalid") : t("amountInvalid") } };
  const maxUses = d.maxUses ? Number(d.maxUses) : null;
  if (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 1)) return { fieldErrors: { maxUses: t("promoMaxUsesInvalid") } };
  const expiresAt = d.expiresAt ? new Date(`${d.expiresAt}T23:59:59`) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return { fieldErrors: { expiresAt: t("dateInvalid") } };
  if (await db.promoCode.findUnique({ where: { code: d.code } })) return { fieldErrors: { code: t("promoCodeTaken") } };

  await db.promoCode.create({ data: { code: d.code, type: d.type, value, minSubtotalCents: d.minSubtotal, maxUses, expiresAt } });
  revalidatePath("/admin/promotions");
  return { ok: true, message: tn("promoCreated", { code: d.code }) };
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
  return { ok: true, message: (await getTranslations("admin.notices"))("promoDeleted") };
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
  return { ok: true, message: (await getTranslations("admin.notices"))("reviewDeleted") };
}

function settingsSchema(t: ErrorT) {
  return z.object({
    storeName: z.string().trim().min(1, t("nameRequired")).max(40, t("tooLong", { max: 40 })),
    contactEmail: z.string().trim().toLowerCase().pipe(z.email(t("emailInvalid"))),
    currency: z.enum(["EUR", "USD", "CHF", "CAD", "MGA"]),
    announcement: z.string().trim().max(120, t("tooLong", { max: 120 })).default(""),
    announcementEn: z.string().trim().max(120, t("tooLong", { max: 120 })).default(""),
    announcementMg: z.string().trim().max(120, t("tooLong", { max: 120 })).default(""),
    freeShippingThreshold: amount(t("amountInvalid")),
    mvolaNumber: z.string().default(""),
    orangeMoneyNumber: z.string().default(""),
    airtelMoneyNumber: z.string().default(""),
    mobileMoneyName: z.string().trim().max(60, t("tooLong", { max: 60 })).default(""),
  });
}

const NUMBER_FIELDS = [
  ["MVOLA", "mvolaNumber"],
  ["ORANGE_MONEY", "orangeMoneyNumber"],
  ["AIRTEL_MONEY", "airtelMoneyNumber"],
] as const;

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const [t, tn] = await Promise.all([getTranslations("admin.errors"), getTranslations("admin.notices")]);
  const parsed = settingsSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, t("formInvalid"));
  const { freeShippingThreshold, ...rest } = parsed.data;
  const data = { ...rest, freeShippingThresholdCents: freeShippingThreshold };

  // Un numéro du mauvais réseau ferait envoyer l'argent du client à quelqu'un d'autre : on le refuse ici.
  const fieldErrors: Record<string, string> = {};
  for (const [method, field] of NUMBER_FIELDS) {
    const checked = checkMerchantNumber(method, data[field]);
    if (checked.ok) data[field] = checked.value;
    else fieldErrors[field] = checked.reason === "invalid" ? t("numberInvalid") : t("numberWrongNetwork", { operator: OPERATOR_NAME[method], prefixes: t(`prefixes.${method}`) });
  }
  if (Object.keys(fieldErrors).length > 0) return { error: t("formInvalid"), fieldErrors };
  await db.storeSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  revalidatePath("/", "layout");
  return { ok: true, message: tn("settingsSaved") };
}
