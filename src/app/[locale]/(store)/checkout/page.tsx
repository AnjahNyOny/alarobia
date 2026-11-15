import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { redirectTo } from "@/i18n/server";
import { CheckoutForm } from "@/components/store/checkout-form";
import { CustomSummary } from "@/components/store/custom-summary";
import { getUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { db } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { availablePaymentMethods } from "@/lib/payment";
import { shippingCost } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { estimateDelivery, madagascarTime, zoneName } from "@/lib/shipping";
import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function CheckoutPage() {
  const [cart, settings, user] = await Promise.all([getCart(), getSettings(), getUser()]);
  if (cart.lines.length === 0 || cart.lines.some((l) => l.insufficientStock)) return redirectTo("/cart");
  const [address, zones, locale, t, tc, tk] = await Promise.all([
    user ? db.address.findUnique({ where: { userId: user.id } }) : null,
    db.shippingZone.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    getLocale(),
    getTranslations("delivery"),
    getTranslations("checkout"),
    getTranslations("cart"),
  ]);
  const price = (cents: number) => formatPrice(cents, settings.currency, locale);
  const { currency } = settings;
  const base = cart.subtotalCents - cart.discountCents;
  const today = madagascarTime();
  // Le délai et la date promise sont écrits ici, côté serveur : le navigateur du client peut être dans un autre fuseau.
  const choices = zones.map((zone) => ({
    id: zone.id,
    name: zoneName(zone, locale),
    detail: `${zone.minDays === zone.maxDays ? t("delaySingle", { days: zone.maxDays }) : t("delayRange", { min: zone.minDays, max: zone.maxDays })}, ${t("by", { date: formatDate(estimateDelivery(today, zone), locale, "weekday") })}`,
    costCents: shippingCost(zone, base, settings.freeShippingThresholdCents),
  }));

  if (choices.length === 0)
    return (
      <div className="container-page pt-8 md:pt-12">
        <h1 className="display text-5xl md:text-6xl">{tc("title")}</h1>
        <p className="mt-4 max-w-prose text-muted-foreground">{t("none", { email: settings.contactEmail })}</p>
      </div>
    );

  return (
    <div className="container-page pt-8 md:pt-12">
      <h1 className="display text-5xl md:text-6xl">{tc("title")}</h1>
      {!user && (
        <p className="mt-3 text-muted-foreground">
          {tc.rich("guest", {
            link: (chunks) => (
              <Link href="/login?next=/checkout" className="font-medium text-foreground underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}
      <CheckoutForm
        signedIn={!!user}
        zones={choices}
        paymentMethods={availablePaymentMethods(settings)}
        currency={currency}
        baseCents={base}
        defaults={{
          email: user?.email,
          fullName: address?.fullName ?? user?.name,
          phone: address?.phone ?? user?.phone,
          line1: address?.line1,
          line2: address?.line2,
          district: address?.district,
          city: address?.city,
          province: address?.province,
          postalCode: address?.postalCode,
        }}
      >
        <ul className="mt-5 grid gap-4">
          {cart.lines.map((l) => (
            <li key={l.key} className="flex items-center gap-3.5">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-stone">{l.image && <Image src={l.image} alt="" fill sizes="56px" className="object-cover" />}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug font-medium">{l.displayName}</p>
                {l.custom && <CustomSummary custom={l.custom} className="text-[0.8125rem]" />}
                <p className="text-[0.8125rem] text-muted-foreground">{tc("quantity", { count: l.quantity })}</p>
              </div>
              <p className="text-sm whitespace-nowrap tabular-nums">{price(l.lineTotalCents)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-5 grid gap-2.5 border-t pt-5 text-sm tabular-nums">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{tk("subtotal")}</dt>
            <dd>{price(cart.subtotalCents)}</dd>
          </div>
          {cart.promo && (
            <div className="flex justify-between text-brand">
              <dt>{tk("discountCode", { code: cart.promo.code })}</dt>
              <dd>−{price(cart.discountCents)}</dd>
            </div>
          )}
        </dl>
        {!cart.promo && (
          <p className="mt-3 text-[0.8125rem] text-muted-foreground">
            {tc.rich("promoHint", {
              link: (chunks) => (
                <Link href="/cart" className="underline underline-offset-4 hover:text-foreground">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
      </CheckoutForm>
    </div>
  );
}
