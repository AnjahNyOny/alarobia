"use client";

import { useActionState, useEffect, useEffectEvent, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Locale } from "@/i18n/routing";
import { createPromo, saveSettings } from "@/actions/admin/misc";
import { saveCategory } from "@/actions/admin/products";
import { saveZone } from "@/actions/admin/shipping";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";
import { buttonVariants } from "@/components/ui/button";
import { centsToInput, currencyLabel } from "@/lib/format";
import type { FormState } from "@/lib/form";
import { CATEGORY_FIELDS, untranslatedFields } from "@/lib/localize";
import { FrenchReference, LanguageTabs } from "./language-tabs";

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

type CategoryTexts = { name: string; description: string };

export function CategoryForm({ category }: { category?: { id: string; name: string; description: string; position: number; translations: ({ locale: string } & CategoryTexts)[] } }) {
  return <CategoryFormInner key={category?.id ?? "new"} category={category} />;
}

function CategoryFormInner({ category }: { category?: { id: string; name: string; description: string; position: number; translations: ({ locale: string } & CategoryTexts)[] } }) {
  const [state, action] = useActionState(saveCategory.bind(null, category?.id ?? null), {});
  const t = useTranslations("admin.category");
  const tl = useTranslations("admin.languages");
  const ta = useTranslations("admin");
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const textsOf = (source?: Partial<CategoryTexts>): CategoryTexts => ({ name: source?.name ?? "", description: source?.description ?? "" });
  const initial = (): Record<Locale, CategoryTexts> => ({
    fr: textsOf(category),
    en: textsOf(category?.translations.find((tr) => tr.locale === "en")),
    mg: textsOf(category?.translations.find((tr) => tr.locale === "mg")),
  });
  const [texts, setTexts] = useState(initial);
  useToastOnSuccess(state, () => {
    if (category) router.push("/admin/categories");
    else {
      form.current?.reset();
      setTexts(initial());
    }
  });
  const e = state.fieldErrors ?? {};
  const fieldName = (field: keyof CategoryTexts, locale: Locale) => (locale === "fr" ? field : `${field}_${locale}`);
  const bind = (field: keyof CategoryTexts, locale: Locale) => ({
    name: fieldName(field, locale),
    value: texts[locale][field],
    error: e[fieldName(field, locale)],
    onChange: (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = ev.target.value;
      setTexts((prev) => ({ ...prev, [locale]: { ...prev[locale], [field]: value } }));
    },
  });
  const translated = (locale: "en" | "mg") => {
    const accessible = (label: string) => tl("inLanguage", { field: label, language: tl(`names.${locale}`) });
    return (
      <div className="grid gap-4">
        <p className="text-[0.8125rem] text-muted-foreground">{tl("fallbackNote")}</p>
        <Field label={t("name")} aria-label={accessible(t("name"))} lang={locale} maxLength={60} {...bind("name", locale)} />
        <FrenchReference text={texts.fr.name} />
        <Field as="textarea" label={t("description")} aria-label={accessible(t("description"))} lang={locale} maxLength={300} rows={3} {...bind("description", locale)} />
        <FrenchReference text={texts.fr.description} />
      </div>
    );
  };
  const hasError = (locale: Locale) => CATEGORY_FIELDS.some((f) => e[fieldName(f, locale)]);
  return (
    <Form ref={form} action={action} className="grid gap-4">
      <LanguageTabs
        response={state}
        missing={{ en: untranslatedFields(texts.fr, texts.en, CATEGORY_FIELDS).length, mg: untranslatedFields(texts.fr, texts.mg, CATEGORY_FIELDS).length }}
        errors={{ fr: hasError("fr"), en: hasError("en"), mg: hasError("mg") }}
        panels={{
          fr: (
            <div className="grid gap-4">
              <Field label={t("name")} required {...bind("name", "fr")} />
              <Field as="textarea" label={t("description")} optional={ta("optional")} rows={3} hint={t("descriptionHint")} {...bind("description", "fr")} />
            </div>
          ),
          en: translated("en"),
          mg: translated("mg"),
        }}
      />
      <Field label={t("position")} name="position" type="number" min={0} defaultValue={category?.position ?? 0} error={e.position} hint={t("positionHint")} />
      {state.error && <FormAlert state={state} />}
      <div className="flex flex-wrap gap-2">
        {category && <Link href="/admin/categories" className={buttonVariants({ variant: "outline", size: "md" })}>{t("cancel")}</Link>}
        <SubmitButton className="flex-1">{category ? t("save") : t("create")}</SubmitButton>
      </div>
    </Form>
  );
}

type Zone = { id: string; name: string; nameEn: string; nameMg: string; priceCents: number; minDays: number; maxDays: number; position: number; active: boolean };

export function ZoneForm({ zone, currency, nextPosition }: { zone?: Zone; currency: string; nextPosition: number }) {
  const [state, action] = useActionState(saveZone.bind(null, zone?.id ?? null), {});
  const t = useTranslations("admin.shipping.form");
  const ta = useTranslations("admin");
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useToastOnSuccess(state, () => (zone ? router.push("/admin/shipping") : form.current?.reset()));
  const e = state.fieldErrors ?? {};
  return (
    <Form ref={form} action={action} className="grid gap-4" key={zone?.id ?? "new"}>
      <Field label={t("name")} name="name" defaultValue={zone?.name} error={e.name} required placeholder={t("namePlaceholder")} />
      <div className="grid gap-3 *:min-w-0 min-[400px]:grid-cols-2">
        <Field label={t("nameEn")} name="nameEn" defaultValue={zone?.nameEn} error={e.nameEn} optional={ta("optional")} />
        <Field label={t("nameMg")} name="nameMg" defaultValue={zone?.nameMg} error={e.nameMg} optional={ta("optional")} />
      </div>
      <Field label={t("rate", { currency: currencyLabel(currency) })} name="price" inputMode="decimal" defaultValue={centsToInput(zone?.priceCents)} error={e.price} required placeholder={t("ratePlaceholder")} hint={t("rateHint")} />
      <div className="grid gap-3 *:min-w-0 min-[400px]:grid-cols-2">
        <Field label={t("minDays")} name="minDays" type="number" min={0} max={60} defaultValue={zone?.minDays ?? 1} error={e.minDays} required />
        <Field label={t("maxDays")} name="maxDays" type="number" min={0} max={60} defaultValue={zone?.maxDays ?? 3} error={e.maxDays} required />
      </div>
      <p className="-mt-2 text-[0.8125rem] text-muted-foreground">{t("daysHint")}</p>
      <Field label={t("position")} name="position" type="number" min={0} defaultValue={zone?.position ?? nextPosition} hint={t("positionHint")} />
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" name="active" defaultChecked={zone?.active ?? true} className="size-4 accent-[var(--primary)]" />
        {t("active")}
      </label>
      {state.error && <FormAlert state={state} />}
      <div className="flex flex-wrap gap-2">
        {zone && <Link href="/admin/shipping" className={buttonVariants({ variant: "outline", size: "md" })}>{t("cancel")}</Link>}
        <SubmitButton className="flex-1">{zone ? t("save") : t("create")}</SubmitButton>
      </div>
    </Form>
  );
}

export function PromoForm({ currency }: { currency: string }) {
  const [state, action] = useActionState(createPromo, {});
  const t = useTranslations("admin.promotions.form");
  const ta = useTranslations("admin");
  const [type, setType] = useState("PERCENT");
  const form = useRef<HTMLFormElement>(null);
  useToastOnSuccess(state, () => form.current?.reset());
  const e = state.fieldErrors ?? {};
  return (
    <Form ref={form} action={action} className="grid gap-4">
      <Field label={t("code")} name="code" error={e.code} required placeholder={t("codePlaceholder")} hint={t("codeHint")} />
      <div className="grid gap-3 *:min-w-0 min-[400px]:grid-cols-2">
        <Field as="select" label={t("type")} name="type" value={type} onChange={(ev) => setType(ev.target.value)}>
          <option value="PERCENT">{t("typePercent")}</option>
          <option value="FIXED">{t("typeFixed")}</option>
        </Field>
        <Field label={type === "PERCENT" ? t("valuePercent") : t("valueFixed", { currency: currencyLabel(currency) })} name="value" inputMode="decimal" error={e.value} required />
      </div>
      <Field label={t("minSubtotal", { currency: currencyLabel(currency) })} name="minSubtotal" inputMode="decimal" error={e.minSubtotal} optional={ta("optional")} />
      <div className="grid gap-3 *:min-w-0 min-[400px]:grid-cols-2">
        <Field label={t("maxUses")} name="maxUses" type="number" min={1} error={e.maxUses} optional={ta("optional")} />
        <Field label={t("expiresAt")} name="expiresAt" type="date" error={e.expiresAt} optional={ta("optional")} />
      </div>
      {state.error && <FormAlert state={state} />}
      <SubmitButton>{t("create")}</SubmitButton>
    </Form>
  );
}

type Settings = { storeName: string; contactEmail: string; currency: string; announcement: string; announcementEn: string; announcementMg: string; freeShippingThresholdCents: number; mvolaNumber: string; orangeMoneyNumber: string; airtelMoneyNumber: string; mobileMoneyName: string };

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action] = useActionState(saveSettings, {});
  const t = useTranslations("admin.settings");
  const ta = useTranslations("admin");
  useToastOnSuccess(state);
  const e = state.fieldErrors ?? {};
  const section = "grid gap-5 border-t py-7 first:border-0 first:pt-0 md:grid-cols-[240px_1fr] md:gap-10";
  return (
    <Form action={action}>
      <section className={section}>
        <div>
          <h2 className="text-sm font-semibold">{t("identityTitle")}</h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">{t("identityText")}</p>
        </div>
        <div className="grid max-w-xl gap-4">
          <Field label={t("storeName")} name="storeName" defaultValue={settings.storeName} error={e.storeName} required />
          <Field label={t("contactEmail")} name="contactEmail" type="email" defaultValue={settings.contactEmail} error={e.contactEmail} required />
          <Field label={t("announcement")} name="announcement" defaultValue={settings.announcement} error={e.announcement} optional={ta("optional")} maxLength={120} hint={t("announcementHint")} />
          <div className="grid gap-3 *:min-w-0 min-[400px]:grid-cols-2">
            <Field label={t("announcementEn")} name="announcementEn" lang="en" defaultValue={settings.announcementEn} error={e.announcementEn} optional={ta("optional")} maxLength={120} />
            <Field label={t("announcementMg")} name="announcementMg" lang="mg" defaultValue={settings.announcementMg} error={e.announcementMg} optional={ta("optional")} maxLength={120} />
          </div>
          <p className="-mt-2 text-[0.8125rem] text-muted-foreground">{t("announcementFallback")}</p>
        </div>
      </section>
      <section className={section}>
        <div>
          <h2 className="text-sm font-semibold">{t("currencyTitle")}</h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">{t("currencyText")}</p>
        </div>
        <div className="max-w-xl">
          <Field as="select" label={t("currency")} name="currency" defaultValue={settings.currency} error={e.currency}>
            {(["MGA", "EUR", "USD", "CHF", "CAD"] as const).map((c) => (
              <option key={c} value={c}>{t(`currencies.${c}`)}</option>
            ))}
          </Field>
        </div>
      </section>
      <section className={section}>
        <div>
          <h2 className="text-sm font-semibold">{t("deliveryTitle")}</h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
            {t.rich("deliveryText", { link: (chunks) => <Link href="/admin/shipping" className="text-foreground underline underline-offset-4">{chunks}</Link> })}
          </p>
        </div>
        <div className="max-w-xl">
          <Field label={t("freeShipping", { currency: currencyLabel(settings.currency) })} name="freeShippingThreshold" inputMode="decimal" defaultValue={centsToInput(settings.freeShippingThresholdCents)} error={e.freeShippingThreshold} hint={t("freeShippingHint")} />
        </div>
      </section>
      <section className={section}>
        <div>
          <h2 className="text-sm font-semibold">{t("momoTitle")}</h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">{t("momoText")}</p>
        </div>
        <div className="grid max-w-xl gap-4 *:min-w-0 sm:grid-cols-2">
          <Field label={t("number", { operator: "MVola" })} name="mvolaNumber" type="tel" defaultValue={settings.mvolaNumber} error={e.mvolaNumber} optional={ta("optional")} placeholder="034 00 000 00" />
          <Field label={t("number", { operator: "Orange Money" })} name="orangeMoneyNumber" type="tel" defaultValue={settings.orangeMoneyNumber} error={e.orangeMoneyNumber} optional={ta("optional")} placeholder="032 00 000 00" />
          <Field label={t("number", { operator: "Airtel Money" })} name="airtelMoneyNumber" type="tel" defaultValue={settings.airtelMoneyNumber} error={e.airtelMoneyNumber} optional={ta("optional")} placeholder="033 00 000 00" />
          <Field label={t("holder")} name="mobileMoneyName" defaultValue={settings.mobileMoneyName} error={e.mobileMoneyName} optional={ta("optional")} hint={t("holderHint")} />
        </div>
      </section>
      <div className="flex items-center justify-end gap-3 border-t pt-5">
        {state.error && <FormAlert state={state} />}
        <SubmitButton>{t("save")}</SubmitButton>
      </div>
    </Form>
  );
}
