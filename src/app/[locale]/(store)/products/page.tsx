import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import type { Prisma } from "@prisma/client";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/store/product-card";
import { SortSelect } from "@/components/store/sort-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { cardInclude, wishedIds } from "@/lib/catalog";
import { db } from "@/lib/db";
import { currencyLabel, parseAmountToCents } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

const PER_PAGE = 12;
type Params = { q?: string; category?: string; sort?: string; min?: string; max?: string; stock?: string; sale?: string; page?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const sp = await searchParams;
  if (sp.q) return { title: `Recherche : ${sp.q}`, robots: { index: false } };
  if (sp.category) {
    const c = await db.category.findUnique({ where: { slug: sp.category } });
    if (c) return { title: c.name, description: c.description };
  }
  return { title: "Tous les produits" };
}

export default async function CataloguePage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const [settings, user, categories] = await Promise.all([getSettings(), getUser(), db.category.findMany({ orderBy: { position: "asc" } })]);
  const category = categories.find((c) => c.slug === sp.category);
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const min = sp.min ? parseAmountToCents(sp.min) : NaN;
  const max = sp.max ? parseAmountToCents(sp.max) : NaN;
  const sort = sp.sort ?? "featured";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1") || 1);

  const where: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    ...(category && { categoryId: category.id }),
    ...(q && { OR: [{ name: { contains: q } }, { tagline: { contains: q } }, { description: { contains: q } }] }),
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
  const title = q ? `Résultats pour « ${q} »` : sp.sale && !category ? "Promotions" : (category?.name ?? "Tous les produits");

  const filters = (
    <form action="/products" className="grid gap-7">
      {sp.category && <input type="hidden" name="category" value={sp.category} />}
      {q && <input type="hidden" name="q" value={q} />}
      {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
      <fieldset>
        <legend className="text-sm font-medium">Prix ({currencyLabel(settings.currency)})</legend>
        <div className="mt-3 flex items-center gap-2">
          <input name="min" inputMode="decimal" defaultValue={sp.min} placeholder="Min" aria-label="Prix minimum" className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring" />
          <span className="text-muted-foreground" aria-hidden>
            –
          </span>
          <input name="max" inputMode="decimal" defaultValue={sp.max} placeholder="Max" aria-label="Prix maximum" className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring" />
        </div>
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="mb-3 text-sm font-medium">Disponibilité</legend>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="stock" value="1" defaultChecked={!!sp.stock} className="size-4 accent-[var(--brand)]" />
          En stock uniquement
        </label>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="sale" value="1" defaultChecked={!!sp.sale} className="size-4 accent-[var(--brand)]" />
          En promotion
        </label>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" size="md" variant="outline" className="flex-1">
          Appliquer
        </Button>
        {hasFilters && (
          <Link href={href({ min: undefined, max: undefined, stock: undefined, sale: undefined })} className={buttonVariants({ size: "md", variant: "ghost" })}>
            <X aria-hidden /> Effacer
          </Link>
        )}
      </div>
    </form>
  );

  const categoryNav = (
    <nav aria-label="Catégories">
      <p className="text-sm font-medium">Catégories</p>
      <ul className="mt-3 grid gap-0.5 text-sm">
        {[{ slug: undefined as string | undefined, name: "Tout voir" }, ...categories].map((c) => {
          const active = c.slug === category?.slug;
          return (
            <li key={c.slug ?? "all"}>
              <Link
                href={href({ category: c.slug, q: undefined })}
                aria-current={active ? "page" : undefined}
                className={cn("-mx-2.5 block rounded-md px-2.5 py-1.5 transition-colors hover:bg-muted", active ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
              >
                {c.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="container-page pt-8 md:pt-12">
      <nav aria-label="Fil d'Ariane" className="text-[0.8125rem] text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Accueil
        </Link>
        <span className="mx-2" aria-hidden>
          /
        </span>
        <span className="text-foreground">{q ? "Recherche" : (category?.name ?? "Produits")}</span>
      </nav>
      <header className="mt-4 max-w-2xl">
        <h1 className="display text-4xl md:text-5xl">{title}</h1>
        {category?.description && !q && <p className="mt-3 text-muted-foreground">{category.description}</p>}
      </header>

      <div className="mt-8 grid gap-x-12 gap-y-6 lg:mt-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden content-start gap-8 lg:grid">
          {categoryNav}
          <div className="border-t pt-7">{filters}</div>
        </aside>

        <div>
          <details className="group mb-5 rounded-lg border bg-card lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="size-4" aria-hidden />
              Catégories et filtres
              <ChevronRight className="ml-auto size-4 transition-transform group-open:rotate-90" aria-hidden />
            </summary>
            <div className="grid gap-7 border-t p-4">
              {categoryNav}
              {filters}
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <p className="text-sm text-muted-foreground" role="status">
              {total} produit{total > 1 ? "s" : ""}
            </p>
            <SortSelect value={sort} />
          </div>

          {products.length === 0 ? (
            <div className="grid justify-items-center gap-4 py-20 text-center">
              <p className="display text-2xl">Aucun produit ne correspond</p>
              <p className="max-w-sm text-muted-foreground">Essayez un autre mot-clé ou élargissez vos filtres.</p>
              <Link href="/products" className={buttonVariants({ size: "md", variant: "outline" })}>
                Réinitialiser la recherche
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} currency={settings.currency} wished={wished.has(p.id)} priority={i < 3} sizes="(min-width: 1024px) 28vw, (min-width: 768px) 33vw, 50vw" />
              ))}
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1">
              {page > 1 && (
                <Link href={href({ page: String(page - 1) })} className={buttonVariants({ size: "icon-md", variant: "ghost" })} aria-label="Page précédente">
                  <ChevronLeft aria-hidden />
                </Link>
              )}
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={href({ page: n === 1 ? undefined : String(n) })}
                  aria-current={n === page ? "page" : undefined}
                  className={cn(buttonVariants({ size: "icon-md", variant: n === page ? "default" : "ghost" }), "tabular-nums")}
                >
                  {n}
                </Link>
              ))}
              {page < pages && (
                <Link href={href({ page: String(page + 1) })} className={buttonVariants({ size: "icon-md", variant: "ghost" })} aria-label="Page suivante">
                  <ChevronRight aria-hidden />
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
