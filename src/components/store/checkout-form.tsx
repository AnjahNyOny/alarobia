"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Lock, Smartphone, Truck, Wallet } from "lucide-react";
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
  icon: Icon,
  title,
  description,
  aside,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  aside?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3.5 rounded-lg border bg-card p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30", checked ? "border-foreground" : "border-input hover:border-foreground/40")}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="mt-1 size-4 accent-[var(--primary)]" />
      <Icon className="mt-0.5 hidden size-5 shrink-0 sm:block" strokeWidth={1.6} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-[0.8125rem] text-muted-foreground">{description}</span>
      </span>
      {aside && <span className="text-sm font-medium whitespace-nowrap tabular-nums">{aside}</span>}
    </label>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-8 first:border-0 first:pt-0">
      <h2 className="flex items-center gap-3 text-lg font-medium">
        <span className="grid size-7 place-items-center rounded-full bg-primary text-[0.8125rem] font-medium text-primary-foreground tabular-nums">{n}</span>
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
  const [payment, setPayment] = useState<string>(paymentMethods[0]);
  const e = state.fieldErrors ?? {};
  const shippingCents = (zones.find((z) => z.id === zoneId) ?? zones[0]).costCents;

  return (
    <Form action={action} draftKey="brouillon-commande" className="mt-8 grid gap-10 *:min-w-0 lg:grid-cols-[1fr_400px] lg:gap-16">
      <div className="grid gap-8 *:min-w-0">
        <Step n={1} title="Coordonnées">
          <Field label="Adresse e-mail" name="email" type="email" autoComplete="email" defaultValue={defaults.email} error={e.email} required hint={signedIn ? undefined : "Nous y envoyons la confirmation et le suivi de commande."} />
        </Step>

        <Step n={2} title="Adresse de livraison">
          <div className="grid gap-4 sm:grid-cols-2">
            <AddressFields defaults={defaults} errors={e} />
          </div>
        </Step>

        <Step n={3} title={t("legend")}>
          <fieldset className="grid min-w-0 gap-3">
            <legend className="sr-only">{t("legend")}</legend>
            {zones.map((zone) => (
              <Choice key={zone.id} name="shippingZoneId" value={zone.id} checked={zoneId === zone.id} onChange={setZoneId} icon={Truck} title={zone.name} description={zone.detail} aside={zone.costCents === 0 ? t("free") : formatPrice(zone.costCents, currency, locale)} />
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
                <Choice key={method} name="paymentMethod" value={method} checked={payment === method} onChange={setPayment} icon={Smartphone} title={OPERATOR_NAME[method]} description={tp("mobileMoneyHint")} />
              ) : (
                <Choice key={method} name="paymentMethod" value={method} checked={payment === method} onChange={setPayment} icon={Wallet} title={tp("cod")} description={tp("codHint")} />
              ),
            )}
          </fieldset>
          {e.paymentMethod && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {e.paymentMethod}
            </p>
          )}
          <Field className="mt-5" as="textarea" label="Note pour la livraison" name="note" optional placeholder="Code d'entrée, étage, créneau préféré…" />
        </Step>
      </div>

      <aside className="h-fit rounded-lg border bg-card p-4 sm:p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-medium">Votre commande</h2>
        {children}
        <dl className="mt-5 grid gap-2.5 border-t pt-5 text-sm tabular-nums">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Livraison</dt>
            <dd>{shippingCents === 0 ? t("free") : formatPrice(shippingCents, currency, locale)}</dd>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between border-t pt-4 text-base">
            <dt className="font-medium">Total</dt>
            <dd className="text-xl font-medium" aria-live="polite">
              {formatPrice(baseCents + shippingCents, currency, locale)}
            </dd>
          </div>
          <p className="text-[0.8125rem] text-muted-foreground">Taxes incluses</p>
        </dl>
        <div className="mt-5 grid gap-3">
          <FormAlert state={state} />
          <SubmitButton size="xl" className="w-full">
            <Lock aria-hidden /> {tp("submit")}
          </SubmitButton>
          <p className="text-center text-[0.8125rem] text-muted-foreground">En commandant, vous acceptez nos conditions générales de vente.</p>
        </div>
      </aside>
    </Form>
  );
}
