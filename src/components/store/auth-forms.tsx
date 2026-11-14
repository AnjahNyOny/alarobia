"use client";

import { useActionState } from "react";
import { login, register } from "@/actions/auth";
import { changePassword, updateAddress, updateProfile } from "@/actions/account";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, {});
  return (
    <Form action={action} className="grid gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Adresse e-mail" name="email" type="email" autoComplete="email" required />
      <Field label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
      <FormAlert state={state} />
      <SubmitButton size="xl" className="mt-1 w-full">
        Se connecter
      </SubmitButton>
    </Form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState(register, {});
  const e = state.fieldErrors ?? {};
  return (
    <Form action={action} className="grid gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Nom complet" name="name" autoComplete="name" error={e.name} required />
      <Field label="Adresse e-mail" name="email" type="email" autoComplete="email" error={e.email} required />
      <Field label="Mot de passe" name="password" type="password" autoComplete="new-password" error={e.password} hint="8 caractères minimum." required minLength={8} />
      <FormAlert state={state} />
      <SubmitButton size="xl" className="mt-1 w-full">
        Créer mon compte
      </SubmitButton>
    </Form>
  );
}

export function ProfileForm({ name, phone, email }: { name: string; phone: string | null; email: string }) {
  const [state, action] = useActionState(updateProfile, {});
  const e = state.fieldErrors ?? {};
  return (
    <Form action={action} className="grid gap-4">
      <Field label="Adresse e-mail" name="email-display" defaultValue={email} disabled hint="Contactez-nous pour changer d'adresse e-mail." />
      <Field label="Nom complet" name="name" autoComplete="name" defaultValue={name} error={e.name} required />
      <Field label="Téléphone" name="phone" type="tel" autoComplete="tel" defaultValue={phone ?? ""} error={e.phone} optional />
      <FormAlert state={state} />
      <div>
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </Form>
  );
}

export function AddressForm({ countries, defaults }: { countries: string[]; defaults: Partial<Record<string, string | null>> }) {
  const [state, action] = useActionState(updateAddress, {});
  const e = state.fieldErrors ?? {};
  const d = (k: string) => defaults[k] ?? "";
  return (
    <Form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field className="sm:col-span-2" label="Nom complet" name="fullName" autoComplete="name" defaultValue={d("fullName")} error={e.fullName} required />
      <Field className="sm:col-span-2" label="Adresse" name="line1" autoComplete="address-line1" defaultValue={d("line1")} error={e.line1} required />
      <Field className="sm:col-span-2" label="Complément d'adresse" name="line2" autoComplete="address-line2" defaultValue={d("line2")} optional />
      <Field label="Code postal" name="postalCode" autoComplete="postal-code" defaultValue={d("postalCode")} error={e.postalCode} required />
      <Field label="Ville" name="city" autoComplete="address-level2" defaultValue={d("city")} error={e.city} required />
      <Field as="select" label="Pays" name="country" defaultValue={d("country") || countries[0]} error={e.country}>
        {countries.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Field>
      <Field label="Téléphone" name="phone" type="tel" autoComplete="tel" defaultValue={d("phone")} error={e.phone} required />
      <div className="grid gap-3 sm:col-span-2">
        <FormAlert state={state} />
        <div>
          <SubmitButton>Enregistrer l'adresse</SubmitButton>
        </div>
      </div>
    </Form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, {});
  const e = state.fieldErrors ?? {};
  return (
    <Form action={action} className="grid gap-4" key={state.ok ? "done" : "form"}>
      <Field label="Mot de passe actuel" name="current" type="password" autoComplete="current-password" error={e.current} required />
      <Field label="Nouveau mot de passe" name="password" type="password" autoComplete="new-password" error={e.password} hint="8 caractères minimum." required minLength={8} />
      <FormAlert state={state} />
      <div>
        <SubmitButton>Modifier le mot de passe</SubmitButton>
      </div>
    </Form>
  );
}
