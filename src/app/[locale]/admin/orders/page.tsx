import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import type { Prisma } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import { Printer } from "lucide-react";
import { Card, EmptyState, PageHeader, Pagination, SearchForm, Tabs, td, th } from "@/components/admin/ui";
import { OrderStatus } from "@/components/order-status";
import { ORDER_STATUSES } from "@/lib/constants";
import { isPrinted, readOrderDesign } from "@/lib/customization";
import { db } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";
import { isMobileMoney, OPERATOR_NAME, paymentState } from "@/lib/payment";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.orders");
  return { title: t("metaTitle") };
}
const PER_PAGE = 15;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = ORDER_STATUSES.find((s) => s === sp.status);
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1") || 1);
  const search: Prisma.OrderWhereInput = q ? { OR: [{ number: { contains: q } }, { email: { contains: q } }, { fullName: { contains: q } }] } : {};
  const where: Prisma.OrderWhereInput = { ...search, ...(status && { status }) };

  const [{ currency }, orders, total, counts, t, ts, tp, locale] = await Promise.all([
    getSettings(),
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { _count: { select: { items: true } }, items: { where: { customization: { not: null } }, select: { quantity: true, customization: true } } } }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: search, _count: true }),
    getTranslations("admin.orders"),
    getTranslations("status"),
    getTranslations("payment"),
    getLocale(),
  ]);
  const methodName = (method: string) => (isMobileMoney(method) ? OPERATOR_NAME[method] : method === "COD" ? tp("cod") : method);
  // Objets à fabriquer : articles personnalisés portant un texte ou une image (un simple choix de couleur ne demande rien).
  const toPrint = (o: (typeof orders)[number]) =>
    o.items.reduce((sum, item) => {
      const custom = readOrderDesign(item.customization);
      return custom && isPrinted(custom.design) ? sum + item.quantity : sum;
    }, 0);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: status, q: q || undefined, ...patch })) if (v) next.set(k, v);
    return next.size ? `/admin/orders?${next}` : "/admin/orders";
  };

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Tabs
        current={status ?? ""}
        tabs={[{ value: "", label: t("tabAll"), href: href({ status: undefined }), count: counts.reduce((s, c) => s + c._count, 0) }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ts(s), href: href({ status: s }), count: countOf(s) }))]}
      />
      <Card flush className="mt-4">
        <div className="p-3">
          <SearchForm action="/admin/orders" placeholder={t("searchPlaceholder")} defaultValue={q} hidden={{ status: status }} />
        </div>
        {orders.length === 0 ? (
          <div className="border-t">
            <EmptyState title={t("emptyTitle")} text={q || status ? t("emptyFiltered") : t("emptyText")} />
          </div>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-y bg-muted/40">
                  <tr>
                    <th className={th}>{t("colOrder")}</th>
                    <th className={th}>{t("colDate")}</th>
                    <th className={th}>{t("colCustomer")}</th>
                    <th className={th}>{t("colPayment")}</th>
                    <th className={th}>{t("colStatus")}</th>
                    <th className={cn(th, "text-right")}>{t("colTotal")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/40">
                      <td className={td}>
                        <Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">{o.number}</Link>
                        <p className="text-xs text-muted-foreground">{t("items", { count: o._count.items })}</p>
                        {toPrint(o) > 0 && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium">
                            <Printer className="size-3.5 shrink-0" aria-hidden />
                            {t("toPrint", { count: toPrint(o) })}
                          </p>
                        )}
                      </td>
                      <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatDateTime(o.createdAt, locale)}</td>
                      <td className={td}>
                        {o.fullName}
                        <p className="text-xs text-muted-foreground">{o.email}</p>
                      </td>
                      <td className={cn(td, "text-muted-foreground")}>
                        {methodName(o.paymentMethod)}
                        {paymentState(o) === "declared" && <p className="text-xs font-medium text-brand">{t("paymentDeclared")}</p>}
                        {paymentState(o) === "awaiting" && <p className="text-xs">{t("paymentAwaiting")}</p>}
                      </td>
                      <td className={td}><OrderStatus status={o.status} /></td>
                      <td className={cn(td, "text-right font-medium tabular-nums")}>{formatPrice(o.totalCents, currency, locale)}</td>
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
