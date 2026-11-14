import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PromoForm } from "@/components/store/promo-form";
import { CartLineControls } from "@/components/store/quantity";
import { TotalsRows } from "@/components/store/summary";
import { buttonVariants } from "@/components/ui/button";
import { getCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { shippingCost } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Panier", robots: { index: false } };

export default async function CartPage() {
  const [cart, settings] = await Promise.all([getCart(), getSettings()]);
  const { currency } = settings;

  if (cart.lines.length === 0)
    return (
      <div className="container-page grid justify-items-center gap-4 py-24 text-center">
        <h1 className="display text-4xl">Votre panier est vide</h1>
        <p className="max-w-sm text-muted-foreground">Ajoutez quelques articles : ils vous attendront ici pendant 30 jours.</p>
        <Link href="/produits" className={cn(buttonVariants({ size: "xl" }), "mt-2")}>
          Voir les produits
        </Link>
      </div>
    );

  const shipping = shippingCost("STANDARD", cart.subtotalCents - cart.discountCents, settings);
  const blocked = cart.lines.some((l) => l.insufficientStock);

  return (
    <div className="container-page pt-8 md:pt-12">
      <h1 className="display text-4xl md:text-5xl">Panier</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
        <ul className="divide-y border-y">
          {cart.lines.map((line) => (
            <li key={line.product.id} className="flex gap-4 py-5 sm:gap-6">
              <Link href={`/produits/${line.product.slug}`} className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-28">
                {line.image && <Image src={line.image} alt="" fill sizes="112px" className="object-cover" />}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                <div className="flex justify-between gap-4">
                  <div>
                    <Link href={`/produits/${line.product.slug}`} className="font-medium hover:underline hover:underline-offset-4">
                      {line.product.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted-foreground">{formatPrice(line.product.priceCents, currency)} l'unité</p>
                    {line.insufficientStock && (
                      <p role="alert" className="mt-1.5 text-sm text-destructive">
                        {line.product.stock === 0 ? "Cet article n'est plus en stock." : `Il n'en reste que ${line.product.stock}. Réduisez la quantité.`}
                      </p>
                    )}
                  </div>
                  <p className="font-medium whitespace-nowrap tabular-nums">{formatPrice(line.lineTotalCents, currency)}</p>
                </div>
                <CartLineControls productId={line.product.id} quantity={line.quantity} max={Math.min(Math.max(line.product.stock, 1), 10)} name={line.product.name} />
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-lg border bg-card p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-medium">Récapitulatif</h2>
          <div className="mt-5">
            <PromoForm applied={cart.promo ? { code: cart.promo.code, label: cart.promo.label } : null} />
          </div>
          <div className="mt-6">
            <TotalsRows subtotalCents={cart.subtotalCents} discountCents={cart.discountCents} promoCode={cart.promo?.code} shippingCents={shipping} totalCents={cart.subtotalCents - cart.discountCents + shipping} currency={currency} />
          </div>
          {blocked ? (
            <p className="mt-6 rounded-lg bg-destructive/5 px-3 py-2.5 text-sm text-destructive">Ajustez les quantités signalées pour continuer.</p>
          ) : (
            <Link href="/commande" className={cn(buttonVariants({ size: "xl" }), "mt-6 w-full")}>
              Passer la commande
            </Link>
          )}
          <Link href="/produits" className="mt-4 block text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Continuer mes achats
          </Link>
        </aside>
      </div>
    </div>
  );
}
