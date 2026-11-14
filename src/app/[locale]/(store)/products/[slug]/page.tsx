import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BadgeCheck, ChevronDown, PackageCheck, RotateCcw } from "lucide-react";
import { AddToCart } from "@/components/store/add-to-cart";
import { Gallery } from "@/components/store/gallery";
import { ProductCard } from "@/components/store/product-card";
import { ReviewForm } from "@/components/store/review-form";
import { Stars } from "@/components/store/stars";
import { WishlistButton } from "@/components/store/wishlist-button";
import { getUser } from "@/lib/auth";
import { cardInclude, discountPercent, ratingOf, wishedIds } from "@/lib/catalog";
import { LOW_STOCK_THRESHOLD, REVENUE_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";

const getProduct = cache((slug: string) =>
  db.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
      reviews: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  })
);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description.slice(0, 155),
    openGraph: { title: product.name, description: product.tagline, images: product.images[0] ? [product.images[0].url] : [] },
  };
}

function Disclosure({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pb-5 text-[0.9375rem] leading-relaxed text-muted-foreground">{children}</div>
    </details>
  );
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [settings, user, zones] = await Promise.all([getSettings(), getUser(), db.shippingZone.findMany({ where: { active: true }, select: { priceCents: true, minDays: true, maxDays: true } })]);
  const [related, wished, purchased] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE", categoryId: product.categoryId, id: { not: product.id } }, include: cardInclude, take: 4, orderBy: { featured: "desc" } }),
    wishedIds(user?.id),
    user ? db.orderItem.count({ where: { productId: product.id, order: { userId: user.id, status: { in: REVENUE_STATUSES } } } }) : 0,
  ]);
  const buyers = new Set(
    (await db.orderItem.findMany({ where: { productId: product.id, order: { status: { in: REVENUE_STATUSES }, userId: { in: product.reviews.map((r) => r.userId) } } }, select: { order: { select: { userId: true } } } })).map((i) => i.order.userId)
  );

  const { currency } = settings;
  const rating = ratingOf(product.reviews);
  const discount = discountPercent(product.priceCents, product.compareAtCents);
  const mine = product.reviews.find((r) => r.userId === user?.id);
  const details = product.details.split("\n").filter(Boolean);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: product.images.map((i) => siteUrl + i.url),
    offers: {
      "@type": "Offer",
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: currency,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${siteUrl}/${locale}/products/${product.slug}`,
    },
    ...(rating.count > 0 && { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average.toFixed(1), reviewCount: rating.count } }),
  };

  return (
    <>
    <div className="container-page pt-6 md:pt-10">
      <nav aria-label="Fil d'Ariane" className="text-[0.8125rem] text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Accueil</Link>
        <span className="mx-2" aria-hidden>/</span>
        <Link href={`/products?category=${product.category.slug}`} className="hover:text-foreground">{product.category.name}</Link>
        <span className="mx-2" aria-hidden>/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <Gallery images={product.images.map((i) => i.url)} name={product.name} />

        <div className="lg:sticky lg:top-24 lg:self-start">
          <h1 className="display text-4xl md:text-[2.75rem]">{product.name}</h1>
          {product.tagline && <p className="mt-2 text-lg text-muted-foreground">{product.tagline}</p>}
          {rating.count > 0 && (
            <a href="#avis" className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Stars value={rating.average} />
              <span className="underline underline-offset-4">
                {rating.average.toFixed(1).replace(".", ",")} · {rating.count} avis
              </span>
            </a>
          )}

          <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
            <span className={`text-2xl font-medium ${discount ? "text-sale" : ""}`}>{formatPrice(product.priceCents, currency)}</span>
            {discount > 0 && (
              <>
                <s className="text-lg text-muted-foreground">
                  <span className="sr-only">Ancien prix : </span>
                  {formatPrice(product.compareAtCents!, currency)}
                </s>
                <span className="rounded-md bg-sale px-2 py-0.5 text-xs font-medium text-white">−{discount} %</span>
              </>
            )}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">Taxes incluses</p>

          <p className="mt-6 flex items-center gap-2 text-sm">
            <span className={`size-2 rounded-full ${product.stock === 0 ? "bg-muted-foreground/50" : product.stock <= LOW_STOCK_THRESHOLD ? "bg-warning" : "bg-success"}`} aria-hidden />
            {product.stock === 0 ? "Momentanément épuisé" : product.stock <= LOW_STOCK_THRESHOLD ? `Plus que ${product.stock} en stock` : "En stock, expédié sous 24 h"}
          </p>

          <div className="mt-5">
            <AddToCart productId={product.id} stock={product.stock}>
              <WishlistButton productId={product.id} active={wished.has(product.id)} name={product.name} variant="page" />
            </AddToCart>
          </div>

          <ul className="mt-6 grid gap-2.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2.5">
              <PackageCheck className="size-4 text-foreground" strokeWidth={1.6} aria-hidden />
              {settings.freeShippingThresholdCents > 0 ? `Livraison offerte dès ${formatPrice(settings.freeShippingThresholdCents, currency)} d'achat` : "Livraison en 3 à 5 jours ouvrés"}
            </li>
            <li className="flex items-center gap-2.5">
              <RotateCcw className="size-4 text-foreground" strokeWidth={1.6} aria-hidden />
              Retours acceptés pendant 30 jours
            </li>
          </ul>

          <div className="mt-8 border-t">
            <Disclosure title="Description" open>
              <p>{product.description}</p>
            </Disclosure>
            {details.length > 0 && (
              <Disclosure title="Caractéristiques">
                <ul className="grid gap-1.5">
                  {details.map((d) => (
                    <li key={d} className="flex gap-2.5">
                      <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
                      {d}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[0.8125rem]">Référence : {product.sku}</p>
              </Disclosure>
            )}
            <Disclosure title="Livraison et retours">
              <p>
                {zones.length > 0 && (
                  <>
                    Livraison à partir de {formatPrice(Math.min(...zones.map((z) => z.priceCents)), currency)} selon votre zone, en {Math.min(...zones.map((z) => z.minDays))} à {Math.max(...zones.map((z) => z.maxDays))} jours ouvrés.{" "}
                  </>
                )}
                Vous disposez de 30 jours après réception pour nous retourner un article non utilisé.{" "}
                <Link href="/help" className="text-foreground underline underline-offset-4">En savoir plus</Link>
              </p>
            </Disclosure>
          </div>
        </div>
      </div>

      <section id="avis" className="mt-20 scroll-mt-24 border-t pt-12 md:mt-28">
        <div className="grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-16">
          <div>
            <h2 className="display text-3xl">Avis clients</h2>
            {rating.count > 0 ? (
              <div className="mt-5">
                <p className="flex items-baseline gap-2">
                  <span className="display text-5xl">{rating.average.toFixed(1).replace(".", ",")}</span>
                  <span className="text-muted-foreground">sur 5</span>
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Stars value={rating.average} /> {rating.count} avis
                </p>
                <ul className="mt-5 grid gap-1.5" aria-label="Répartition des notes">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const c = product.reviews.filter((r) => r.rating === n).length;
                    return (
                      <li key={n} className="flex items-center gap-3 text-[0.8125rem] text-muted-foreground tabular-nums">
                        <span className="w-3">{n}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-foreground" style={{ width: `${(c / rating.count) * 100}%` }} />
                        </span>
                        <span className="w-4 text-right">{c}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-muted-foreground">Aucun avis pour le moment. Soyez la première personne à donner le vôtre.</p>
            )}

            <div className="mt-8 border-t pt-6">
              {user ? (
                <ReviewForm productId={product.id} initial={mine ? { rating: mine.rating, comment: mine.comment } : undefined} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  <Link href={`/login?next=/products/${product.slug}`} className="font-medium text-foreground underline underline-offset-4">Connectez-vous</Link> pour donner votre avis.
                </p>
              )}
              {user && purchased === 0 && !mine && <p className="mt-3 text-[0.8125rem] text-muted-foreground">Vous n'avez pas encore commandé cet article : votre avis ne portera pas la mention « Achat vérifié ».</p>}
            </div>
          </div>

          <ul className="divide-y">
            {product.reviews.map((r) => (
              <li key={r.id} className="py-6 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={r.rating} />
                  <span className="text-sm font-medium">{r.user.name}</span>
                  {buyers.has(r.userId) && (
                    <span className="inline-flex items-center gap-1 text-[0.8125rem] text-success">
                      <BadgeCheck className="size-3.5" aria-hidden /> Achat vérifié
                    </span>
                  )}
                  <time dateTime={r.createdAt.toISOString()} className="ml-auto text-[0.8125rem] text-muted-foreground">{formatDate(r.createdAt)}</time>
                </div>
                <p className="mt-3 max-w-2xl leading-relaxed">{r.comment}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-20 md:mt-28">
          <h2 className="display text-3xl">Dans le même univers</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} wished={wished.has(p.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
    {/* Données structurées pour les moteurs de recherche. */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
