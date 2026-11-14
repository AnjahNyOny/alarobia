import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { OrderForm } from "@/components/admin/order-form";
import { Card, PageHeader } from "@/components/admin/ui";
import { OrderStatus } from "@/components/order-status";
import { TotalsRows } from "@/components/store/summary";
import { PAYMENT_LABEL, SHIPPING_LABEL } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Commande" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, { currency }] = await Promise.all([db.order.findUnique({ where: { id }, include: { items: true, user: { select: { id: true, name: true } } } }), getSettings()]);
  if (!order) notFound();

  return (
    <>
      <PageHeader title={`Commande ${order.number}`} description={`Passée le ${formatDateTime(order.createdAt)}`} back={{ href: "/admin/orders", label: "Commandes" }}>
        <OrderStatus status={order.status} />
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-4">
          <Card title={`Articles (${order.items.reduce((s, i) => s + i.quantity, 0)})`} flush>
            <ul className="divide-y border-t">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">{item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" />}</div>
                  <div className="min-w-0 flex-1">
                    {item.productId ? (
                      <Link href={`/admin/products/${item.productId}`} className="text-sm font-medium underline-offset-4 hover:underline">{item.name}</Link>
                    ) : (
                      <p className="text-sm font-medium">{item.name}</p>
                    )}
                    <p className="text-[0.8125rem] text-muted-foreground tabular-nums">{item.quantity} × {formatPrice(item.priceCents, currency)}</p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">{formatPrice(item.quantity * item.priceCents, currency)}</p>
                </li>
              ))}
            </ul>
            <div className="border-t px-5 py-5 sm:ml-auto sm:max-w-xs">
              <TotalsRows subtotalCents={order.subtotalCents} discountCents={order.discountCents} promoCode={order.promoCode} shippingCents={order.shippingCents} totalCents={order.totalCents} currency={currency} />
            </div>
          </Card>
          {order.note && (
            <Card title="Note du client">
              <p className="text-sm leading-relaxed whitespace-pre-line">{order.note}</p>
            </Card>
          )}
        </div>
        <div className="grid content-start gap-4">
          <Card title="Traitement">
            <OrderForm id={order.id} status={order.status} trackingNumber={order.trackingNumber} />
          </Card>
          <Card title="Client">
            <div className="grid gap-4 text-sm">
              <div>
                {order.user ? (
                  <Link href={`/admin/customers/${order.user.id}`} className="font-medium underline-offset-4 hover:underline">{order.user.name}</Link>
                ) : (
                  <p className="font-medium">{order.fullName} <span className="font-normal text-muted-foreground">(sans compte)</span></p>
                )}
                <p><a href={`mailto:${order.email}`} className="text-muted-foreground underline-offset-4 hover:underline">{order.email}</a></p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Livraison</p>
                <address className="mt-1 leading-relaxed not-italic">
                  {order.fullName}<br />
                  {order.line1}<br />
                  {order.line2 && <>{order.line2}<br /></>}
                  {order.postalCode} {order.city}<br />
                  {order.country}<br />
                  {order.phone}
                </address>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Mode</p>
                <p className="mt-1">{SHIPPING_LABEL[order.shippingMethod]}</p>
                <p>{PAYMENT_LABEL[order.paymentMethod]}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
