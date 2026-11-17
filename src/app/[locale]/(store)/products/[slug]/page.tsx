import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BadgeCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BuyBox, CustomizerShell as LazyCustomizerShell, Stage } from "@/components/customizer/lazy";
import { AddToCart } from "@/components/store/add-to-cart";
import { Gallery } from "@/components/store/gallery";
import { ProductCard } from "@/components/store/product-card";
import { ReviewForm } from "@/components/store/review-form";
import { Stars } from "@/components/store/stars";
import { WishlistButton } from "@/components/store/wishlist-button";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { cardInclude, discountPercent, ratingOf, wishedIds } from "@/lib/catalog";
import { LOW_STOCK_THRESHOLD, REVENUE_STATUSES } from "@/lib/constants";
import { cleanText, customizerOptions, graphemes, type CustomizerOptions } from "@/lib/customization";
import { db } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { CATEGORY_FIELDS, localize, PRODUCT_FIELDS } from "@/lib/localize";
import { availablePaymentMethods, isMobileMoney, OPERATOR_NAME } from "@/lib/payment";
import { shippingCost } from "@/lib/pricing";
import { catalogPath, jsonLdScript, openGraphBase, pageAlternates, schemaPrice, siteBase } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { estimateDelivery, madagascarTime, zoneName } from "@/lib/shipping";

const getProduct = cache((slug: string) =>
  db.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      category: { include: { translations: true } },
      translations: true,
      images: { orderBy: { position: "asc" } },
      reviews: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  })
);

/** Sans réglages de personnalisation, la fiche se passe de l'état partagé : le code de la personnalisation n'est pas téléchargé. */
function CustomizerShell({ options, initialText, children }: { options: CustomizerOptions | null; initialText: string; children: React.ReactNode }) {
  return options ? (
    <LazyCustomizerShell options={options} initialText={initialText}>
      {children}
    </LazyCustomizerShell>
  ) : (
    children
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }): Promise<Metadata> {
  const { slug, locale } = await params;
  const [raw, { storeName }] = await Promise.all([getProduct(slug), getSettings()]);
  if (!raw) return {};
  const product = localize(raw, locale, PRODUCT_FIELDS);
  const description = product.description.slice(0, 155);
  const alternates = pageAlternates(siteBase(), locale, `/products/${product.slug}`);
  const photo = product.images[0]?.url;
  return {
    title: product.name,
    description,
    alternates,
    // Un openGraph de page remplace celui du layout en entier : on repart de la base commune (nom du site, langue).
    // Sans photo, pas d'openGraph propre : la fiche garde l'image de partage générique.
    ...(photo && { openGraph: { ...openGraphBase(locale, storeName), url: alternates.canonical, title: product.name, description: product.tagline || description, images: [photo] } }),
  };
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string; locale: string }>; searchParams: Promise<{ perso?: string | string[] }> }) {
  const { slug, locale } = await params;
  const raw = await getProduct(slug);
  if (!raw) notFound();
  // Un champ non traduit reste en français : jamais de trou sur la fiche.
  const product = localize(raw, locale, PRODUCT_FIELDS);
  const category = localize(raw.category, locale, CATEGORY_FIELDS);

  const [settings, user, zones, t, tc, td] = await Promise.all([
    getSettings(),
    getUser(),
    db.shippingZone.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    getTranslations("product"),
    getTranslations("card"),
    getTranslations("delivery"),
  ]);
  const [related, wished, purchased] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE", categoryId: product.categoryId, id: { not: product.id } }, include: cardInclude, take: 4, orderBy: { featured: "desc" } }),
    wishedIds(user?.id),
    user ? db.orderItem.count({ where: { productId: product.id, order: { userId: user.id, status: { in: REVENUE_STATUSES } } } }) : 0,
  ]);
  const buyers = new Set(
    (await db.orderItem.findMany({ where: { productId: product.id, order: { status: { in: REVENUE_STATUSES }, userId: { in: product.reviews.map((r) => r.userId) } } }, select: { order: { select: { userId: true } } } })).map((i) => i.order.userId)
  );

  const { currency } = settings;
  const price = (cents: number) => formatPrice(cents, currency, locale);
  const rating = ratingOf(product.reviews);
  const average = new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating.average);
  const discount = discountPercent(product.priceCents, product.compareAtCents);
  const mine = product.reviews.find((r) => r.userId === user?.id);
  const details = product.details.split("\n").filter(Boolean);
  const today = madagascarTime();
  const operators = availablePaymentMethods(settings).filter(isMobileMoney).map((method) => OPERATOR_NAME[method]);
  const custom = customizerOptions(product);
  // Prénom écrit sur la démonstration de l'accueil (« ?perso=Miora ») : coupé à la longueur que le produit accepte.
  const { perso } = await searchParams;
  const initialText = custom && typeof perso === "string" ? graphemes(cleanText(perso)).slice(0, custom.textMax).join("") : "";
  const photos = product.images.map((i) => i.url);
  const wishlist = <WishlistButton productId={product.id} active={wished.has(product.id)} name={product.name} variant="page" />;

  // Données structurées : la page dans sa langue, son fil d'Ariane (le rayon affiché au-dessus du titre) et le produit.
  const base = siteBase();
  const url = pageAlternates(base, locale, `/products/${product.slug}`).canonical;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "ItemPage", "@id": url, url, name: product.name, inLanguage: locale, breadcrumb: { "@id": `${url}#ariane` }, mainEntity: { "@id": `${url}#produit` } },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#ariane`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: category.name, item: pageAlternates(base, locale, catalogPath({ category: category.slug })).canonical },
          { "@type": "ListItem", position: 2, name: product.name },
        ],
      },
      {
        "@type": "Product",
        "@id": `${url}#produit`,
        name: product.name,
        description: product.description,
        sku: product.sku,
        url,
        image: product.images.map((i) => new URL(i.url, base).href),
        offers: {
          "@type": "Offer",
          // Les montants sont stockés en unités mineures : 2 500 000 → « 25000 » (ariary).
          price: schemaPrice(product.priceCents),
          priceCurrency: currency,
          availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url,
        },
        ...(rating.count > 0 && { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average.toFixed(1), reviewCount: rating.count } }),
      },
    ],
  };

  return (
    <>
      <div className="container-page pt-6 md:pt-10">
        <nav aria-label={t("crumb")} className="text-sm">
          <Link href={`/products?category=${category.slug}`} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
            {category.name}
          </Link>
        </nav>

        {/* Produit personnalisable : la colonne de photos et le bloc d'achat partagent le dessin en cours. */}
        <CustomizerShell options={custom} initialText={initialText}>
        <div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          {custom ? <Stage images={photos} name={product.name} /> : <Gallery images={photos} name={product.name} />}

          <div className="min-w-0">
            <h1 className="display text-4xl sm:text-5xl">{product.name}</h1>
            {product.tagline && <p className="mt-3 text-lg text-muted-foreground">{product.tagline}</p>}

            <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
              <span className={`display text-5xl sm:text-6xl ${discount ? "text-brand" : ""}`}>{price(product.priceCents)}</span>
              {discount > 0 && (
                <>
                  <s className="text-lg text-muted-foreground">
                    <span className="sr-only">{tc("oldPrice")} </span>
                    {price(product.compareAtCents!)}
                  </s>
                  <span className="tag self-center bg-brand text-sm font-semibold text-brand-foreground">−{discount} %</span>
                </>
              )}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("taxes")}</p>

            {rating.count > 0 && (
              <a href="#avis" className="mt-4 inline-flex items-center gap-2 text-sm">
                <Stars value={rating.average} />
                <span className="underline underline-offset-4">{t("ratingLine", { value: average, count: rating.count })}</span>
              </a>
            )}

            <p className="mt-6 flex items-center gap-2 text-sm font-medium">
              <span className={`size-2 rounded-full ${product.stock === 0 ? "bg-muted-foreground/50" : product.stock <= LOW_STOCK_THRESHOLD ? "bg-warning" : "bg-success"}`} aria-hidden />
              {product.stock === 0 ? t("stockOut") : product.stock <= LOW_STOCK_THRESHOLD ? t("stockLow", { count: product.stock }) : t("stockIn")}
            </p>

            <div className="mt-4">
              {custom ? (
                <BuyBox productId={product.id} stock={product.stock} surcharge={`+ ${price(custom.surchargeCents)}`} total={price(product.priceCents + custom.surchargeCents)}>
                  {wishlist}
                </BuyBox>
              ) : (
                <AddToCart productId={product.id} stock={product.stock}>
                  {wishlist}
                </AddToCart>
              )}
            </div>

            {/* L'élément propre à cette page : quel jour le colis arrive, zone par zone, pour une commande passée maintenant. */}
            <section aria-labelledby="livraison-titre" className="mt-8 rounded-sm border-2 border-foreground">
              <div className="px-4 pt-4 sm:px-5">
                <h2 id="livraison-titre" className="display-sm text-2xl">
                  {t("deliveryTitle")}
                </h2>
                {zones.length > 0 && <p className="mt-1 text-muted-foreground">{t("deliveryLead")}</p>}
              </div>
              {zones.length > 0 && (
                <ul className="mt-3 border-t">
                  {zones.map((zone) => {
                    const cost = shippingCost(zone, product.priceCents, settings.freeShippingThresholdCents);
                    return (
                      <li key={zone.id} className="flex items-baseline justify-between gap-4 border-b px-4 py-3 sm:px-5">
                        <div className="min-w-0">
                          <p className="display-sm text-xl first-letter:uppercase">{formatDate(estimateDelivery(today, zone), locale, "weekday")}</p>
                          <p className="text-sm text-muted-foreground">{zoneName(zone, locale)}</p>
                        </div>
                        <p className="shrink-0 font-medium tabular-nums">{cost === 0 ? td("free") : price(cost)}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="grid gap-1 px-4 py-4 text-sm text-muted-foreground sm:px-5">
                {settings.freeShippingThresholdCents > 0 && product.priceCents < settings.freeShippingThresholdCents && <p>{t("freeFrom", { amount: price(settings.freeShippingThresholdCents) })}</p>}
                <p>{operators.length > 0 ? t("payMobile", { operators: operators.join(", ") }) : t("payCod")}</p>
                <p>
                  {t("returns")}{" "}
                  <Link href="/help" className="text-foreground underline underline-offset-4">
                    {t("helpLink")}
                  </Link>
                </p>
              </div>
            </section>
          </div>
        </div>
        </CustomizerShell>

        <div className="mt-14 grid gap-10 border-t pt-10 md:mt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <section aria-labelledby="description-titre">
            <h2 id="description-titre" className="display text-3xl">
              {t("description")}
            </h2>
            <p className="mt-4 max-w-[62ch] text-lg leading-relaxed">{product.description}</p>
          </section>
          {details.length > 0 && (
            <section aria-labelledby="details-titre">
              <h2 id="details-titre" className="display text-3xl">
                {t("details")}
              </h2>
              <ul className="mt-4 border-t">
                {details.map((d) => (
                  <li key={d} className="border-b py-2.5">
                    {d}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">{t("sku", { sku: product.sku })}</p>
            </section>
          )}
        </div>

        <section id="avis" aria-labelledby="avis-titre" className="mt-14 scroll-mt-24 border-t pt-10 md:mt-20">
          <div className="grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-14">
            <div>
              <h2 id="avis-titre" className="display text-3xl">
                {t("reviewsTitle")}
              </h2>
              {rating.count > 0 ? (
                <div className="mt-5">
                  <p className="flex items-baseline gap-2">
                    <span className="display text-6xl tabular-nums">{average}</span>
                    <span className="text-muted-foreground">{t("outOf")}</span>
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Stars value={rating.average} /> {tc("reviews", { count: rating.count })}
                  </p>
                  <ul className="mt-5 grid gap-1.5" aria-label={t("breakdown")}>
                    {[5, 4, 3, 2, 1].map((n) => {
                      const c = product.reviews.filter((r) => r.rating === n).length;
                      return (
                        <li key={n} className="flex items-center gap-3 text-[0.8125rem] text-muted-foreground tabular-nums">
                          <span className="w-3">{n}</span>
                          <span className="h-2 flex-1 bg-muted">
                            <span className="block h-full bg-foreground" style={{ width: `${(c / rating.count) * 100}%` }} />
                          </span>
                          <span className="w-4 text-right">{c}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 text-muted-foreground">{t("none")}</p>
              )}

              <div className="mt-8 border-t pt-6">
                {user ? (
                  <ReviewForm productId={product.id} initial={mine ? { rating: mine.rating, comment: mine.comment } : undefined} />
                ) : (
                  <Link href={`/login?next=/products/${product.slug}`} className="text-sm font-medium underline underline-offset-4">
                    {t("login")}
                  </Link>
                )}
                {user && purchased === 0 && !mine && <p className="mt-3 text-[0.8125rem] text-muted-foreground">{t("notBought")}</p>}
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
                        <BadgeCheck className="size-3.5" aria-hidden /> {t("verified")}
                      </span>
                    )}
                    <time dateTime={r.createdAt.toISOString()} className="ml-auto text-[0.8125rem] text-muted-foreground">
                      {formatDate(r.createdAt, locale)}
                    </time>
                  </div>
                  <p className="mt-3 max-w-2xl leading-relaxed">{r.comment}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {related.length > 0 && (
          <section aria-labelledby="rayon-titre" className="mt-14 border-t pt-10 md:mt-20">
            <h2 id="rayon-titre" className="display text-3xl">
              {t("related")}
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} currency={currency} wished={wished.has(p.id)} />
              ))}
            </div>
          </section>
        )}
      </div>
      {/* Données structurées pour les moteurs de recherche. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
    </>
  );
}
