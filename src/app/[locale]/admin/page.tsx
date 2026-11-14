import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { Card, EmptyState, PageHeader, td, th } from "@/components/admin/ui";
import { OrderStatus } from "@/components/order-status";
import { LOW_STOCK_THRESHOLD, REVENUE_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30, 90];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function Kpi({ label, value, current, previous, days }: { label: string; value: string; current: number; previous: number; days: number }) {
  const delta = previous === 0 ? null : ((current - previous) / previous) * 100;
  const flat = delta != null && Math.abs(delta) < 0.5;
  const Icon = delta == null || flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-3 flex items-center gap-1 text-[0.8125rem] text-muted-foreground">
        <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", delta == null || flat ? "" : delta > 0 ? "text-success" : "text-destructive")}>
          <Icon className="size-3.5" aria-hidden />
          {delta == null ? "n. d." : `${delta > 0 ? "+" : ""}${delta.toFixed(0)} %`}
        </span>
        vs {days} jours précédents
      </p>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const days = PERIODS.includes(Number((await searchParams).p)) ? Number((await searchParams).p) : 30;
  const { currency } = await getSettings();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const prevStart = new Date(start.getTime() - days * 864e5);

  const [orders, newCustomers, prevCustomers, toShip, pending, lowStock, recent] = await Promise.all([
    db.order.findMany({ where: { createdAt: { gte: prevStart }, status: { in: REVENUE_STATUSES } }, select: { createdAt: true, totalCents: true, items: { select: { productId: true, name: true, imageUrl: true, quantity: true, priceCents: true } } } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: start } } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: prevStart, lt: start } } }),
    db.order.count({ where: { status: "PAID" } }),
    db.order.count({ where: { status: "PENDING" } }),
    db.product.findMany({ where: { status: "ACTIVE", stock: { lte: LOW_STOCK_THRESHOLD } }, orderBy: { stock: "asc" }, take: 6, include: { images: { orderBy: { position: "asc" }, take: 1 } } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 7 }),
  ]);

  const cur = orders.filter((o) => o.createdAt >= start);
  const prev = orders.filter((o) => o.createdAt < start);
  const sum = (list: typeof orders) => list.reduce((s, o) => s + o.totalCents, 0);
  const revenue = sum(cur);
  const prevRevenue = sum(prev);
  const aov = cur.length ? Math.round(revenue / cur.length) : 0;
  const prevAov = prev.length ? Math.round(prevRevenue / prev.length) : 0;

  const byDay = new Map<string, { revenueCents: number; orders: number }>();
  for (const o of cur) {
    const e = byDay.get(dayKey(o.createdAt)) ?? { revenueCents: 0, orders: 0 };
    e.revenueCents += o.totalCents;
    e.orders += 1;
    byDay.set(dayKey(o.createdAt), e);
  }
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date: d.toISOString(), label: formatDate(d, "fr", "short"), ...(byDay.get(dayKey(d)) ?? { revenueCents: 0, orders: 0 }) };
  });

  const top = new Map<string, { name: string; imageUrl: string | null; quantity: number; revenueCents: number }>();
  for (const o of cur)
    for (const it of o.items) {
      const key = it.productId ?? it.name;
      const e = top.get(key) ?? { name: it.name, imageUrl: it.imageUrl, quantity: 0, revenueCents: 0 };
      e.quantity += it.quantity;
      e.revenueCents += it.quantity * it.priceCents;
      top.set(key, e);
    }
  const topProducts = [...top.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 5);
  const topMax = topProducts[0]?.revenueCents ?? 1;

  return (
    <>
      <PageHeader title="Tableau de bord" description={`Du ${formatDate(start)} au ${formatDate(now)}`}>
        <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label="Période">
          {PERIODS.map((p) => (
            <Link key={p} href={p === 30 ? "/admin" : `/admin?p=${p}`} aria-current={p === days ? "true" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", p === days ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {p} jours
            </Link>
          ))}
        </div>
      </PageHeader>

      {(toShip > 0 || pending > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-brand/25 bg-brand/5 px-5 py-3.5 text-sm">
          <p className="font-medium">À traiter aujourd'hui</p>
          {toShip > 0 && (
            <Link href="/admin/orders?status=PAID" className="underline underline-offset-4">
              {toShip} commande{toShip > 1 ? "s" : ""} à expédier
            </Link>
          )}
          {pending > 0 && (
            <Link href="/admin/orders?status=PENDING" className="underline underline-offset-4">
              {pending} paiement{pending > 1 ? "s" : ""} en attente
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Chiffre d'affaires" value={formatPrice(revenue, currency)} current={revenue} previous={prevRevenue} days={days} />
        <Kpi label="Commandes" value={String(cur.length)} current={cur.length} previous={prev.length} days={days} />
        <Kpi label="Panier moyen" value={formatPrice(aov, currency)} current={aov} previous={prevAov} days={days} />
        <Kpi label="Nouveaux clients" value={String(newCustomers)} current={newCustomers} previous={prevCustomers} days={days} />
      </div>

      <div className="mt-4 grid gap-4 *:min-w-0 xl:grid-cols-[1.7fr_1fr]">
        <Card title="Chiffre d'affaires par jour" description="Commandes payées, expédiées ou livrées">
          <RevenueChart data={series} currency={currency} />
        </Card>
        <Card title="Meilleures ventes" description="Par chiffre d'affaires sur la période">
          {topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
          ) : (
            <ol className="grid gap-3.5">
              {topProducts.map((p) => (
                <li key={p.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 font-medium tabular-nums">{formatPrice(p.revenueCents, currency)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (p.revenueCents / topMax) * 100)}%` }} />
                    </div>
                    <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">{p.quantity} vendu{p.quantity > 1 ? "s" : ""}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 *:min-w-0 xl:grid-cols-[1.7fr_1fr]">
        <Card title="Dernières commandes" flush action={<Link href="/admin/orders" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Tout voir</Link>}>
          <div className="relative overflow-x-auto">
            <table className="w-full">
              <thead className="border-y bg-muted/40">
                <tr>
                  <th className={th}>Commande</th>
                  <th className={th}>Client</th>
                  <th className={th}>Statut</th>
                  <th className={cn(th, "text-right")}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/40">
                    <td className={td}>
                      <Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">{o.number}</Link>
                      <p className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</p>
                    </td>
                    <td className={td}>{o.fullName}</td>
                    <td className={td}><OrderStatus status={o.status} /></td>
                    <td className={cn(td, "text-right tabular-nums")}>{formatPrice(o.totalCents, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Stock faible" description={`${LOW_STOCK_THRESHOLD} unités ou moins`} flush>
          {lowStock.length === 0 ? (
            <EmptyState title="Tout est en stock" text="Aucun produit en ligne n'est sous le seuil d'alerte." />
          ) : (
            <ul className="divide-y border-t">
              {lowStock.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40">
                    <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">{p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="36px" className="object-cover" />}</div>
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    <span className={cn("text-sm font-medium tabular-nums", p.stock === 0 ? "text-destructive" : "text-warning")}>{p.stock === 0 ? "Rupture" : `${p.stock} restant${p.stock > 1 ? "s" : ""}`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
