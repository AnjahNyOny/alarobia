import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteZone } from "@/actions/admin/shipping";
import { ConfirmAction } from "@/components/admin/actions";
import { ZoneForm } from "@/components/admin/small-forms";
import { Card, EmptyState, PageHeader, td, th } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.shipping");
  return { title: t("metaTitle") };
}

export default async function ShippingPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const [zones, settings, locale, t] = await Promise.all([db.shippingZone.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }), getSettings(), getLocale(), getTranslations("admin.shipping")]);
  const editing = zones.find((z) => z.id === edit);
  const { currency, freeShippingThresholdCents: threshold } = settings;
  return (
    <>
      <PageHeader
        title={t("title")}
        description={threshold > 0 ? t("descriptionFree", { amount: formatPrice(threshold, currency, locale) }) : t("descriptionNever")}
      />
      <div className="grid gap-4 *:min-w-0 lg:grid-cols-[1fr_340px]">
        <Card flush>
          {zones.length === 0 ? (
            <EmptyState title={t("emptyTitle")} text={t("emptyText")} />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className={th}>{t("colZone")}</th>
                    <th className={th}>{t("colDelay")}</th>
                    <th className={cn(th, "text-right")}>{t("colRate")}</th>
                    <th className={th}>{t("colState")}</th>
                    <th className={cn(th, "w-0")}><span className="sr-only">{t("colActions")}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {zones.map((z, i) => (
                    <tr key={z.id} className={cn("hover:bg-muted/40", z.id === editing?.id && "bg-muted/60")}>
                      <td className={td}>
                        <p className="font-medium">{z.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {z.nameEn && z.nameMg ? `${z.nameEn}, ${z.nameMg}` : t("translationMissing")}
                          {i === zones.findIndex((x) => x.active) && ` ${t("exampleZone")}`}
                        </p>
                      </td>
                      <td className={cn(td, "whitespace-nowrap tabular-nums")}>{z.minDays === z.maxDays ? t("daysSame", { max: z.maxDays }) : t("daysRange", { min: z.minDays, max: z.maxDays })}</td>
                      <td className={cn(td, "text-right whitespace-nowrap tabular-nums")}>{z.priceCents === 0 ? t("free") : formatPrice(z.priceCents, currency, locale)}</td>
                      <td className={cn(td, z.active ? "" : "text-muted-foreground")}>{z.active ? t("open") : t("closed")}</td>
                      <td className={td}>
                        <div className="flex justify-end gap-1">
                          <Link href={`/admin/shipping?edit=${z.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={t("edit", { name: z.name })}><Pencil aria-hidden /></Link>
                          <ConfirmAction action={deleteZone.bind(null, z.id)} title={t("confirmTitle", { name: z.name })} description={t("confirmDescription")} confirmLabel={t("confirm")} cancelLabel={t("cancel")}>
                            <Trash2 aria-hidden /><span className="sr-only">{t("delete", { name: z.name })}</span>
                          </ConfirmAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title={editing ? t("editTitle", { name: editing.name }) : t("newTitle")} className="h-fit">
          <ZoneForm zone={editing} currency={currency} nextPosition={zones.length} />
        </Card>
      </div>
    </>
  );
}
