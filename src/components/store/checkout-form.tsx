"use client";

import { useActionState, useState } from "react";
import { CreditCard, Info, Lock, Truck, Wallet, Zap } from "lucide-react";
import { placeOrder } from "@/actions/checkout";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Defaults = Partial<Record<"email" | "fullName" | "line1" | "line2" | "postalCode" | "city" | "country" | "phone", string>>;

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
      <Icon className="mt-0.5 size-5 shrink-0" strokeWidth={1.6} />
      <span className="flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-[0.8125rem] text-muted-foreground">{description}</span>
      </span>
      {aside && <span className="text-sm font-medium tabular-nums">{aside}</span>}
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
  countries,
  currency,
  baseCents,
  standardCents,
  expressCents,
  signedIn,
  children,
}: {
  defaults: Defaults;
  countries: string[];
  currency: string;
  /** Sous-total après réduction, hors livraison. */
  baseCents: number;
  standardCents: number;
  expressCents: number;
  signedIn: boolean;
  /** Récapitulatif des articles, rendu côté serveur. */
  children: React.ReactNode;
}) {
  const [state, action] = useActionState(placeOrder, {});
  const [shipping, setShipping] = useState("STANDARD");
  const [payment, setPayment] = useState("CARD");
  const e = state.fieldErrors ?? {};
  const shippingCents = shipping === "EXPRESS" ? expressCents : standardCents;

  return (
    <Form action={action} className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-16">
      <div className="grid gap-8">
        <Step n={1} title="Coordonnées">
          <Field label="Adresse e-mail" name="email" type="email" autoComplete="email" defaultValue={defaults.email} error={e.email} required hint={signedIn ? undefined : "Nous y envoyons la confirmation et le suivi de commande."} />
        </Step>

        <Step n={2} title="Adresse de livraison">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2" label="Nom complet" name="fullName" autoComplete="name" defaultValue={defaults.fullName} error={e.fullName} required />
            <Field className="sm:col-span-2" label="Adresse" name="line1" autoComplete="address-line1" defaultValue={defaults.line1} error={e.line1} required />
            <Field className="sm:col-span-2" label="Complément d'adresse" name="line2" autoComplete="address-line2" defaultValue={defaults.line2} error={e.line2} optional />
            <Field label="Code postal" name="postalCode" autoComplete="postal-code" defaultValue={defaults.postalCode} error={e.postalCode} required />
            <Field label="Ville" name="city" autoComplete="address-level2" defaultValue={defaults.city} error={e.city} required />
            <Field as="select" label="Pays" name="country" autoComplete="country-name" defaultValue={defaults.country ?? countries[0]} error={e.country}>
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Field>
            <Field label="Téléphone" name="phone" type="tel" autoComplete="tel" defaultValue={defaults.phone} error={e.phone} required hint="Pour le transporteur, le jour de la livraison." />
          </div>
        </Step>

        <Step n={3} title="Mode de livraison">
          <fieldset className="grid gap-3">
            <legend className="sr-only">Mode de livraison</legend>
            <Choice name="shippingMethod" value="STANDARD" checked={shipping === "STANDARD"} onChange={setShipping} icon={Truck} title="Standard" description="3 à 5 jours ouvrés, avec suivi" aside={standardCents === 0 ? "Offerte" : formatPrice(standardCents, currency)} />
            <Choice name="shippingMethod" value="EXPRESS" checked={shipping === "EXPRESS"} onChange={setShipping} icon={Zap} title="Express" description="24 à 48 h, remise contre signature" aside={formatPrice(expressCents, currency)} />
          </fieldset>
        </Step>

        <Step n={4} title="Paiement">
          <fieldset className="grid gap-3">
            <legend className="sr-only">Moyen de paiement</legend>
            <Choice name="paymentMethod" value="CARD" checked={payment === "CARD"} onChange={setPayment} icon={CreditCard} title="Carte bancaire" description="Visa, Mastercard, CB" />
            <Choice name="paymentMethod" value="COD" checked={payment === "COD"} onChange={setPayment} icon={Wallet} title="Paiement à la livraison" description="Réglez en espèces ou par carte au livreur" />
          </fieldset>
          {payment === "CARD" && (
            <p className="mt-3 flex gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              Boutique de démonstration : aucune carte n'est demandée ni débitée. La commande est enregistrée comme payée.
            </p>
          )}
          <Field className="mt-5" as="textarea" label="Note pour la livraison" name="note" optional placeholder="Code d'entrée, étage, créneau préféré…" />
        </Step>
      </div>

      <aside className="h-fit rounded-lg border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-medium">Votre commande</h2>
        {children}
        <dl className="mt-5 grid gap-2.5 border-t pt-5 text-sm tabular-nums">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Livraison</dt>
            <dd>{shippingCents === 0 ? "Offerte" : formatPrice(shippingCents, currency)}</dd>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between border-t pt-4 text-base">
            <dt className="font-medium">Total</dt>
            <dd className="text-xl font-medium" aria-live="polite">
              {formatPrice(baseCents + shippingCents, currency)}
            </dd>
          </div>
          <p className="text-[0.8125rem] text-muted-foreground">Taxes incluses</p>
        </dl>
        <div className="mt-5 grid gap-3">
          <FormAlert state={state} />
          <SubmitButton size="xl" className="w-full">
            <Lock aria-hidden /> {payment === "CARD" ? "Payer et commander" : "Confirmer la commande"}
          </SubmitButton>
          <p className="text-center text-[0.8125rem] text-muted-foreground">En commandant, vous acceptez nos conditions générales de vente.</p>
        </div>
      </aside>
    </Form>
  );
}
