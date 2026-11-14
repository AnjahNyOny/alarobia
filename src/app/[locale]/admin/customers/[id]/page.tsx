import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { Card, EmptyState, PageHeader, td, th } from "@/components/admin/ui";
import { OrderStatus } from "@/components/order-status";
import { REVENUE_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Client" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, { currency }] = await Promise.all([db.user.findUnique({ where: { id }, include: { address: true, orders: { orderBy: { createdAt: "desc" } } } }), getSettings()]);
  if (!user) notFound();
  const paid = user.orders.filter((o) => REVENUE_STATUSES.includes(o.status));
  const spent = paid.reduce((s, o) => s + o.totalCents, 0);
  const stats = [
    ["Total dépensé", formatPrice(spent, currency)],
    ["Commandes", String(user.orders.length)],
    ["Panier moyen", paid.length ? formatPrice(Math.round(spent / paid.length), currency) : "—"],
  ];
  return (
    <>
      <PageHeader title={user.name} description={`Client depuis le ${formatDate(user.createdAt)}`} back={{ href: "/admin/customers", label: "Clients" }} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-4">
          <dl className="grid grid-cols-3 divide-x rounded-lg border bg-card">
            {stats.map(([label, value]) => (
              <div key={label} className="p-5">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-1.5 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <Card title="Commandes" flush>
            {user.orders.length === 0 ? (
              <div className="border-t"><EmptyState title="Aucune commande" text="Ce client n'a pas encore commandé." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-y bg-muted/40">
                    <tr>
                      <th className={th}>Commande</th>
                      <th className={th}>Date</th>
                      <th className={th}>Statut</th>
                      <th className={cn(th, "text-right")}>Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {user.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/40">
                        <td className={td}><Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">{o.number}</Link></td>
                        <td className={cn(td, "text-muted-foreground")}>{formatDate(o.createdAt, { dateStyle: "medium" })}</td>
                        <td className={td}><OrderStatus status={o.status} /></td>
                        <td className={cn(td, "text-right tabular-nums")}>{formatPrice(o.totalCents, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <Card title="Coordonnées" className="h-fit">
          <div className="grid gap-4 text-sm">
            <div>
              <p><a href={`mailto:${user.email}`} className="underline-offset-4 hover:underline">{user.email}</a></p>
              {user.phone && <p className="text-muted-foreground">{user.phone}</p>}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Adresse enregistrée</p>
              {user.address ? (
                <address className="mt-1 leading-relaxed not-italic">
                  {user.address.fullName}<br />
                  {user.address.line1}<br />
                  {user.address.line2 && <>{user.address.line2}<br /></>}
                  {user.address.postalCode} {user.address.city}<br />
                  {user.address.country}
                </address>
              ) : (
                <p className="mt-1 text-muted-foreground">Aucune adresse enregistrée.</p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
