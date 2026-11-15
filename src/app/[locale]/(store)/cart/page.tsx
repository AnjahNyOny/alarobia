import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { CustomSummary } from "@/components/store/custom-summary";
import { PromoForm } from "@/components/store/promo-form";
import { CartLineControls } from "@/components/store/quantity";
import { TotalsRows } from "@/components/store/summary";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { promoLabel } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cart");
  return { title: t("pageTitle"), robots: { index: false } };
}

export default async function CartPage() {
  const [cart, settings, locale, t] = await Promise.all([getCart(), getSettings(), getLocale(), getTranslations("cart")]);
  const price = (cents: number) => formatPrice(cents, settings.currency, locale);

  if (cart.lines.length === 0)
    return (
      <div className="container-page pt-10 pb-10 md:pt-16">
        <h1 className="display text-5xl md:text-6xl">{t("emptyTitle")}</h1>
        <p className="mt-4 max-w-md text-lg text-muted-foreground">{t("emptyText")}</p>
        <Link href="/products" className={cn(buttonVariants({ size: "xl" }), "mt-7")}>
          {t("browse")}
        </Link>
      </div>
    );

  const blocked = cart.lines.some((l) => l.insufficientStock);

  return (
    <div className="container-page pt-8 md:pt-12">
      <h1 className="display text-5xl md:text-6xl">{t("pageTitle")}</h1>
      <div className="mt-8 grid gap-10 *:min-w-0 lg:grid-cols-[1fr_380px] lg:gap-14">
        <ul className="divide-y border-y">
          {cart.lines.map((line) => (
            <li key={line.key} className="flex gap-4 py-5 sm:gap-6">
              <Link href={`/products/${line.product.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-sm bg-stone sm:size-28">
                {line.image && <Image src={line.image} alt="" fill sizes="112px" className="object-cover" />}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <Link href={`/products/${line.product.slug}`} className="font-medium hover:underline hover:underline-offset-4">
                      {line.displayName}
                    </Link>
                    {line.custom && <CustomSummary custom={line.custom} className="mt-0.5" />}
                    <p className="mt-0.5 text-sm text-muted-foreground">{t("unit", { price: price(line.unitCents) })}</p>
                    {line.insufficientStock && (
                      <p role="alert" className="mt-1.5 text-sm text-destructive">
                        {line.product.stock === 0 ? t("noStock") : t("onlyLeft", { count: line.product.stock })}
                      </p>
                    )}
                  </div>
                  <p className="display-sm text-xl whitespace-nowrap tabular-nums">{price(line.lineTotalCents)}</p>
                </div>
                <CartLineControls lineKey={line.key} quantity={line.quantity} max={Math.max(line.maxQuantity, 1)} name={line.displayName} />
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-sm border-2 border-foreground p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="display-sm text-2xl">{t("summary")}</h2>
          <div className="mt-5">
            <PromoForm applied={cart.promo ? { code: cart.promo.code, label: promoLabel(cart.promo, price) } : null} />
          </div>
          <div className="mt-6">
            <TotalsRows subtotalCents={cart.subtotalCents} discountCents={cart.discountCents} promoCode={cart.promo?.code} shippingCents={null} totalCents={cart.subtotalCents - cart.discountCents} currency={settings.currency} />
          </div>
          {blocked ? (
            <p className="mt-6 rounded-sm bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{t("blocked")}</p>
          ) : (
            <Link href="/checkout" className={cn(buttonVariants({ size: "xl" }), "mt-6 w-full")}>
              {t("checkout")}
            </Link>
          )}
          <Link href="/products" className="mt-4 block text-sm underline underline-offset-4">
            {t("continue")}
          </Link>
        </aside>
      </div>
    </div>
  );
}
