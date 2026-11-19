import { getLocale, getTranslations } from "next-intl/server";
import { OrderStatus } from "@/components/order-status";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoment, formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export default async function AccountOrdersPage() {
  const user = await requireUser();
  const [orders, { currency }, locale, t] = await Promise.all([
    db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { items: true } } } }),
    getSettings(),
    getLocale(),
    getTranslations("account"),
  ]);

  if (orders.length === 0)
    return (
      <div className="max-w-md">
        <h2 className="display text-3xl">{t("ordersEmptyTitle")}</h2>
        <p className="mt-3 text-muted-foreground">{t("ordersEmptyText")}</p>
        <Link href="/products" className={`${buttonVariants({ size: "md" })} mt-6`}>
          {t("ordersEmptyCta")}
        </Link>
      </div>
    );

  return (
    <>
      <h2 className="display text-3xl">{t("ordersTitle")}</h2>
      <ul className="mt-5 border-t">
        {orders.map((o) => (
          <li key={o.id} className="border-b">
            <Link href={`/account/orders/${o.id}`} className="grid gap-x-6 gap-y-1.5 py-4 hover:bg-muted/60 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center sm:px-3">
              <div>
                <p className="font-medium underline underline-offset-4">{o.number}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{t("orderLine", { date: formatMoment(o.createdAt, locale), count: o._count.items })}</p>
              </div>
              <div>
                <OrderStatus status={o.status} />
              </div>
              <p className="display-sm text-xl tabular-nums sm:text-right">{formatPrice(o.totalCents, currency, locale)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
