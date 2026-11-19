import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, EmptyState, PageHeader, td, th } from "@/components/admin/ui";
import { OrderStatus } from "@/components/order-status";
import { REVENUE_STATUSES } from "@/lib/constants";
import { addressLines } from "@/lib/address";
import { db } from "@/lib/db";
import { formatMoment, formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.customers");
  return { title: t("detailMetaTitle") };
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [user, { currency }, t, locale] = await Promise.all([db.user.findUnique({ where: { id }, include: { address: true, orders: { orderBy: { createdAt: "desc" } } } }), getSettings(), getTranslations("admin.customers"), getLocale()]);
  if (!user) notFound();
  const paid = user.orders.filter((o) => REVENUE_STATUSES.includes(o.status));
  const spent = paid.reduce((s, o) => s + o.totalCents, 0);
  const stats = [
    [t("colSpent"), formatPrice(spent, currency, locale)],
    [t("colOrders"), String(user.orders.length)],
    [t("average"), paid.length ? formatPrice(Math.round(spent / paid.length), currency, locale) : "—"],
  ];
  return (
    <>
      <PageHeader title={user.name} description={t("since", { date: formatMoment(user.createdAt, locale) })} back={{ href: "/admin/customers", label: t("title") }} />
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
          <Card title={t("ordersTitle")} flush>
            {user.orders.length === 0 ? (
              <div className="border-t"><EmptyState title={t("noOrdersTitle")} text={t("noOrdersText")} /></div>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full">
                  <thead className="border-y bg-muted/40">
                    <tr>
                      <th className={th}>{t("colOrder")}</th>
                      <th className={th}>{t("colDate")}</th>
                      <th className={th}>{t("colStatus")}</th>
                      <th className={cn(th, "text-right")}>{t("colTotal")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {user.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/40">
                        <td className={td}><Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">{o.number}</Link></td>
                        <td className={cn(td, "text-muted-foreground")}>{formatMoment(o.createdAt, locale, "medium")}</td>
                        <td className={td}><OrderStatus status={o.status} /></td>
                        <td className={cn(td, "text-right tabular-nums")}>{formatPrice(o.totalCents, currency, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <Card title={t("contact")} className="h-fit">
          <div className="grid gap-4 text-sm">
            <div>
              <p><a href={`mailto:${user.email}`} className="underline-offset-4 hover:underline">{user.email}</a></p>
              {user.phone && <p className="text-muted-foreground">{user.phone}</p>}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t("savedAddress")}</p>
              {user.address ? (
                <address className="mt-1 leading-relaxed not-italic">
                  {addressLines(user.address).map((line) => (
                    <span key={line} className="block">{line}</span>
                  ))}
                </address>
              ) : (
                <p className="mt-1 text-muted-foreground">{t("noAddress")}</p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
