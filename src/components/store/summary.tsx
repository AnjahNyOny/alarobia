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
  return (
    <dl className="grid gap-2.5 text-sm tabular-nums">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Sous-total</dt>
        <dd>{formatPrice(subtotalCents, currency)}</dd>
      </div>
      {discountCents > 0 && (
        <div className="flex justify-between text-brand">
          <dt>Réduction{promoCode ? ` (${promoCode})` : ""}</dt>
          <dd>−{formatPrice(discountCents, currency)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Livraison</dt>
        <dd>{shippingCents == null ? "Calculée à l'étape suivante" : shippingCents === 0 ? "Offerte" : formatPrice(shippingCents, currency)}</dd>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between border-t pt-4 text-base">
        <dt className="font-medium">Total</dt>
        <dd className="text-xl font-medium">{formatPrice(totalCents, currency)}</dd>
      </div>
      <p className="text-[0.8125rem] text-muted-foreground">Taxes incluses</p>
    </dl>
  );
}
