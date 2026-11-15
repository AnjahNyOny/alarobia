import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
  const [order, settings] = await Promise.all([db.order.findFirst({ where: { id, userId: user.id }, include: { items: true } }), getSettings()]);
  if (!order) notFound();
  return (
    <>
      <Link href="/account" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Toutes mes commandes
      </Link>
      <div className="mt-4 mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-2xl font-medium">Commande {order.number}</h2>
        <OrderStatus status={order.status} />
        <p className="w-full text-sm text-muted-foreground">Passée le {formatDate(order.createdAt)}</p>
      </div>
      <div className="mb-10 max-w-2xl">
        <PaymentPanel order={order} settings={settings} />
      </div>
      <OrderView order={order} currency={settings.currency} />
    </>
  );
}
