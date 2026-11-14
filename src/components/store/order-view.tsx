import Image from "next/image";
import type { Order, OrderItem } from "@prisma/client";
import { PAYMENT_LABEL, SHIPPING_LABEL } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { TotalsRows } from "./summary";

/** Détail d'une commande, partagé entre la confirmation et l'espace client. */
export function OrderView({ order, currency }: { order: Order & { items: OrderItem[] }; currency: string }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:gap-12">
      <div>
        <h2 className="text-lg font-medium">Articles</h2>
        <ul className="mt-4 divide-y border-y">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-4">
              <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-md bg-muted">{item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />}</div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} × {formatPrice(item.priceCents, currency)}
                </p>
              </div>
              <p className="tabular-nums">{formatPrice(item.priceCents * item.quantity, currency)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium">Adresse de livraison</h3>
            <address className="mt-2 text-sm leading-relaxed text-muted-foreground not-italic">
              {order.fullName}
              <br />
              {order.line1}
              {order.line2 && (
                <>
                  <br />
                  {order.line2}
                </>
              )}
              <br />
              {order.postalCode} {order.city}
              <br />
              {order.country}
              <br />
              {order.phone}
            </address>
          </div>
          <div>
            <h3 className="text-sm font-medium">Livraison et paiement</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {SHIPPING_LABEL[order.shippingMethod]}
              <br />
              {PAYMENT_LABEL[order.paymentMethod]}
              {order.trackingNumber && (
                <>
                  <br />
                  Suivi : <span className="font-mono text-foreground">{order.trackingNumber}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
      <aside className="h-fit rounded-lg border bg-card p-6">
        <h2 className="text-lg font-medium">Montant</h2>
        <div className="mt-5">
          <TotalsRows subtotalCents={order.subtotalCents} discountCents={order.discountCents} promoCode={order.promoCode} shippingCents={order.shippingCents} totalCents={order.totalCents} currency={currency} />
        </div>
      </aside>
    </div>
  );
}
