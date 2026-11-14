"use client";

import { useActionState, useEffect, useEffectEvent, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { createPromo, saveSettings } from "@/actions/admin/misc";
import { saveCategory } from "@/actions/admin/products";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";
import { buttonVariants } from "@/components/ui/button";
import { centsToInput } from "@/lib/format";
import type { FormState } from "@/lib/form";

function useToastOnSuccess(state: FormState, after?: () => void) {
  // useEffectEvent : l'effet lit toujours le dernier rappel sans se redéclencher quand il change.
  const onSuccess = useEffectEvent(() => after?.());
  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      onSuccess();
    }
  }, [state]);
}

export function CategoryForm({ category }: { category?: { id: string; name: string; description: string; position: number } }) {
  const [state, action] = useActionState(saveCategory.bind(null, category?.id ?? null), {});
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useToastOnSuccess(state, () => (category ? router.push("/admin/categories") : form.current?.reset()));
  const e = state.fieldErrors ?? {};
  return (
    <Form ref={form} action={action} className="grid gap-4" key={category?.id ?? "new"}>
      <Field label="Nom" name="name" defaultValue={category?.name} error={e.name} required />
      <Field as="textarea" label="Description" name="description" defaultValue={category?.description} optional rows={3} hint="Affichée en haut de la page catégorie." />
      <Field label="Position" name="position" type="number" min={0} defaultValue={category?.position ?? 0} hint="Ordre dans le menu : 0 en premier." />
      {state.error && <FormAlert state={state} />}
      <div className="flex gap-2">
        {category && <Link href="/admin/categories" className={buttonVariants({ variant: "outline", size: "md" })}>Annuler</Link>}
        <SubmitButton className="flex-1">{category ? "Enregistrer" : "Créer la catégorie"}</SubmitButton>
      </div>
    </Form>
  );
}

export function PromoForm({ currency }: { currency: string }) {
  const [state, action] = useActionState(createPromo, {});
  const [type, setType] = useState("PERCENT");
  const form = useRef<HTMLFormElement>(null);
  useToastOnSuccess(state, () => form.current?.reset());
  const e = state.fieldErrors ?? {};
  return (
    <Form ref={form} action={action} className="grid gap-4">
      <Field label="Code" name="code" error={e.code} required placeholder="PRINTEMPS15" hint="Les clients le saisissent dans leur panier." />
      <div className="grid grid-cols-2 gap-3">
        <Field as="select" label="Type" name="type" value={type} onChange={(ev) => setType(ev.target.value)}>
          <option value="PERCENT">Pourcentage</option>
          <option value="FIXED">Montant fixe</option>
        </Field>
        <Field label={type === "PERCENT" ? "Réduction (%)" : `Réduction (${currency})`} name="value" inputMode="decimal" error={e.value} required />
      </div>
      <Field label={`Achat minimum (${currency})`} name="minSubtotal" inputMode="decimal" error={e.minSubtotal} optional />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Utilisations max." name="maxUses" type="number" min={1} error={e.maxUses} optional />
        <Field label="Expire le" name="expiresAt" type="date" error={e.expiresAt} optional />
      </div>
      {state.error && <FormAlert state={state} />}
      <SubmitButton>Créer le code</SubmitButton>
    </Form>
  );
}

type Settings = { storeName: string; contactEmail: string; currency: string; announcement: string; shippingStandardCents: number; shippingExpressCents: number; freeShippingThresholdCents: number };

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action] = useActionState(saveSettings, {});
  useToastOnSuccess(state);
  const e = state.fieldErrors ?? {};
  const section = "grid gap-5 border-t py-7 first:border-0 first:pt-0 md:grid-cols-[240px_1fr] md:gap-10";
  return (
    <Form action={action}>
      <section className={section}>
        <div>
          <h2 className="text-sm font-semibold">Identité</h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">Nom affiché dans l'en-tête, le pied de page et les titres de page.</p>
        </div>
        <div className="grid max-w-xl gap-4">
          <Field label="Nom de la boutique" name="storeName" defaultValue={settings.storeName} error={e.storeName} required />
          <Field label="E-mail de contact" name="contactEmail" type="email" defaultValue={settings.contactEmail} error={e.contactEmail} required />
          <Field label="Bandeau d'annonce" name="announcement" defaultValue={settings.announcement} error={e.announcement} optional hint="Affiché tout en haut du site. Laissez vide pour le masquer." />
        </div>
      </section>
      <section className={section}>
        <div>
          <h2 className="text-sm font-semibold">Devise</h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">Change l'affichage des prix, sans conversion des montants.</p>
        </div>
        <div className="max-w-xl">
          <Field as="select" label="Devise" name="currency" defaultValue={settings.currency} error={e.currency}>
            <option value="EUR">Euro (EUR)</option>
            <option value="USD">Dollar américain (USD)</option>
            <option value="CHF">Franc suisse (CHF)</option>
            <option value="CAD">Dollar canadien (CAD)</option>
            <option value="MGA">Ariary malgache (MGA)</option>
          </Field>
        </div>
      </section>
      <section className={section}>
        <div>
          <h2 className="text-sm font-semibold">Livraison</h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">Tarifs appliqués au moment de la commande.</p>
        </div>
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <Field label="Standard" name="shippingStandard" inputMode="decimal" defaultValue={centsToInput(settings.shippingStandardCents)} error={e.shippingStandard} required />
          <Field label="Express" name="shippingExpress" inputMode="decimal" defaultValue={centsToInput(settings.shippingExpressCents)} error={e.shippingExpress} required />
          <Field className="sm:col-span-2" label="Livraison standard offerte à partir de" name="freeShippingThreshold" inputMode="decimal" defaultValue={centsToInput(settings.freeShippingThresholdCents)} error={e.freeShippingThreshold} hint="Saisissez 0 pour ne jamais l'offrir." />
        </div>
      </section>
      <div className="flex items-center justify-end gap-3 border-t pt-5">
        {state.error && <FormAlert state={state} />}
        <SubmitButton>Enregistrer les réglages</SubmitButton>
      </div>
    </Form>
  );
}
