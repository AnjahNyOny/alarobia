"use client";

import { useActionState } from "react";
import { login, register } from "@/actions/auth";
import { changePassword, updateAddress, updateProfile } from "@/actions/account";
import { useTranslations } from "next-intl";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";
import { AddressFields, type AddressDefaults } from "./address-fields";

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

export function AddressForm({ defaults }: { defaults: AddressDefaults }) {
  const t = useTranslations("address");
  const [state, action] = useActionState(updateAddress, {});
  return (
    <Form action={action} className="grid gap-4 sm:grid-cols-2">
      <AddressFields defaults={defaults} errors={state.fieldErrors ?? {}} />
      <div className="grid gap-3 sm:col-span-2">
        <FormAlert state={state} />
        <div>
          <SubmitButton>{t("save")}</SubmitButton>
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
