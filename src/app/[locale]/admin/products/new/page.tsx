import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Nouveau produit" };

export default async function NewProductPage() {
  const [categories, { currency }] = await Promise.all([db.category.findMany({ orderBy: { position: "asc" } }), getSettings()]);
  return (
    <>
      <PageHeader title="Nouveau produit" back={{ href: "/admin/products", label: "Produits" }} />
      <ProductForm categories={categories} currency={currency} />
    </>
  );
}
