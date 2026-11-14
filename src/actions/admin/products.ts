"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PRODUCT_STATUSES } from "@/lib/constants";
import { parseAmountToCents, slugify } from "@/lib/format";
import { invalid, type FormState } from "@/lib/form";

const price = (msg: string) =>
  z.string().transform((v) => parseAmountToCents(v)).refine((n) => Number.isInteger(n) && n > 0 && n < 100_000_000, msg);

const productSchema = z.object({
  name: z.string().trim().min(2, "Le nom est requis.").max(120),
  slug: z.string().trim().max(140).optional(),
  tagline: z.string().trim().max(140).default(""),
  description: z.string().trim().min(10, "Ajoutez une description d'au moins 10 caractères.").max(5000),
  details: z.string().trim().max(3000).default(""),
  price: price("Prix invalide."),
  compareAt: z.string().trim().optional(),
  sku: z.string().trim().min(1, "La référence est requise.").max(40),
  stock: z.coerce.number("Stock invalide.").int("Stock invalide.").min(0, "Le stock ne peut pas être négatif."),
  status: z.enum(PRODUCT_STATUSES),
  categoryId: z.string().min(1, "Choisissez une catégorie."),
  featured: z.string().optional(),
  images: z.string().default("[]"),
});

export async function saveProduct(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  let compareAtCents: number | null = null;
  if (d.compareAt) {
    compareAtCents = parseAmountToCents(d.compareAt);
    if (!Number.isInteger(compareAtCents) || compareAtCents <= d.price)
      return { error: "Certains champs sont à corriger.", fieldErrors: { compareAt: "Le prix barré doit être supérieur au prix de vente." } };
  }

  let images: string[] = [];
  try {
    const raw = JSON.parse(d.images);
    if (Array.isArray(raw)) images = raw.filter((u) => typeof u === "string" && /^\/(uploads|products)\/[\w.-]+$/.test(u)).slice(0, 8);
  } catch {}

  const slug = slugify(d.slug || d.name);
  if (!slug) return { fieldErrors: { slug: "Adresse invalide." } };
  const clash = await db.product.findFirst({
    where: { OR: [{ slug }, { sku: d.sku }], NOT: id ? { id } : undefined },
  });
  if (clash)
    return {
      error: "Certains champs sont à corriger.",
      fieldErrors: clash.slug === slug ? { slug: "Cette adresse est déjà utilisée par un autre produit." } : { sku: "Cette référence est déjà utilisée." },
    };

  const data = {
    name: d.name, slug, tagline: d.tagline, description: d.description, details: d.details,
    priceCents: d.price, compareAtCents, sku: d.sku, stock: d.stock, status: d.status,
    categoryId: d.categoryId, featured: d.featured === "on",
  };
  const imageRows = images.map((url, position) => ({ url, position }));

  if (id) {
    await db.$transaction([
      db.productImage.deleteMany({ where: { productId: id } }),
      db.product.update({ where: { id }, data: { ...data, images: { create: imageRows } } }),
    ]);
  } else {
    await db.product.create({ data: { ...data, images: { create: imageRows } } });
  }
  revalidatePath("/", "layout");
  redirect("/admin/produits?ok=" + (id ? "modifie" : "cree"));
}

export async function deleteProduct(id: string): Promise<FormState> {
  await requireAdmin();
  // Un produit déjà commandé est archivé plutôt que supprimé, pour garder l'historique des ventes lisible.
  const sold = await db.orderItem.count({ where: { productId: id } });
  if (sold > 0) {
    await db.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Produit archivé (il figure dans des commandes)." };
  }
  await db.product.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Produit supprimé." };
}

export async function saveCategory(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Le nom est requis.").max(60),
      description: z.string().trim().max(300).default(""),
      position: z.coerce.number().int().min(0).default(0),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const slug = slugify(parsed.data.name);
  const clash = await db.category.findFirst({ where: { slug, NOT: id ? { id } : undefined } });
  if (clash) return { fieldErrors: { name: "Une catégorie porte déjà ce nom." } };
  if (id) await db.category.update({ where: { id }, data: { ...parsed.data, slug } });
  else await db.category.create({ data: { ...parsed.data, slug } });
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "Catégorie modifiée." : "Catégorie créée." };
}

export async function deleteCategory(id: string): Promise<FormState> {
  await requireAdmin();
  const count = await db.product.count({ where: { categoryId: id } });
  if (count > 0) return { error: `Impossible : ${count} produit(s) utilisent encore cette catégorie.` };
  await db.category.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Catégorie supprimée." };
}
