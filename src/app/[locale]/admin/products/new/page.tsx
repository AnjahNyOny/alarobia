import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.products");
  return { title: t("newTitle") };
}

export default async function NewProductPage() {
  await requireAdmin();
  const [categories, { currency }, t] = await Promise.all([db.category.findMany({ orderBy: { position: "asc" } }), getSettings(), getTranslations("admin.products")]);
  return (
    <>
      <PageHeader title={t("newTitle")} back={{ href: "/admin/products", label: t("title") }} />
      <ProductForm categories={categories} currency={currency} />
    </>
  );
}
