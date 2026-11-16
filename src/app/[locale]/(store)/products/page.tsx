import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AisleStrip } from "@/components/store/aisle-strip";
import { ProductCard } from "@/components/store/product-card";
import { SortSelect } from "@/components/store/sort-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { cardInclude, wishedIds } from "@/lib/catalog";
import { db } from "@/lib/db";
import { currencyLabel, parseAmountToCents } from "@/lib/format";
import { CATEGORY_FIELDS, localize } from "@/lib/localize";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

const PER_PAGE = 12;
type Params = { q?: string; category?: string; sort?: string; min?: string; max?: string; stock?: string; sale?: string; page?: string };

const getCategories = () => db.category.findMany({ orderBy: { position: "asc" }, include: { translations: true } });

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const [sp, locale, t] = await Promise.all([searchParams, getLocale(), getTranslations("catalog")]);
  const q = sp.q?.trim().slice(0, 80);
  if (q) return { title: t("searchTitle", { q }), robots: { index: false } };
  if (sp.category) {
    const found = await db.category.findUnique({ where: { slug: sp.category }, include: { translations: true } });
    if (found) {
      const c = localize(found, locale, CATEGORY_FIELDS);
      return { title: c.name, description: c.description };
    }
  }
  return { title: sp.sale ? t("sale") : t("all") };
}

export default async function CataloguePage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const [settings, user, rawCategories, locale, t] = await Promise.all([getSettings(), getUser(), getCategories(), getLocale(), getTranslations("catalog")]);
  const categories = rawCategories.map((c) => localize(c, locale, CATEGORY_FIELDS));
  const category = categories.find((c) => c.slug === sp.category);
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const min = sp.min ? parseAmountToCents(sp.min) : NaN;
  const max = sp.max ? parseAmountToCents(sp.max) : NaN;
  const sort = sp.sort ?? "featured";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1") || 1);

  // La recherche porte sur le français de référence et sur les traductions : « basket » doit trouver un panier.
  const matches = (field: "name" | "tagline" | "description") => [{ [field]: { contains: q } }, { translations: { some: { [field]: { contains: q } } } }];
  const where: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    ...(category && { categoryId: category.id }),
    ...(q && { OR: [...matches("name"), ...matches("tagline"), ...matches("description")] }),
    ...(sp.stock && { stock: { gt: 0 } }),
    ...(sp.sale && { compareAtCents: { not: null } }),
    ...((Number.isFinite(min) || Number.isFinite(max)) && {
      priceCents: { ...(Number.isFinite(min) && { gte: min }), ...(Number.isFinite(max) && { lte: max }) },
    }),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === "price-asc" ? [{ priceCents: "asc" }] : sort === "price-desc" ? [{ priceCents: "desc" }] : sort === "newest" ? [{ createdAt: "desc" }] : [{ featured: "desc" }, { createdAt: "desc" }];

  const [total, products, wished] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, include: cardInclude, orderBy, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    wishedIds(user?.id),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const href = (patch: Partial<Params>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, page: undefined, ...patch })) if (v) next.set(k, String(v));
    const s = next.toString();
    return s ? `/products?${s}` : "/products";
  };
  const hasFilters = !!(sp.min || sp.max || sp.stock || sp.sale);
  const title = q ? t("results", { q }) : sp.sale && !category ? t("sale") : (category?.name ?? t("all"));
  const priceInput = "h-10 w-24 rounded-md border border-input bg-card px-3 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

  const filters = (
    <form action={`/${locale}/products`} className="flex flex-wrap items-end gap-x-6 gap-y-4">
      {sp.category && <input type="hidden" name="category" value={sp.category} />}
      {q && <input type="hidden" name="q" value={q} />}
      {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
      <fieldset className="min-w-0">
        <legend className="text-sm text-muted-foreground">{t("price", { currency: currencyLabel(settings.currency) })}</legend>
        <div className="mt-1.5 flex items-center gap-2">
          <input name="min" inputMode="decimal" defaultValue={sp.min} placeholder={t("min")} aria-label={t("minLabel")} className={priceInput} />
          <span className="text-muted-foreground" aria-hidden>
            –
          </span>
          <input name="max" inputMode="decimal" defaultValue={sp.max} placeholder={t("max")} aria-label={t("maxLabel")} className={priceInput} />
        </div>
      </fieldset>
      <div className="flex min-h-10 flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="stock" value="1" defaultChecked={!!sp.stock} className="size-4 accent-[var(--primary)]" />
          {t("inStock")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sale" value="1" defaultChecked={!!sp.sale} className="size-4 accent-[var(--primary)]" />
          {t("onSale")}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" size="md" variant="outline">
          {t("apply")}
        </Button>
        {hasFilters && (
          <Link href={href({ min: undefined, max: undefined, stock: undefined, sale: undefined })} className="text-sm underline underline-offset-4">
            {t("clear")}
          </Link>
        )}
      </div>
    </form>
  );

  return (
    <div className="container-page pt-8 md:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div className="max-w-2xl">
          <h1 className="display text-5xl md:text-6xl">{title}</h1>
          {category?.description && !q && <p className="mt-3 text-lg text-muted-foreground">{category.description}</p>}
        </div>
        <p className="text-muted-foreground tabular-nums" role="status">
          {t("count", { count: total })}
        </p>
      </header>

      {/* Les rayons, comme une rangée d'enseignes : celui où l'on se trouve est surligné, comme « aujourd'hui » dans la frise de l'accueil. */}
      <AisleStrip label={t("aisles")}>
        <ul className="flex w-max">
          {[{ slug: undefined as string | undefined, name: t("allAisles") }, ...categories].map((c) => {
            const active = c.slug === category?.slug;
            return (
              <li key={c.slug ?? "all"} className="border-l first:border-l-0">
                <Link
                  href={href({ category: c.slug, q: undefined })}
                  aria-current={active ? "page" : undefined}
                  className={cn("display-sm block px-4 py-3 text-xl whitespace-nowrap -outline-offset-2 md:px-5 md:text-2xl", active ? "bg-highlight text-highlight-foreground" : "hover:bg-muted")}
                >
                  {c.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </AisleStrip>

      <div className="relative mt-5 flex flex-wrap items-start justify-between gap-x-8 gap-y-4 lg:items-end">
        {/* Un seul formulaire : replié derrière une case à cocher sur téléphone, toujours visible sur grand écran. */}
        <div className="min-w-0">
          {/* Sur grand écran, les filtres sont toujours dépliés : la case n'y sert à rien et disparaît (ni focus, ni lecture). */}
          <input id="filtres" type="checkbox" defaultChecked={hasFilters} className="peer sr-only lg:hidden" />
          <label htmlFor="filtres" className="flex h-10 w-fit cursor-pointer items-center gap-2 rounded-md border border-input px-4 text-sm font-medium peer-checked:bg-muted peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring lg:hidden">
            <SlidersHorizontal className="size-4" aria-hidden />
            {t("filters")}
          </label>
          <div className="hidden pt-4 peer-checked:block lg:block lg:pt-0">{filters}</div>
        </div>
        <SortSelect value={sort} />
      </div>

      {products.length === 0 ? (
        <div className="mt-10 max-w-md border-t pt-10 pb-10">
          <p className="display text-3xl">{t("emptyTitle")}</p>
          <p className="mt-3 text-muted-foreground">{t("emptyText")}</p>
          <Link href="/products" className={`${buttonVariants({ size: "md", variant: "outline" })} mt-6`}>
            {t("emptyCta")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} currency={settings.currency} wished={wished.has(p.id)} priority={i < 4} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label={t("pagination")} className="mt-12 flex items-center gap-1 border-t pt-6">
          {page > 1 && (
            <Link href={href({ page: page === 2 ? undefined : String(page - 1) })} className={buttonVariants({ size: "icon-md", variant: "ghost" })} aria-label={t("prev")}>
              <ChevronLeft aria-hidden />
            </Link>
          )}
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={href({ page: n === 1 ? undefined : String(n) })}
              aria-current={n === page ? "page" : undefined}
              aria-label={t("page", { n })}
              className={cn(buttonVariants({ size: "icon-md", variant: n === page ? "default" : "ghost" }), "tabular-nums")}
            >
              {n}
            </Link>
          ))}
          {page < pages && (
            <Link href={href({ page: String(page + 1) })} className={buttonVariants({ size: "icon-md", variant: "ghost" })} aria-label={t("next")}>
              <ChevronRight aria-hidden />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
