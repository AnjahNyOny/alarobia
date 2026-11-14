"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCartUI } from "./cart-context";
import { CartLineControls } from "./quantity";

export type DrawerLine = { id: string; name: string; slug: string; image: string | null; priceCents: number; quantity: number; stock: number };

export function CartButton({ count }: { count: number }) {
  const { setOpen } = useCartUI();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="relative grid size-10 place-items-center rounded-lg transition-colors hover:bg-muted"
      aria-label={count ? `Ouvrir le panier, ${count} article${count > 1 ? "s" : ""}` : "Ouvrir le panier"}
    >
      <ShoppingBag className="size-5" strokeWidth={1.6} aria-hidden />
      {count > 0 && (
        <span className="absolute top-1 right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-brand px-1 text-[0.6875rem] font-semibold text-brand-foreground tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

export function CartDrawer({
  lines,
  subtotalCents,
  currency,
  freeShippingThresholdCents,
}: {
  lines: DrawerLine[];
  subtotalCents: number;
  currency: string;
  freeShippingThresholdCents: number;
}) {
  const { open, setOpen } = useCartUI();
  const remaining = freeShippingThresholdCents - subtotalCents;
  const progress = Math.min(100, Math.round((subtotalCents / Math.max(freeShippingThresholdCents, 1)) * 100));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full gap-0 sm:max-w-md data-[side=right]:w-full">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-base">Votre panier</SheetTitle>
          <SheetDescription className="sr-only">Contenu de votre panier</SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="display text-2xl">Votre panier est vide</p>
            <p className="text-muted-foreground">Parcourez la boutique : vos articles apparaîtront ici.</p>
            <Link href="/products" onClick={() => setOpen(false)} className={buttonVariants({ size: "md" })}>
              Voir les produits
            </Link>
          </div>
        ) : (
          <>
            {freeShippingThresholdCents > 0 && (
              <div className="border-b px-5 py-3.5">
                <p className="text-[0.8125rem]">
                  {remaining > 0 ? (
                    <>
                      Plus que <strong className="font-semibold">{formatPrice(remaining, currency)}</strong> pour la livraison offerte.
                    </>
                  ) : (
                    <>La livraison standard vous est offerte.</>
                  )}
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <ul className="flex-1 divide-y overflow-y-auto px-5">
              {lines.map((line) => (
                <li key={line.id} className="flex gap-4 py-4">
                  <Link href={`/products/${line.slug}`} onClick={() => setOpen(false)} className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                    {line.image && <Image src={line.image} alt="" fill sizes="80px" className="object-cover" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div className="flex justify-between gap-3">
                      <Link href={`/products/${line.slug}`} onClick={() => setOpen(false)} className="text-sm leading-snug font-medium hover:underline">
                        {line.name}
                      </Link>
                      <span className="text-sm whitespace-nowrap tabular-nums">{formatPrice(line.priceCents * line.quantity, currency)}</span>
                    </div>
                    <CartLineControls productId={line.id} quantity={line.quantity} max={Math.min(line.stock, 10)} name={line.name} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t px-5 pt-4 pb-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm">Sous-total</span>
                <span className="text-lg font-medium tabular-nums">{formatPrice(subtotalCents, currency)}</span>
              </div>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">Taxes incluses. Frais de livraison calculés à l'étape suivante.</p>
              <div className="mt-4 grid gap-2">
                <Link href="/checkout" onClick={() => setOpen(false)} className={cn(buttonVariants({ size: "xl" }), "w-full")}>
                  Passer la commande
                </Link>
                <Link href="/cart" onClick={() => setOpen(false)} className={cn(buttonVariants({ size: "md", variant: "ghost" }), "w-full")}>
                  Voir le panier
                </Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
