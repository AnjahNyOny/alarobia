import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { deletePromo, togglePromo } from "@/actions/admin/misc";
import { ConfirmAction, ToggleAction } from "@/components/admin/actions";
import { PromoForm } from "@/components/admin/small-forms";
import { Card, EmptyState, PageHeader, td, th } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { formatMoment, formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.promotions");
  return { title: t("metaTitle") };
}

export default async function PromosPage() {
  await requireAdmin();
  const [promos, { currency }, t, tc, locale] = await Promise.all([db.promoCode.findMany({ orderBy: { createdAt: "desc" } }), getSettings(), getTranslations("admin.promotions"), getTranslations("admin.common"), getLocale()]);
  const now = new Date();
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-4 *:min-w-0 lg:grid-cols-[1fr_340px]">
        <Card flush>
          {promos.length === 0 ? (
            <EmptyState title={t("emptyTitle")} text={t("emptyText")} />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className={th}>{t("colCode")}</th>
                    <th className={th}>{t("colDiscount")}</th>
                    <th className={th}>{t("colUses")}</th>
                    <th className={th}>{t("colExpiry")}</th>
                    <th className={th}>{t("colActive")}</th>
                    <th className={cn(th, "w-0")}><span className="sr-only">{tc("actions")}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {promos.map((p) => {
                    const expired = !!p.expiresAt && p.expiresAt < now;
                    return (
                      <tr key={p.id} className="hover:bg-muted/40">
                        <td className={td}>
                          <span className="font-mono text-[0.8125rem] font-medium">{p.code}</span>
                          {p.minSubtotalCents > 0 && <p className="text-xs text-muted-foreground">{t("minSubtotal", { amount: formatPrice(p.minSubtotalCents, currency, locale) })}</p>}
                        </td>
                        <td className={cn(td, "tabular-nums")}>{p.type === "PERCENT" ? t("percent", { value: p.value }) : formatPrice(p.value, currency, locale)}</td>
                        <td className={cn(td, "tabular-nums")}>{p.usedCount}{p.maxUses != null && <span className="text-muted-foreground"> / {p.maxUses}</span>}</td>
                        <td className={cn(td, expired ? "text-destructive" : "text-muted-foreground")}>{p.expiresAt ? (expired ? t("expired", { date: formatMoment(p.expiresAt, locale, "medium") }) : formatMoment(p.expiresAt, locale, "medium")) : t("noLimit")}</td>
                        <td className={td}><ToggleAction checked={p.active} action={togglePromo.bind(null, p.id)} label={t("toggle", { code: p.code })} /></td>
                        <td className={td}>
                          <ConfirmAction action={deletePromo.bind(null, p.id)} title={t("confirmTitle", { code: p.code })} description={t("confirmDescription")}>
                            <Trash2 aria-hidden /><span className="sr-only">{t("delete", { code: p.code })}</span>
                          </ConfirmAction>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title={t("newTitle")} className="h-fit">
          <PromoForm currency={currency} />
        </Card>
      </div>
    </>
  );
}
