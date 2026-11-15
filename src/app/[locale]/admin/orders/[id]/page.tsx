import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { markPaid } from "@/actions/admin/orders";
import { ConfirmAction } from "@/components/admin/actions";
import { OrderForm } from "@/components/admin/order-form";
import { Card, PageHeader } from "@/components/admin/ui";
import { OrderStatus } from "@/components/order-status";
import { TotalsRows } from "@/components/store/summary";
import { addressLines } from "@/lib/address";
import { PAYMENT_LABEL } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { isMobileMoney, paymentState } from "@/lib/payment";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Commande" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, { currency }] = await Promise.all([db.order.findUnique({ where: { id }, include: { items: true, user: { select: { id: true, name: true } } } }), getSettings()]);
  if (!order) notFound();
  const payment = paymentState(order);

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
            <OrderForm id={order.id} status={order.status} trackingNumber={order.trackingNumber} unpaid={payment === "awaiting" || payment === "declared"} />
          </Card>
          <Card title="Paiement">
            <div className="grid gap-3 text-sm">
              <p className="font-medium">
                {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
                <span className="font-normal text-muted-foreground">, {formatPrice(order.totalCents, currency)}</span>
              </p>
              {payment === "awaiting" && <p className="text-muted-foreground">Le client n'a pas encore indiqué de référence de transaction. La commande reste en attente et son stock réservé ; annulez-la si le paiement ne vient pas.</p>}
              {payment === "declared" && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Référence déclarée par le client</p>
                  <p className="mt-1 font-mono text-base break-all">{order.paymentReference}</p>
                  {order.paymentDeclaredAt && <p className="text-muted-foreground">le {formatDateTime(order.paymentDeclaredAt)}</p>}
                  <p className="mt-2 text-muted-foreground">Vérifiez sur votre téléphone que cette transaction est bien arrivée, pour le bon montant, avant de confirmer.</p>
                </div>
              )}
              {payment === "received" && (
                <p className="text-muted-foreground">
                  {isMobileMoney(order.paymentMethod) ? "Paiement confirmé" : "Encaissé à la livraison"}
                  {order.paidAt ? ` le ${formatDateTime(order.paidAt)}` : ""}.{order.paymentReference && <> Référence : <span className="font-mono text-foreground">{order.paymentReference}</span></>}
                </p>
              )}
              {payment === "onDelivery" && <p className="text-muted-foreground">À encaisser par le livreur, en espèces.</p>}
              {payment === "void" && <p className="text-muted-foreground">Commande clôturée{order.paymentReference && <> ; référence déclarée : <span className="font-mono text-foreground">{order.paymentReference}</span></>}.</p>}
              {(payment === "awaiting" || payment === "declared") && (
                <ConfirmAction
                  action={markPaid.bind(null, order.id)}
                  title="Confirmer la réception du paiement ?"
                  description={`Vous confirmez avoir reçu ${formatPrice(order.totalCents, currency)} par ${PAYMENT_LABEL[order.paymentMethod]}. La commande passe à « payée » et peut être préparée.`}
                  confirmLabel="Paiement reçu"
                  variant={payment === "declared" ? "default" : "outline"}
                  size="md"
                  danger={false}
                >
                  Paiement reçu
                </ConfirmAction>
              )}
            </div>
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
                  {addressLines(order).map((line) => (
                    <span key={line} className="block">{line}</span>
                  ))}
                </address>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Zone de livraison</p>
                <p className="mt-1">{order.shippingZone}</p>
                {order.estimatedDelivery && <p className="text-muted-foreground">Promise au plus tard {formatDate(order.estimatedDelivery, "fr", "weekday")}</p>}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
