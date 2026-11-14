import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import type { Prisma } from "@prisma/client";
import { Card, EmptyState, PageHeader, Pagination, SearchForm, td, th } from "@/components/admin/ui";
import { REVENUE_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clients" };
const PER_PAGE = 15;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1") || 1);
  const where: Prisma.UserWhereInput = { role: "CUSTOMER", ...(q && { OR: [{ name: { contains: q } }, { email: { contains: q } }] }) };
  const [{ currency }, users, total] = await Promise.all([
    getSettings(),
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { address: { select: { city: true } }, orders: { where: { status: { in: REVENUE_STATUSES } }, select: { totalCents: true } } } }),
    db.user.count({ where }),
  ]);
  return (
    <>
      <PageHeader title="Clients" description="Les comptes créés sur la boutique et leurs achats." />
      <Card flush>
        <div className="p-3">
          <SearchForm action="/admin/customers" placeholder="Nom ou e-mail" defaultValue={q} />
        </div>
        {users.length === 0 ? (
          <div className="border-t"><EmptyState title="Aucun client" text={q ? "Aucun client ne correspond à cette recherche." : "Les clients apparaîtront ici dès leur inscription."} /></div>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-y bg-muted/40">
                  <tr>
                    <th className={th}>Client</th>
                    <th className={th}>Ville</th>
                    <th className={th}>Inscrit le</th>
                    <th className={cn(th, "text-right")}>Commandes</th>
                    <th className={cn(th, "text-right")}>Total dépensé</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/40">
                      <td className={td}>
                        <Link href={`/admin/customers/${u.id}`} className="font-medium underline-offset-4 hover:underline">{u.name}</Link>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className={cn(td, "text-muted-foreground")}>{u.address?.city ?? "—"}</td>
                      <td className={cn(td, "text-muted-foreground")}>{formatDate(u.createdAt, "fr", "medium")}</td>
                      <td className={cn(td, "text-right tabular-nums")}>{u.orders.length}</td>
                      <td className={cn(td, "text-right font-medium tabular-nums")}>{formatPrice(u.orders.reduce((s, o) => s + o.totalCents, 0), currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t"><Pagination page={page} pages={Math.ceil(total / PER_PAGE)} total={total} href={(n) => `/admin/customers?${new URLSearchParams({ ...(q && { q }), ...(n > 1 && { page: String(n) }) })}`} /></div>
          </>
        )}
      </Card>
    </>
  );
}
