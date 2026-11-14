import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { discountPercent, isNew, ratingOf, type CardProduct } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { CATEGORY_FIELDS, localize, PRODUCT_FIELDS } from "@/lib/localize";
import { Stars } from "./stars";
import { WishlistButton } from "./wishlist-button";

export function ProductCard({
  product: raw,
  currency,
  wished = false,
  priority = false,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
}: {
  product: CardProduct;
  currency: string;
  wished?: boolean;
  priority?: boolean;
  sizes?: string;
}) {
  const t = useTranslations("card");
  const locale = useLocale();
  const product = localize(raw, locale, PRODUCT_FIELDS);
  const category = localize(raw.category, locale, CATEGORY_FIELDS);
  const image = product.images[0];
  const discount = discountPercent(product.priceCents, product.compareAtCents);
  const rating = ratingOf(product.reviews);
  const soldOut = product.stock === 0;

  return (
    <article className="group relative">
      <div className="relative aspect-square overflow-hidden rounded-sm bg-stone">
        {image && <Image src={image.url} alt="" fill sizes={sizes} priority={priority} className={`object-cover ${soldOut ? "opacity-55" : ""}`} />}
        {/* Une seule étiquette par carte, dans l'ordre d'importance pour l'acheteur. */}
        {soldOut ? (
          <span className="tag absolute top-3 left-0 bg-background text-xs font-semibold">{t("soldOut")}</span>
        ) : discount ? (
          <span className="tag absolute top-3 left-0 bg-brand text-xs font-semibold text-brand-foreground">−{discount} %</span>
        ) : isNew(product.createdAt) ? (
          <span className="tag absolute top-3 left-0 bg-highlight text-xs font-semibold text-highlight-foreground">{t("new")}</span>
        ) : null}
        <WishlistButton productId={product.id} active={wished} name={product.name} />
      </div>
      <div className="mt-3">
        <h3 className="leading-snug font-medium">
          {/* Le lien couvre toute la carte ; le bouton favori reste au-dessus. */}
          <Link href={`/products/${product.slug}`} className="outline-none after:absolute after:inset-0 group-hover:underline group-hover:underline-offset-4 focus-visible:after:outline-2 focus-visible:after:outline-ring">
            {product.name}
          </Link>
        </h3>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{category.name}</p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 tabular-nums">
          <span className={`display-sm text-xl ${discount ? "text-brand" : ""}`}>{formatPrice(product.priceCents, currency, locale)}</span>
          {discount > 0 && (
            <s className="text-sm text-muted-foreground">
              <span className="sr-only">{t("oldPrice")} </span>
              {formatPrice(product.compareAtCents!, currency, locale)}
            </s>
          )}
        </p>
        {rating.count > 0 && (
          <p className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
            <Stars value={rating.average} />
            <span>{t("reviews", { count: rating.count })}</span>
          </p>
        )}
      </div>
    </article>
  );
}
