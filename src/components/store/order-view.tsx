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
  const locale = useLocale();
  const tp = useTranslations("payment");
  const to = useTranslations("order");
  const price = (cents: number) => formatPrice(cents, currency, locale);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:gap-12">
      <div>
        <h2 className="display-sm text-2xl">{to("items")}</h2>
        <ul className="mt-4 divide-y border-y">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-sm bg-stone">{item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />}</div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} × {price(item.priceCents)}
                </p>
              </div>
              <p className="font-medium whitespace-nowrap tabular-nums">{price(item.priceCents * item.quantity)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="font-medium">{to("address")}</h3>
            <address className="mt-2 text-sm leading-relaxed text-muted-foreground not-italic">
              {addressLines(order).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </div>
          <div>
            <h3 className="font-medium">{to("deliveryPayment")}</h3>
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
                  {to("tracking")} <span className="font-medium text-foreground">{order.trackingNumber}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
      <aside className="h-fit rounded-sm border p-5 sm:p-6">
        <h2 className="display-sm text-2xl">{to("amount")}</h2>
        <div className="mt-5">
          <TotalsRows subtotalCents={order.subtotalCents} discountCents={order.discountCents} promoCode={order.promoCode} shippingCents={order.shippingCents} totalCents={order.totalCents} currency={currency} />
        </div>
      </aside>
    </div>
  );
}
