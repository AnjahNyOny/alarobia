import Image from "next/image";
import Link from "next/link";
import { discountPercent, isNew, ratingOf, type CardProduct } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { Stars } from "./stars";
import { WishlistButton } from "./wishlist-button";

export function ProductCard({
  product,
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
  const [first, second] = product.images;
  const discount = discountPercent(product.priceCents, product.compareAtCents);
  const rating = ratingOf(product.reviews);
  const soldOut = product.stock === 0;
  const badge = soldOut ? "Épuisé" : discount ? `−${discount} %` : isNew(product.createdAt) ? "Nouveau" : null;

  return (
    <article className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
        {first && (
          <Image
            src={first.url}
            alt=""
            fill
            sizes={sizes}
            priority={priority}
            className={`object-cover transition duration-700 ease-out group-hover:scale-[1.03] ${soldOut ? "opacity-60" : ""} ${second ? "group-hover:opacity-0" : ""}`}
          />
        )}
        {second && <Image src={second.url} alt="" fill sizes={sizes} className="object-cover opacity-0 transition duration-700 ease-out group-hover:opacity-100" />}
        {badge && (
          <span
            className={`absolute top-2.5 left-2.5 rounded-md px-2 py-1 text-xs font-medium ${
              soldOut ? "bg-background/90 text-foreground" : discount ? "bg-sale text-white" : "bg-background/90 text-foreground"
            }`}
          >
            {badge}
          </span>
        )}
        <WishlistButton productId={product.id} active={wished} name={product.name} />
      </div>
      <div className="mt-3 grid gap-1">
        <p className="text-[0.8125rem] text-muted-foreground">{product.category.name}</p>
        <h3 className="text-[0.9375rem] leading-snug font-medium">
          {/* Le lien couvre toute la carte ; le bouton favori reste au-dessus. */}
          <Link href={`/produits/${product.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ring">
            {product.name}
          </Link>
        </h3>
        <p className="flex flex-wrap items-baseline gap-x-2 text-[0.9375rem] tabular-nums">
          <span className={discount ? "font-medium text-sale" : ""}>{formatPrice(product.priceCents, currency)}</span>
          {discount > 0 && (
            <s className="text-sm text-muted-foreground">
              <span className="sr-only">Ancien prix : </span>
              {formatPrice(product.compareAtCents!, currency)}
            </s>
          )}
        </p>
        {rating.count > 0 && (
          <p className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
            <Stars value={rating.average} />
            <span>({rating.count})</span>
          </p>
        )}
      </div>
    </article>
  );
}
