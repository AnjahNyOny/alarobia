import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { OrderStatus } from "@/components/order-status";
import { OrderView } from "@/components/store/order-view";
import { PaymentPanel } from "@/components/store/payment-panel";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export default async function AccountOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  // Le filtre userId empêche de consulter la commande d'un autre client en changeant l'identifiant.
  const [order, settings, locale, t] = await Promise.all([db.order.findFirst({ where: { id, userId: user.id }, include: { items: true } }), getSettings(), getLocale(), getTranslations("order")]);
  if (!order) notFound();
  return (
    <>
      <Link href="/account" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
        {t("back")}
      </Link>
      <div className="mt-4 mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="display text-3xl">{t("heading", { number: order.number })}</h2>
        <OrderStatus status={order.status} />
        <p className="w-full text-sm text-muted-foreground">{t("placed", { date: formatDate(order.createdAt, locale) })}</p>
      </div>
      <div className="mb-10 max-w-2xl">
        <PaymentPanel order={order} settings={settings} />
      </div>
      <OrderView order={order} currency={settings.currency} />
    </>
  );
}
