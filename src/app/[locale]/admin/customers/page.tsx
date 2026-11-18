import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import type { Prisma } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, EmptyState, PageHeader, Pagination, SearchForm, td, th } from "@/components/admin/ui";
import { REVENUE_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.customers");
  return { title: t("metaTitle") };
}
const PER_PAGE = 15;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1") || 1);
  const text: Prisma.StringFilter = { contains: q, mode: "insensitive" }; // « rakoto » trouve Rakoto
  const where: Prisma.UserWhereInput = { role: "CUSTOMER", ...(q && { OR: [{ name: text }, { email: text }] }) };
  const [{ currency }, users, total, t, locale] = await Promise.all([
    getSettings(),
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { address: { select: { city: true } }, orders: { where: { status: { in: REVENUE_STATUSES } }, select: { totalCents: true } } } }),
    db.user.count({ where }),
    getTranslations("admin.customers"),
    getLocale(),
  ]);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Card flush>
        <div className="p-3">
          <SearchForm action="/admin/customers" placeholder={t("searchPlaceholder")} defaultValue={q} />
        </div>
        {users.length === 0 ? (
          <div className="border-t"><EmptyState title={t("emptyTitle")} text={q ? t("emptyFiltered") : t("emptyText")} /></div>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-y bg-muted/40">
                  <tr>
                    <th className={th}>{t("colCustomer")}</th>
                    <th className={th}>{t("colCity")}</th>
                    <th className={th}>{t("colJoined")}</th>
                    <th className={cn(th, "text-right")}>{t("colOrders")}</th>
                    <th className={cn(th, "text-right")}>{t("colSpent")}</th>
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
                      <td className={cn(td, "text-muted-foreground")}>{formatDate(u.createdAt, locale, "medium")}</td>
                      <td className={cn(td, "text-right tabular-nums")}>{u.orders.length}</td>
                      <td className={cn(td, "text-right font-medium tabular-nums")}>{formatPrice(u.orders.reduce((s, o) => s + o.totalCents, 0), currency, locale)}</td>
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
