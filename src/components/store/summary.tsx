import { useLocale, useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format";

export function TotalsRows({
  subtotalCents,
  discountCents,
  promoCode,
  shippingCents,
  totalCents,
  currency,
}: {
  subtotalCents: number;
  discountCents: number;
  promoCode?: string | null;
  shippingCents: number | null;
  totalCents: number;
  currency: string;
}) {
  const t = useTranslations("cart");
  const td = useTranslations("delivery");
  const locale = useLocale();
  const price = (cents: number) => formatPrice(cents, currency, locale);
  return (
    <dl className="grid gap-2.5 text-sm tabular-nums">
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">{t("subtotal")}</dt>
        <dd>{price(subtotalCents)}</dd>
      </div>
      {discountCents > 0 && (
        <div className="flex justify-between gap-4 text-brand">
          <dt>{promoCode ? t("discountCode", { code: promoCode }) : t("discount")}</dt>
          <dd>−{price(discountCents)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">{t("shipping")}</dt>
        <dd className="text-right">{shippingCents == null ? t("shippingLater") : shippingCents === 0 ? td("free") : price(shippingCents)}</dd>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t pt-4 text-base">
        <dt className="font-medium">{t("total")}</dt>
        <dd className="display-sm text-2xl">{price(totalCents)}</dd>
      </div>
      <p className="text-[0.8125rem] text-muted-foreground">{t("taxes")}</p>
    </dl>
  );
}
