"use client";

import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { saveProduct } from "@/actions/admin/products";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";
import { buttonVariants } from "@/components/ui/button";
import { PRODUCT_STATUSES } from "@/lib/constants";
import { COLOR_KEYS, COLORS, MAX_TEXT, TEMPLATES } from "@/lib/customization";
import { centsToInput, currencyLabel } from "@/lib/format";
import { PRODUCT_FIELDS, untranslatedFields } from "@/lib/localize";
import { ImageUploader } from "./image-uploader";
import { FrenchReference, LanguageTabs } from "./language-tabs";
import { Card } from "./ui";

type Texts = Record<(typeof PRODUCT_FIELDS)[number], string>;

type Product = {
  id: string; name: string; slug: string; tagline: string; description: string; details: string;
  priceCents: number; compareAtCents: number | null; sku: string; stock: number; status: string;
  featured: boolean; categoryId: string; images: { url: string }[];
  translations: ({ locale: string } & Texts)[];
  customTemplate: string; customColors: string; customTextMax: number; customImage: boolean; customSurchargeCents: number;
};

const TRANSLATED = ["en", "mg"] as const;
type Translated = (typeof TRANSLATED)[number];
/** Longueurs maximales, identiques en français et dans les traductions (`saveProduct`). */
const MAX = { name: 120, tagline: 140, description: 5000, details: 3000 };

const textsOf = (source?: Partial<Texts>): Texts => ({ name: source?.name ?? "", tagline: source?.tagline ?? "", description: source?.description ?? "", details: source?.details ?? "" });

export function ProductForm({ product, categories, currency }: { product?: Product; categories: { id: string; name: string }[]; currency: string }) {
  const [state, action] = useActionState(saveProduct.bind(null, product?.id ?? null), {});
  const t = useTranslations("admin.product");
  const tc = useTranslations("admin.customization");
  const tl = useTranslations("admin.languages");
  const ta = useTranslations("admin");
  const colorsId = useId();
  const colorName = useTranslations("customizer.colors");
  const e = state.fieldErrors ?? {};

  // Textes tenus en mémoire : ils alimentent le compteur « à traduire » et le texte de référence pendant la saisie.
  const [texts, setTexts] = useState<Record<Locale, Texts>>(() => ({
    fr: textsOf(product),
    en: textsOf(product?.translations.find((tr) => tr.locale === "en")),
    mg: textsOf(product?.translations.find((tr) => tr.locale === "mg")),
  }));
  const [template, setTemplate] = useState(product?.customTemplate ?? "");
  const setText = (locale: Locale, field: keyof Texts) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = ev.target.value;
    setTexts((prev) => ({ ...prev, [locale]: { ...prev[locale], [field]: value } }));
  };

  const fieldName = (field: keyof Texts, locale: Locale) => (locale === "fr" ? field : `${field}_${locale}`);
  const hasError = (locale: Locale) => PRODUCT_FIELDS.some((f) => e[fieldName(f, locale)]);
  const missing = Object.fromEntries(TRANSLATED.map((l) => [l, untranslatedFields(texts.fr, texts[l], PRODUCT_FIELDS).length]));

  const translatedPanel = (locale: Translated) => {
    // Le nom accessible dit la langue : « Nom du produit (anglais) ».
    const props = (field: keyof Texts, label: string) => ({
      label,
      "aria-label": tl("inLanguage", { field: label, language: tl(`names.${locale}`) }),
      name: fieldName(field, locale),
      lang: locale,
      value: texts[locale][field],
      onChange: setText(locale, field),
      maxLength: MAX[field],
      error: e[fieldName(field, locale)],
    });
    return (
      <div className="grid gap-4">
        <p className="text-[0.8125rem] text-muted-foreground">{tl("fallbackNote")}</p>
        <Field {...props("name", t("name"))} />
        <FrenchReference text={texts.fr.name} />
        <Field {...props("tagline", t("tagline"))} />
        <FrenchReference text={texts.fr.tagline} />
        <Field as="textarea" {...props("description", t("description"))} rows={5} />
        <FrenchReference text={texts.fr.description} />
        <Field as="textarea" {...props("details", t("details"))} rows={4} />
        <FrenchReference text={texts.fr.details} />
      </div>
    );
  };

  const savedColors = new Set(product?.customColors.split(",").map((c) => c.trim()));

  return (
    <Form action={action} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="grid min-w-0 content-start gap-4">
        <Card title={t("info")}>
          <LanguageTabs
            response={state}
            missing={missing}
            errors={{ fr: hasError("fr"), en: hasError("en"), mg: hasError("mg") }}
            panels={{
              fr: (
                <div className="grid gap-4">
                  <Field label={t("name")} name="name" value={texts.fr.name} onChange={setText("fr", "name")} error={e.name} required />
                  <Field label={t("tagline")} name="tagline" value={texts.fr.tagline} onChange={setText("fr", "tagline")} error={e.tagline} optional={ta("optional")} hint={t("taglineHint")} />
                  <Field as="textarea" label={t("description")} name="description" value={texts.fr.description} onChange={setText("fr", "description")} error={e.description} required rows={5} />
                  <Field as="textarea" label={t("details")} name="details" value={texts.fr.details} onChange={setText("fr", "details")} error={e.details} optional={ta("optional")} rows={4} hint={t("detailsHint")} />
                </div>
              ),
              en: translatedPanel("en"),
              mg: translatedPanel("mg"),
            }}
          />
        </Card>
        <Card title={t("photos")} description={t("photosHint")}>
          <ImageUploader initial={product?.images.map((i) => i.url) ?? []} />
        </Card>
        <Card title={t("priceStock")}>
          <div className="grid gap-4 *:min-w-0 sm:grid-cols-2">
            <Field label={t("price", { currency: currencyLabel(currency) })} name="price" inputMode="decimal" defaultValue={centsToInput(product?.priceCents)} error={e.price} required placeholder={currency === "MGA" ? "25 000" : "0,00"} />
            <Field label={t("compareAt", { currency: currencyLabel(currency) })} name="compareAt" inputMode="decimal" defaultValue={centsToInput(product?.compareAtCents)} error={e.compareAt} optional={ta("optional")} placeholder={currency === "MGA" ? "30 000" : "0,00"} hint={t("compareAtHint")} />
            <Field label={t("sku")} name="sku" defaultValue={product?.sku} error={e.sku} required />
            <Field label={t("stock")} name="stock" type="number" min={0} step={1} defaultValue={product?.stock ?? 0} error={e.stock} required />
          </div>
        </Card>
        <Card title={tc("title")} description={tc("description")}>
          <div className="grid gap-4">
            <Field as="select" label={tc("template")} name="customTemplate" value={template} onChange={(ev) => setTemplate(ev.target.value)} error={e.customTemplate} hint={tc("templateHint")}>
              <option value="">{tc("templates.none")}</option>
              {TEMPLATES.map((key) => (
                <option key={key} value={key}>{tc(`templates.${key}`)}</option>
              ))}
            </Field>
            {/* Sans gabarit, les réglages restent dans la page (désactivés, donc ni envoyés ni validés) : rien n'est perdu si l'on revient en arrière. */}
            <fieldset disabled={!template} hidden={!template} className="grid min-w-0 gap-4">
              <fieldset className="min-w-0" aria-describedby={`${colorsId}-${e.customColors ? "error" : "hint"}`}>
                <legend className="text-sm font-medium">{tc("colors")}</legend>
                <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 min-[360px]:grid-cols-2 sm:grid-cols-4">
                  {COLOR_KEYS.map((key) => (
                    <label key={key} className="flex min-h-9 items-center gap-2.5 text-sm">
                      <input type="checkbox" name="customColors" value={key} defaultChecked={savedColors.has(key)} className="size-4 shrink-0 accent-[var(--brand)]" />
                      <span aria-hidden className="size-5 shrink-0 rounded-full border border-foreground/25" style={{ background: COLORS[key] }} />
                      {colorName(key)}
                    </label>
                  ))}
                </div>
                {e.customColors ? (
                  <p id={`${colorsId}-error`} className="mt-1.5 text-sm text-destructive">{e.customColors}</p>
                ) : (
                  <p id={`${colorsId}-hint`} className="mt-1.5 text-[0.8125rem] text-muted-foreground">{tc("colorsHint")}</p>
                )}
              </fieldset>
              <div className="grid gap-4 *:min-w-0 sm:grid-cols-2">
                <Field label={tc("textMax")} name="customTextMax" type="number" min={0} max={MAX_TEXT} step={1} defaultValue={product?.customTextMax ?? 0} error={e.customTextMax} hint={tc("textMaxHint", { max: MAX_TEXT })} />
                <Field label={tc("surcharge", { currency: currencyLabel(currency) })} name="customSurcharge" inputMode="decimal" defaultValue={product?.customSurchargeCents ? centsToInput(product.customSurchargeCents) : ""} error={e.customSurcharge} optional={ta("optional")} hint={tc("surchargeHint")} />
              </div>
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" name="customImage" defaultChecked={product?.customImage} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                <span>
                  <span className="font-medium">{tc("image")}</span>
                  <span className="block text-[0.8125rem] text-muted-foreground">{tc("imageHint")}</span>
                </span>
              </label>
            </fieldset>
          </div>
        </Card>
      </div>

      <div className="grid min-w-0 content-start gap-4">
        <Card title={t("publication")}>
          <div className="grid gap-4">
            <Field as="select" label={t("status")} name="status" defaultValue={product?.status ?? "ACTIVE"} error={e.status} hint={t("statusHint")}>
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>{t(`statuses.${s}`)}</option>
              ))}
            </Field>
            <Field as="select" label={t("category")} name="categoryId" defaultValue={product?.categoryId ?? ""} error={e.categoryId} required>
              <option value="" disabled>{t("categoryPlaceholder")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Field>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="featured" defaultChecked={product?.featured} className="mt-0.5 size-4 accent-[var(--brand)]" />
              <span>
                <span className="font-medium">{t("featured")}</span>
                <span className="block text-[0.8125rem] text-muted-foreground">{t("featuredHint")}</span>
              </span>
            </label>
          </div>
        </Card>
        <Card title={t("seo")}>
          <Field label={t("slug")} name="slug" defaultValue={product?.slug} error={e.slug} optional={ta("optional")} hint={t("slugHint")} />
        </Card>
        {/*
          Collée en bas de l'écran sur ordinateur seulement : la colonne de droite y est aussi haute que le formulaire.
          Sous 1024 px, la colonne n'est pas plus haute que son contenu et la barre recouvrait la carte « Publication » :
          elle reste à sa place, à la fin du formulaire, avec le message d'erreur juste au-dessus du bouton.
        */}
        <div className="grid gap-3 rounded-lg border bg-card p-4 lg:sticky lg:bottom-4 lg:shadow-sm">
          <FormAlert state={state} />
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/products" className={buttonVariants({ variant: "outline", size: "md" })}>{t("cancel")}</Link>
            <SubmitButton className="flex-1">{product ? t("save") : t("create")}</SubmitButton>
          </div>
        </div>
      </div>
    </Form>
  );
}
