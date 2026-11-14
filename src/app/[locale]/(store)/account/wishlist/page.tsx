import { Link } from "@/i18n/navigation";
import { ProductCard } from "@/components/store/product-card";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { cardInclude } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const [items, { currency }] = await Promise.all([
    db.wishlistItem.findMany({ where: { userId: user.id, product: { status: "ACTIVE" } }, orderBy: { createdAt: "desc" }, include: { product: { include: cardInclude } } }),
    getSettings(),
  ]);
  if (items.length === 0)
    return (
      <div className="grid justify-items-start gap-3 rounded-lg border border-dashed p-8">
        <h2 className="text-lg font-medium">Aucun favori</h2>
        <p className="text-muted-foreground">Touchez le cœur d'un produit pour le retrouver ici.</p>
        <Link href="/products" className={buttonVariants({ size: "md" })}>
          Parcourir la boutique
        </Link>
      </div>
    );
  return (
    <>
      <h2 className="text-lg font-medium">Mes favoris</h2>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
        {items.map(({ product }) => (
          <ProductCard key={product.id} product={product} currency={currency} wished sizes="(min-width: 1024px) 26vw, 50vw" />
        ))}
      </div>
    </>
  );
}
