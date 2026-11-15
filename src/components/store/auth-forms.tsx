"use client";

import { useActionState } from "react";
import { login, register } from "@/actions/auth";
import { changePassword, updateAddress, updateProfile } from "@/actions/account";
import { useTranslations } from "next-intl";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";
import { AddressFields, type AddressDefaults } from "./address-fields";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(login, {});
  return (
    <Form action={action} className="grid gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={t("email")} name="email" type="email" autoComplete="email" required />
      <Field label={t("password")} name="password" type="password" autoComplete="current-password" required />
      <FormAlert state={state} />
      <SubmitButton size="xl" className="mt-1 w-full">
        {t("signIn")}
      </SubmitButton>
    </Form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(register, {});
  const e = state.fieldErrors ?? {};
  return (
    <Form action={action} className="grid gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={t("fullName")} name="name" autoComplete="name" error={e.name} required />
      <Field label={t("email")} name="email" type="email" autoComplete="email" error={e.email} required />
      <Field label={t("password")} name="password" type="password" autoComplete="new-password" error={e.password} hint={t("passwordHint")} required minLength={8} />
      <FormAlert state={state} />
      <SubmitButton size="xl" className="mt-1 w-full">
        {t("createAccount")}
      </SubmitButton>
    </Form>
  );
}

export function ProfileForm({ name, phone, email }: { name: string; phone: string | null; email: string }) {
  const t = useTranslations("account");
  const tu = useTranslations("auth");
  const ta = useTranslations("address");
  const [state, action] = useActionState(updateProfile, {});
  const e = state.fieldErrors ?? {};
  return (
    <Form action={action} className="grid gap-4">
      <Field label={tu("email")} name="email-display" defaultValue={email} disabled hint={t("emailHint")} />
      <Field label={tu("fullName")} name="name" autoComplete="name" defaultValue={name} error={e.name} required />
      <Field label={t("phone")} name="phone" type="tel" autoComplete="tel" defaultValue={phone ?? ""} error={e.phone} optional={ta("optional")} />
      <FormAlert state={state} />
      <div>
        <SubmitButton>{t("save")}</SubmitButton>
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
  const t = useTranslations("account");
  const tu = useTranslations("auth");
  const [state, action] = useActionState(changePassword, {});
  const e = state.fieldErrors ?? {};
  return (
    <Form action={action} className="grid gap-4" key={state.ok ? "done" : "form"}>
      <Field label={t("currentPassword")} name="current" type="password" autoComplete="current-password" error={e.current} required />
      <Field label={t("newPassword")} name="password" type="password" autoComplete="new-password" error={e.password} hint={tu("passwordHint")} required minLength={8} />
      <FormAlert state={state} />
      <div>
        <SubmitButton>{t("changePassword")}</SubmitButton>
      </div>
    </Form>
  );
}
