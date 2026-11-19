import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { Card, EmptyState, PageHeader, td, th } from "@/components/admin/ui";
import { OrderStatus } from "@/components/order-status";
import { LOW_STOCK_THRESHOLD, REVENUE_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { calendarDayKey, formatDate, formatDateTime, formatPrice, madagascarDayKey } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { madagascarInstant, madagascarTime } from "@/lib/shipping";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth";

const PERIODS = [7, 30, 90];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.dashboard");
  return { title: t("metaTitle") };
}

type Translate = Awaited<ReturnType<typeof getTranslations<"admin.dashboard">>>;

function Kpi({ label, value, current, previous, days, t }: { label: string; value: string; current: number; previous: number; days: number; t: Translate }) {
  const delta = previous === 0 ? null : ((current - previous) / previous) * 100;
  const flat = delta != null && Math.abs(delta) < 0.5;
  const Icon = delta == null || flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-1 text-[0.8125rem] text-muted-foreground">
        <span className={cn("inline-flex shrink-0 items-center gap-0.5 font-medium whitespace-nowrap tabular-nums", delta == null || flat ? "" : delta > 0 ? "text-success" : "text-destructive")}>
          <Icon className="size-3.5" aria-hidden />
          {delta == null ? t("notAvailable") : t("delta", { value: `${delta > 0 ? "+" : ""}${delta.toFixed(0)}` })}
        </span>
        {t("versus", { days })}
      </p>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireAdmin();
  const days = PERIODS.includes(Number((await searchParams).p)) ? Number((await searchParams).p) : 30;
  const [{ currency }, locale, t, tc, to] = await Promise.all([getSettings(), getLocale(), getTranslations("admin.dashboard"), getTranslations("admin.common"), getTranslations("admin.orders")]);
  const price = (cents: number) => formatPrice(cents, currency, locale);
  // Les jours sont ceux de Madagascar, quel que soit le fuseau du serveur (UTC en production) : `today`, `firstDay` et
  // `prevFirstDay` sont des dates du calendrier malgache, `start` et `prevStart` les instants de leur minuit à Antananarivo.
  const today = madagascarTime();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
  const prevFirstDay = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() - days);
  const start = madagascarInstant(firstDay);
  const prevStart = madagascarInstant(prevFirstDay);

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
    const key = madagascarDayKey(o.createdAt);
    const e = byDay.get(key) ?? { revenueCents: 0, orders: 0 };
    e.revenueCents += o.totalCents;
    e.orders += 1;
    byDay.set(key, e);
  }
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + i);
    const key = calendarDayKey(d);
    return { date: key, label: formatDate(d, locale, "short"), ...(byDay.get(key) ?? { revenueCents: 0, orders: 0 }) };
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
      <PageHeader title={t("title")} description={t("range", { start: formatDate(firstDay, locale), end: formatDate(today, locale) })}>
        <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label={t("period")}>
          {PERIODS.map((p) => (
            <Link key={p} href={p === 30 ? "/admin" : `/admin?p=${p}`} aria-current={p === days ? "true" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", p === days ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t("days", { count: p })}
            </Link>
          ))}
        </div>
      </PageHeader>

      {(toShip > 0 || pending > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-brand/25 bg-brand/5 px-5 py-3.5 text-sm">
          <p className="font-medium">{t("todo")}</p>
          {toShip > 0 && (
            <Link href="/admin/orders?status=PAID" className="underline underline-offset-4">
              {t("toShip", { count: toShip })}
            </Link>
          )}
          {pending > 0 && (
            <Link href="/admin/orders?status=PENDING" className="underline underline-offset-4">
              {t("pending", { count: pending })}
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi t={t} label={t("revenue")} value={price(revenue)} current={revenue} previous={prevRevenue} days={days} />
        <Kpi t={t} label={t("orders")} value={String(cur.length)} current={cur.length} previous={prev.length} days={days} />
        <Kpi t={t} label={t("averageOrder")} value={price(aov)} current={aov} previous={prevAov} days={days} />
        <Kpi t={t} label={t("newCustomers")} value={String(newCustomers)} current={newCustomers} previous={prevCustomers} days={days} />
      </div>

      <div className="mt-4 grid gap-4 *:min-w-0 xl:grid-cols-[1.7fr_1fr]">
        <Card title={t("revenueByDay")} description={t("revenueByDayHint")}>
          <RevenueChart data={series} currency={currency} />
        </Card>
        <Card title={t("topSales")} description={t("topSalesHint")}>
          {topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noSales")}</p>
          ) : (
            <ol className="grid gap-3.5">
              {topProducts.map((p) => (
                <li key={p.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 font-medium whitespace-nowrap tabular-nums">{price(p.revenueCents)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (p.revenueCents / topMax) * 100)}%` }} />
                    </div>
                    <span className="min-w-14 shrink-0 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">{t("sold", { count: p.quantity })}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 *:min-w-0 xl:grid-cols-[1.7fr_1fr]">
        <Card title={t("recentOrders")} flush action={recent.length > 0 && <Link href="/admin/orders" className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{tc("viewAll")}</Link>}>
          {/* Boutique qui vient d'ouvrir : le même message que la liste des commandes, plutôt que des en-têtes de colonnes seuls. */}
          {recent.length === 0 ? (
            <EmptyState title={to("emptyTitle")} text={to("emptyText")} />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full">
                <thead className="border-y bg-muted/40">
                  <tr>
                    <th className={th}>{t("colOrder")}</th>
                    <th className={th}>{t("colCustomer")}</th>
                    <th className={th}>{t("colStatus")}</th>
                    <th className={cn(th, "text-right")}>{t("colTotal")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recent.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/40">
                      <td className={td}>
                        <Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">{o.number}</Link>
                        <p className="text-xs text-muted-foreground">{formatDateTime(o.createdAt, locale)}</p>
                      </td>
                      <td className={td}>{o.fullName}</td>
                      <td className={td}><OrderStatus status={o.status} /></td>
                      <td className={cn(td, "text-right whitespace-nowrap tabular-nums")}>{price(o.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title={t("lowStock")} description={t("lowStockHint", { count: LOW_STOCK_THRESHOLD })} flush>
          {lowStock.length === 0 ? (
            <EmptyState title={t("allInStock")} text={t("allInStockText")} />
          ) : (
            <ul className="divide-y border-t">
              {lowStock.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40">
                    <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">{p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="36px" className="object-cover" />}</div>
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    <span className={cn("text-sm font-medium tabular-nums", p.stock === 0 ? "text-destructive" : "text-warning")}>{p.stock === 0 ? t("outOfStock") : t("left", { count: p.stock })}</span>
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
