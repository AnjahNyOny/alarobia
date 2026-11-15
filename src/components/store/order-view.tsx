import Image from "next/image";
import type { Order, OrderItem } from "@prisma/client";
import { useLocale, useTranslations } from "next-intl";
import { addressLines } from "@/lib/address";
import { isMobileMoney, OPERATOR_NAME } from "@/lib/payment";
import { formatDate, formatPrice } from "@/lib/format";
import { TotalsRows } from "./summary";

/** Détail d'une commande, partagé entre la confirmation et l'espace client. */
export function OrderView({ order, currency }: { order: Order & { items: OrderItem[] }; currency: string }) {
  const t = useTranslations("delivery");
  const tp = useTranslations("payment");
  const locale = useLocale();
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
              {addressLines(order).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </div>
          <div>
            <h3 className="text-sm font-medium">Livraison et paiement</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {order.shippingZone}
              {order.estimatedDelivery && (
                <>
                  <br />
                  {t("expected", { date: formatDate(order.estimatedDelivery, locale, "weekday") })}
                </>
              )}
              <br />
              {isMobileMoney(order.paymentMethod) ? OPERATOR_NAME[order.paymentMethod] : tp("cod")}
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
