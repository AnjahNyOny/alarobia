"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { placeOrder } from "@/actions/checkout";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";
import { formatPrice } from "@/lib/format";
import { isMobileMoney, OPERATOR_NAME, type PaymentMethod } from "@/lib/payment";
import { AddressFields, type AddressDefaults } from "./address-fields";
import { cn } from "@/lib/utils";

type Defaults = AddressDefaults & { email?: string };

/** Zone proposée au client : textes et montant déjà préparés côté serveur, dans sa langue. */
export type ZoneChoice = { id: string; name: string; detail: string; costCents: number };

function Choice({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  aside,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  title: string;
  description: string;
  aside?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3.5 rounded-sm border p-4 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring", checked ? "border-foreground bg-highlight/25 shadow-[inset_0_0_0_1px_var(--foreground)]" : "border-input hover:border-foreground/50")}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="mt-1 size-4 accent-[var(--primary)]" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-[0.8125rem] text-muted-foreground">{description}</span>
      </span>
      {aside && <span className="font-medium whitespace-nowrap tabular-nums">{aside}</span>}
    </label>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-8 first:border-0 first:pt-0">
      {/* Numérotation justifiée : les quatre étapes se suivent. */}
      <h2 className="display-sm flex items-baseline gap-3 text-2xl">
        <span className="display text-3xl text-brand tabular-nums" aria-hidden>
          {n}
        </span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function CheckoutForm({
  defaults,
  zones,
  paymentMethods,
  currency,
  baseCents,
  signedIn,
  children,
}: {
  defaults: Defaults;
  /** Zones de livraison actives, dans l'ordre du back-office. Jamais vide : la page ne rend pas le formulaire sans zone. */
  zones: ZoneChoice[];
  /** Moyens de paiement ouverts : les opérateurs dont le vendeur a renseigné le numéro, puis le paiement à la livraison. */
  paymentMethods: PaymentMethod[];
  currency: string;
  /** Sous-total après réduction, hors livraison. */
  baseCents: number;
  signedIn: boolean;
  /** Récapitulatif des articles, rendu côté serveur. */
  children: React.ReactNode;
}) {
  const [state, action] = useActionState(placeOrder, {});
  const t = useTranslations("delivery");
  const locale = useLocale();
  const [zoneId, setZoneId] = useState(zones[0].id);
  const tp = useTranslations("payment");
  const tc = useTranslations("checkout");
  const tk = useTranslations("cart");
  const ta = useTranslations("address");
  const [payment, setPayment] = useState<string>(paymentMethods[0]);
  const e = state.fieldErrors ?? {};
  const shippingCents = (zones.find((z) => z.id === zoneId) ?? zones[0]).costCents;

  return (
    <Form action={action} draftKey="brouillon-commande" className="mt-8 grid gap-10 *:min-w-0 lg:grid-cols-[1fr_400px] lg:gap-16">
      <div className="grid gap-8 *:min-w-0">
        <Step n={1} title={tc("contact")}>
          <Field label={tc("email")} name="email" type="email" autoComplete="email" defaultValue={defaults.email} error={e.email} required hint={signedIn ? undefined : tc("emailHint")} />
        </Step>

        <Step n={2} title={tc("address")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <AddressFields defaults={defaults} errors={e} />
          </div>
        </Step>

        <Step n={3} title={t("legend")}>
          <fieldset className="grid min-w-0 gap-3">
            <legend className="sr-only">{t("legend")}</legend>
            {zones.map((zone) => (
              <Choice key={zone.id} name="shippingZoneId" value={zone.id} checked={zoneId === zone.id} onChange={setZoneId} title={zone.name} description={zone.detail} aside={zone.costCents === 0 ? t("free") : formatPrice(zone.costCents, currency, locale)} />
            ))}
          </fieldset>
          {e.shippingZoneId && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {e.shippingZoneId}
            </p>
          )}
        </Step>

        <Step n={4} title={tp("legend")}>
          <fieldset className="grid min-w-0 gap-3">
            <legend className="sr-only">{tp("legend")}</legend>
            {paymentMethods.map((method) =>
              isMobileMoney(method) ? (
                <Choice key={method} name="paymentMethod" value={method} checked={payment === method} onChange={setPayment} title={OPERATOR_NAME[method]} description={tp("mobileMoneyHint")} />
              ) : (
                <Choice key={method} name="paymentMethod" value={method} checked={payment === method} onChange={setPayment} title={tp("cod")} description={tp("codHint")} />
              ),
            )}
          </fieldset>
          {e.paymentMethod && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {e.paymentMethod}
            </p>
          )}
          <Field className="mt-5" as="textarea" label={tc("note")} name="note" optional={ta("optional")} placeholder={tc("notePlaceholder")} />
        </Step>
      </div>

      <aside className="h-fit rounded-sm border-2 border-foreground p-4 sm:p-6 lg:sticky lg:top-24">
        <h2 className="display-sm text-2xl">{tc("yourOrder")}</h2>
        {children}
        <dl className="mt-5 grid gap-2.5 border-t pt-5 text-sm tabular-nums">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{tk("shipping")}</dt>
            <dd>{shippingCents === 0 ? t("free") : formatPrice(shippingCents, currency, locale)}</dd>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between border-t pt-4 text-base">
            <dt className="font-medium">{tk("total")}</dt>
            <dd className="display-sm text-2xl" aria-live="polite">
              {formatPrice(baseCents + shippingCents, currency, locale)}
            </dd>
          </div>
          <p className="text-[0.8125rem] text-muted-foreground">{tk("taxes")}</p>
        </dl>
        <div className="mt-5 grid gap-3">
          <FormAlert state={state} />
          <SubmitButton size="xl" className="w-full">
            <Lock aria-hidden /> {tp("submit")}
          </SubmitButton>
          <p className="text-[0.8125rem] text-muted-foreground">{tc("terms")}</p>
        </div>
      </aside>
    </Form>
  );
}
