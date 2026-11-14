import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Modifier le produit" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories, { currency }] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { images: { orderBy: { position: "asc" } } } }),
    db.category.findMany({ orderBy: { position: "asc" } }),
    getSettings(),
  ]);
  if (!product) notFound();
  return (
    <>
      <PageHeader title={product.name} back={{ href: "/admin/products", label: "Produits" }}>
        {product.status === "ACTIVE" && (
          <Link href={`/products/${product.slug}`} target="_blank" className={buttonVariants({ variant: "outline", size: "md" })}>
            Voir en boutique <ExternalLink aria-hidden />
          </Link>
        )}
      </PageHeader>
      <ProductForm product={product} categories={categories} currency={currency} />
    </>
  );
}
