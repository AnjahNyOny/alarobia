import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.products");
  return { title: t("editMetaTitle") };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [product, categories, { currency }, t] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { images: { orderBy: { position: "asc" } }, translations: true } }),
    db.category.findMany({ orderBy: { position: "asc" } }),
    getSettings(),
    getTranslations("admin.products"),
  ]);
  if (!product) notFound();
  return (
    <>
      <PageHeader title={product.name} back={{ href: "/admin/products", label: t("title") }}>
        {product.status === "ACTIVE" && (
          <Link href={`/products/${product.slug}`} target="_blank" className={buttonVariants({ variant: "outline", size: "md" })}>
            {t("viewInStore")} <ExternalLink aria-hidden />
          </Link>
        )}
      </PageHeader>
      <ProductForm product={product} categories={categories} currency={currency} />
    </>
  );
}
