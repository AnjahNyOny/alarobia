"use server";

import { redirectTo } from "@/i18n/server";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PRODUCT_STATUSES } from "@/lib/constants";
import { MAX_TEXT, parseCustomSettings } from "@/lib/customization";
import { formatPrice, parseAmountToCents, slugify } from "@/lib/format";
import { toFieldErrors, type FormState } from "@/lib/form";
import { MAX_ORDER_CENTS } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

type T = Awaited<ReturnType<typeof getTranslations<"admin.errors">>>;

const TRANSLATED = ["en", "mg"] as const;

/** Texte facultatif borné (accroche, caractéristiques, traductions) : vide accepté, jamais de minimum. */
const text = (t: T, max: number) => z.string().trim().max(max, t("tooLong", { max })).default("");

function productSchema(t: T) {
  const translations = Object.fromEntries(
    TRANSLATED.flatMap((l) => [
      [`name_${l}`, text(t, 120)],
      [`tagline_${l}`, text(t, 140)],
      [`description_${l}`, text(t, 5000)],
      [`details_${l}`, text(t, 3000)],
    ]),
  ) as Record<`${"name" | "tagline" | "description" | "details"}_${(typeof TRANSLATED)[number]}`, ReturnType<typeof text>>;
  return z.object({
    name: z.string().trim().min(2, t("nameRequired")).max(120, t("tooLong", { max: 120 })),
    slug: z.string().trim().max(140, t("tooLong", { max: 140 })).optional(),
    tagline: text(t, 140),
    description: z.string().trim().min(10, t("descriptionMin")).max(5000, t("tooLong", { max: 5000 })),
    details: text(t, 3000),
    price: z
      .string(t("priceInvalid"))
      .transform((v) => parseAmountToCents(v))
      .refine((n) => Number.isInteger(n) && n > 0 && n <= MAX_ORDER_CENTS, t("priceInvalid")),
    compareAt: z.string().trim().optional(),
    sku: z.string(t("skuRequired")).trim().min(1, t("skuRequired")).max(40, t("tooLong", { max: 40 })),
    stock: z.coerce.number(t("stockInvalid")).int(t("stockInvalid")).min(0, t("stockNegative")),
    status: z.enum(PRODUCT_STATUSES, t("statusInvalid")),
    categoryId: z.string(t("categoryRequired")).min(1, t("categoryRequired")),
    featured: z.string().optional(),
    images: z.string().default("[]"),
    ...translations,
  });
}

export async function saveProduct(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const [t, { currency }, locale] = await Promise.all([getTranslations("admin.errors"), getSettings(), getLocale()]);
  const parsed = productSchema(t).safeParse(Object.fromEntries(formData));
  // Plusieurs cases du même nom : getAll, Object.fromEntries n'en garderait qu'une.
  const custom = parseCustomSettings(
    {
      template: String(formData.get("customTemplate") ?? ""),
      colors: formData.getAll("customColors").map(String),
      textMax: String(formData.get("customTextMax") ?? ""),
      image: formData.get("customImage") === "on",
      surcharge: String(formData.get("customSurcharge") ?? ""),
    },
    parsed.success ? parsed.data.price : parseAmountToCents(String(formData.get("price") ?? "")),
  );
  if (!parsed.success || !custom.ok) {
    const fieldErrors = parsed.success ? {} : toFieldErrors(parsed.error);
    if (!custom.ok)
      for (const [field, code] of Object.entries(custom.errors))
        fieldErrors[field] = t(`custom.${code}`, { max: code === "textMax" ? MAX_TEXT : formatPrice(MAX_ORDER_CENTS, currency, locale) });
    return { error: t("formInvalid"), fieldErrors };
  }
  const d = parsed.data;

  let compareAtCents: number | null = null;
  if (d.compareAt) {
    compareAtCents = parseAmountToCents(d.compareAt);
    if (!Number.isInteger(compareAtCents) || compareAtCents <= d.price) return { error: t("formInvalid"), fieldErrors: { compareAt: t("compareAtInvalid") } };
  }

  let images: string[] = [];
  try {
    const raw = JSON.parse(d.images);
    if (Array.isArray(raw)) images = raw.filter((u) => typeof u === "string" && /^\/(uploads|products)\/[\w.-]+$/.test(u)).slice(0, 8);
  } catch {}

  const slug = slugify(d.slug || d.name);
  if (!slug) return { error: t("formInvalid"), fieldErrors: { slug: t("slugInvalid") } };
  const clash = await db.product.findFirst({
    where: { OR: [{ slug }, { sku: d.sku }], NOT: id ? { id } : undefined },
  });
  if (clash) return { error: t("formInvalid"), fieldErrors: clash.slug === slug ? { slug: t("slugTaken") } : { sku: t("skuTaken") } };

  const data = {
    name: d.name, slug, tagline: d.tagline, description: d.description, details: d.details,
    priceCents: d.price, compareAtCents, sku: d.sku, stock: d.stock, status: d.status,
    categoryId: d.categoryId, featured: d.featured === "on",
    // Sans gabarit, seul `customTemplate` est écrit : les autres réglages sont gardés pour une réactivation.
    ...custom.data,
  };
  const imageRows = images.map((url, position) => ({ url, position }));
  // Une ligne par langue ; une langue dont les quatre champs sont vides n'a pas de ligne.
  const translations = TRANSLATED.map((locale) => ({
    locale,
    row: { name: d[`name_${locale}`], tagline: d[`tagline_${locale}`], description: d[`description_${locale}`], details: d[`details_${locale}`] },
  })).map(({ locale, row }) => ({ locale, row, empty: Object.values(row).every((v) => v === "") }));

  if (id) {
    await db.$transaction([
      db.productImage.deleteMany({ where: { productId: id } }),
      db.product.update({ where: { id }, data: { ...data, images: { create: imageRows } } }),
      ...translations.map(({ locale, row, empty }) =>
        empty
          ? db.productTranslation.deleteMany({ where: { productId: id, locale } })
          : db.productTranslation.upsert({ where: { productId_locale: { productId: id, locale } }, create: { productId: id, locale, ...row }, update: row }),
      ),
    ]);
  } else {
    await db.product.create({
      data: { ...data, images: { create: imageRows }, translations: { create: translations.filter((tr) => !tr.empty).map(({ locale, row }) => ({ locale, ...row })) } },
    });
  }
  revalidatePath("/", "layout");
  return redirectTo("/admin/products?ok=" + (id ? "updated" : "created"));
}

export async function deleteProduct(id: string): Promise<FormState> {
  await requireAdmin();
  const n = await getTranslations("admin.notices");
  // Un produit déjà commandé est archivé plutôt que supprimé, pour garder l'historique des ventes lisible.
  const sold = await db.orderItem.count({ where: { productId: id } });
  if (sold > 0) {
    await db.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    revalidatePath("/", "layout");
    return { ok: true, message: n("productArchived") };
  }
  await db.product.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true, message: n("productDeleted") };
}

export async function saveCategory(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const [t, n] = await Promise.all([getTranslations("admin.errors"), getTranslations("admin.notices")]);
  const parsed = z
    .object({
      name: z.string().trim().min(2, t("nameRequired")).max(60, t("tooLong", { max: 60 })),
      description: text(t, 300),
      position: z.coerce.number(t("positionInvalid")).int(t("positionInvalid")).min(0, t("positionInvalid")).default(0),
      name_en: text(t, 60),
      description_en: text(t, 300),
      name_mg: text(t, 60),
      description_mg: text(t, 300),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t("formInvalid"), fieldErrors: toFieldErrors(parsed.error) };
  const { name, description, position } = parsed.data;
  const slug = slugify(name);
  const clash = await db.category.findFirst({ where: { slug, NOT: id ? { id } : undefined } });
  if (clash) return { error: t("formInvalid"), fieldErrors: { name: t("categoryTaken") } };

  const translations = TRANSLATED.map((locale) => {
    const row = { name: parsed.data[`name_${locale}`], description: parsed.data[`description_${locale}`] };
    return { locale, row, empty: row.name === "" && row.description === "" };
  });
  const data = { name, description, position, slug };
  if (id) {
    await db.$transaction([
      db.category.update({ where: { id }, data }),
      ...translations.map(({ locale, row, empty }) =>
        empty
          ? db.categoryTranslation.deleteMany({ where: { categoryId: id, locale } })
          : db.categoryTranslation.upsert({ where: { categoryId_locale: { categoryId: id, locale } }, create: { categoryId: id, locale, ...row }, update: row }),
      ),
    ]);
  } else {
    await db.category.create({ data: { ...data, translations: { create: translations.filter((tr) => !tr.empty).map(({ locale, row }) => ({ locale, ...row })) } } });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: id ? n("categoryUpdated") : n("categoryCreated") };
}

export async function deleteCategory(id: string): Promise<FormState> {
  await requireAdmin();
  const [t, n] = await Promise.all([getTranslations("admin.errors"), getTranslations("admin.notices")]);
  const count = await db.product.count({ where: { categoryId: id } });
  if (count > 0) return { error: t("categoryInUse", { count }) };
  await db.category.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true, message: n("categoryDeleted") };
}
