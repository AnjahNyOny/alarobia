"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DesignSummary } from "@/lib/customization";
import { useCartUI } from "./cart-context";
import { CustomSummary } from "./custom-summary";
import { CartLineControls } from "./quantity";

export type DrawerLine = { key: string; name: string; slug: string; image: string | null; priceCents: number; quantity: number; max: number; custom: DesignSummary | null };

export function CartButton({ count, label }: { count: number; label: string }) {
  const { setOpen } = useCartUI();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="relative grid size-10 place-items-center rounded-md transition-colors hover:bg-muted"
      aria-label={label}
    >
      <ShoppingBag className="size-5" strokeWidth={1.75} aria-hidden />
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
  const t = useTranslations("cart");
  const locale = useLocale();
  const price = (cents: number) => formatPrice(cents, currency, locale);
  const remaining = freeShippingThresholdCents - subtotalCents;
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full gap-0 sm:max-w-md data-[side=right]:w-full">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="display-sm text-2xl">{t("title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("drawerDesc")}</SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-4 px-6">
            <p className="display text-3xl">{t("emptyTitle")}</p>
            <p className="text-muted-foreground">{t("emptyText")}</p>
            <Link href="/products" onClick={close} className={buttonVariants({ size: "md" })}>
              {t("browse")}
            </Link>
          </div>
        ) : (
          <>
            {freeShippingThresholdCents > 0 && <p className="bg-highlight px-5 py-2.5 text-sm font-medium text-highlight-foreground">{remaining > 0 ? t("freeRemaining", { amount: price(remaining) }) : t("freeReached")}</p>}
            <ul className="flex-1 divide-y overflow-y-auto px-5">
              {lines.map((line) => (
                <li key={line.key} className="flex gap-4 py-4">
                  <Link href={`/products/${line.slug}`} onClick={close} className="relative size-20 shrink-0 overflow-hidden rounded-sm bg-stone">
                    {line.image && <Image src={line.image} alt="" fill sizes="80px" className="object-cover" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/products/${line.slug}`} onClick={close} className="leading-snug font-medium hover:underline hover:underline-offset-4">
                          {line.name}
                        </Link>
                        {line.custom && <CustomSummary custom={line.custom} className="mt-0.5 text-[0.8125rem]" />}
                      </div>
                      <span className="font-medium whitespace-nowrap tabular-nums">{price(line.priceCents * line.quantity)}</span>
                    </div>
                    <CartLineControls lineKey={line.key} quantity={line.quantity} max={line.max} name={line.name} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t px-5 pt-4 pb-5">
              <div className="flex items-baseline justify-between gap-4">
                <span>{t("subtotal")}</span>
                <span className="display-sm text-2xl tabular-nums">{price(subtotalCents)}</span>
              </div>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">{t("taxesShipping")}</p>
              <div className="mt-4 grid gap-2">
                <Link href="/checkout" onClick={close} className={cn(buttonVariants({ size: "xl" }), "w-full")}>
                  {t("checkout")}
                </Link>
                <Link href="/cart" onClick={close} className={cn(buttonVariants({ size: "md", variant: "ghost" }), "w-full")}>
                  {t("view")}
                </Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
