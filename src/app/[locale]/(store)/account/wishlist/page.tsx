import { getTranslations } from "next-intl/server";
import { ProductCard } from "@/components/store/product-card";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { cardInclude } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const [items, { currency }, t] = await Promise.all([
    db.wishlistItem.findMany({ where: { userId: user.id, product: { status: "ACTIVE" } }, orderBy: { createdAt: "desc" }, include: { product: { include: cardInclude } } }),
    getSettings(),
    getTranslations("account"),
  ]);
  if (items.length === 0)
    return (
      <div className="max-w-md">
        <h2 className="display text-3xl">{t("wishlistEmptyTitle")}</h2>
        <p className="mt-3 text-muted-foreground">{t("wishlistEmptyText")}</p>
        <Link href="/products" className={`${buttonVariants({ size: "md" })} mt-6`}>
          {t("ordersEmptyCta")}
        </Link>
      </div>
    );
  return (
    <>
      <h2 className="display text-3xl">{t("wishlistTitle")}</h2>
      <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
        {items.map(({ product }) => (
          <ProductCard key={product.id} product={product} currency={currency} wished />
        ))}
      </div>
    </>
  );
}
