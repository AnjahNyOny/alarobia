import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { Prisma } from "@prisma/client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteProduct } from "@/actions/admin/products";
import { AutoSubmitSelect, ConfirmAction, FlashToast } from "@/components/admin/actions";
import { Card, EmptyState, PageHeader, Pagination, SearchForm, Tabs, td, th } from "@/components/admin/ui";
import { StatusBadge } from "@/components/order-status";
import { buttonVariants } from "@/components/ui/button";
import { LOW_STOCK_THRESHOLD, PRODUCT_STATUS_LABEL, PRODUCT_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Produits" };
const PER_PAGE = 12;
const tone: Record<string, string> = { ACTIVE: "bg-success/12 text-success", DRAFT: "bg-warning/12 text-warning", ARCHIVED: "bg-muted text-muted-foreground" };
const FLASH = { created: "Produit créé.", updated: "Produit enregistré." };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; category?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = PRODUCT_STATUSES.find((s) => s === sp.status);
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1") || 1);
  const base: Prisma.ProductWhereInput = { ...(q && { OR: [{ name: { contains: q } }, { sku: { contains: q } }] }), ...(sp.category && { categoryId: sp.category }) };
  const where = { ...base, ...(status && { status }) };

  const [{ currency }, categories, products, total, counts] = await Promise.all([
    getSettings(),
    db.category.findMany({ orderBy: { position: "asc" } }),
    db.product.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { category: true, images: { orderBy: { position: "asc" }, take: 1 } } }),
    db.product.count({ where }),
    db.product.groupBy({ by: ["status"], where: base, _count: true }),
  ]);
  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: status, q: q || undefined, category: sp.category, ...patch })) if (v) next.set(k, v);
    return next.size ? `/admin/products?${next}` : "/admin/products";
  };

  return (
    <>
      <FlashToast messages={FLASH} />
      <PageHeader title="Produits" description="Votre catalogue, ses prix et ses stocks.">
        <Link href="/admin/products/new" className={buttonVariants({ size: "md" })}>
          <Plus aria-hidden /> Ajouter un produit
        </Link>
      </PageHeader>
      <Tabs
        current={status ?? ""}
        tabs={[{ value: "", label: "Tous", href: href({ status: undefined }), count: counts.reduce((s, c) => s + c._count, 0) }, ...PRODUCT_STATUSES.map((s) => ({ value: s, label: PRODUCT_STATUS_LABEL[s], href: href({ status: s }), count: counts.find((c) => c.status === s)?._count ?? 0 }))]}
      />
      <Card flush className="mt-4">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <SearchForm action="/admin/products" placeholder="Nom ou référence" defaultValue={q} hidden={{ status: status, category: sp.category }} />
          <AutoSubmitSelect name="category" label="Filtrer par catégorie" value={sp.category ?? ""} params={{ status: status, q: q || undefined }} options={[{ value: "", label: "Toutes les catégories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
        </div>
        {products.length === 0 ? (
          <div className="border-t">
            <EmptyState title="Aucun produit" text={q || status || sp.category ? "Aucun produit ne correspond à ces critères." : "Ajoutez votre premier produit pour ouvrir la boutique."}>
              <Link href="/admin/products/new" className={buttonVariants({ size: "md", variant: "outline" })}>Ajouter un produit</Link>
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-y bg-muted/40">
                  <tr>
                    <th className={th}>Produit</th>
                    <th className={th}>Statut</th>
                    <th className={th}>Catégorie</th>
                    <th className={cn(th, "text-right")}>Stock</th>
                    <th className={cn(th, "text-right")}>Prix</th>
                    <th className={cn(th, "w-0")}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted">{p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="44px" className="object-cover" />}</div>
                          <div className="min-w-0">
                            <Link href={`/admin/products/${p.id}`} className="font-medium underline-offset-4 hover:underline">{p.name}</Link>
                            <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className={td}><StatusBadge label={PRODUCT_STATUS_LABEL[p.status]} className={tone[p.status]} /></td>
                      <td className={cn(td, "text-muted-foreground")}>{p.category.name}</td>
                      <td className={cn(td, "text-right tabular-nums", p.stock === 0 ? "font-medium text-destructive" : p.stock <= LOW_STOCK_THRESHOLD ? "font-medium text-warning" : "")}>{p.stock === 0 ? "Rupture" : p.stock}</td>
                      <td className={cn(td, "text-right tabular-nums")}>
                        {formatPrice(p.priceCents, currency)}
                        {p.compareAtCents && <s className="ml-1.5 text-xs text-muted-foreground">{formatPrice(p.compareAtCents, currency)}</s>}
                      </td>
                      <td className={td}>
                        <div className="flex justify-end gap-1">
                          <Link href={`/admin/products/${p.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={`Modifier ${p.name}`}><Pencil aria-hidden /></Link>
                          <ConfirmAction action={deleteProduct.bind(null, p.id)} title={`Supprimer « ${p.name} » ?`} description="S'il figure dans des commandes, le produit sera archivé pour préserver l'historique. Sinon, il sera supprimé définitivement.">
                            <Trash2 aria-hidden /><span className="sr-only">Supprimer {p.name}</span>
                          </ConfirmAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t">
              <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} total={total} href={(n) => href({ page: n > 1 ? String(n) : undefined })} />
            </div>
          </>
        )}
      </Card>
    </>
  );
}
