import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import type { Prisma } from "@prisma/client";
import { Card, EmptyState, PageHeader, Pagination, SearchForm, Tabs, td, th } from "@/components/admin/ui";
import { OrderStatus } from "@/components/order-status";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, PAYMENT_LABEL } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Commandes" };
const PER_PAGE = 15;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = ORDER_STATUSES.find((s) => s === sp.status);
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1") || 1);
  const search: Prisma.OrderWhereInput = q ? { OR: [{ number: { contains: q } }, { email: { contains: q } }, { fullName: { contains: q } }] } : {};
  const where: Prisma.OrderWhereInput = { ...search, ...(status && { status }) };

  const [{ currency }, orders, total, counts] = await Promise.all([
    getSettings(),
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { _count: { select: { items: true } } } }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: search, _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: status, q: q || undefined, ...patch })) if (v) next.set(k, v);
    return next.size ? `/admin/orders?${next}` : "/admin/orders";
  };

  return (
    <>
      <PageHeader title="Commandes" description="Suivez, expédiez et remboursez les commandes." />
      <Tabs
        current={status ?? ""}
        tabs={[{ value: "", label: "Toutes", href: href({ status: undefined }), count: counts.reduce((s, c) => s + c._count, 0) }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s], href: href({ status: s }), count: countOf(s) }))]}
      />
      <Card flush className="mt-4">
        <div className="p-3">
          <SearchForm action="/admin/orders" placeholder="Numéro, nom ou e-mail" defaultValue={q} hidden={{ status: status }} />
        </div>
        {orders.length === 0 ? (
          <div className="border-t">
            <EmptyState title="Aucune commande" text={q || status ? "Aucune commande ne correspond à ces critères." : "Les commandes apparaîtront ici dès le premier achat."} />
          </div>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-y bg-muted/40">
                  <tr>
                    <th className={th}>Commande</th>
                    <th className={th}>Date</th>
                    <th className={th}>Client</th>
                    <th className={th}>Paiement</th>
                    <th className={th}>Statut</th>
                    <th className={cn(th, "text-right")}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/40">
                      <td className={td}>
                        <Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">{o.number}</Link>
                        <p className="text-xs text-muted-foreground">{o._count.items} article{o._count.items > 1 ? "s" : ""}</p>
                      </td>
                      <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatDateTime(o.createdAt)}</td>
                      <td className={td}>
                        {o.fullName}
                        <p className="text-xs text-muted-foreground">{o.email}</p>
                      </td>
                      <td className={cn(td, "text-muted-foreground")}>{PAYMENT_LABEL[o.paymentMethod]}</td>
                      <td className={td}><OrderStatus status={o.status} /></td>
                      <td className={cn(td, "text-right font-medium tabular-nums")}>{formatPrice(o.totalCents, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t">
              <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} total={total} href={(p) => href({ page: p > 1 ? String(p) : undefined })} />
            </div>
          </>
        )}
      </Card>
    </>
  );
}
