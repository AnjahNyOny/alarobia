"use client";

import { useActionState } from "react";
import { Link } from "@/i18n/navigation";
import { saveProduct } from "@/actions/admin/products";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";
import { buttonVariants } from "@/components/ui/button";
import { PRODUCT_STATUS_LABEL, PRODUCT_STATUSES } from "@/lib/constants";
import { centsToInput, currencyLabel } from "@/lib/format";
import { ImageUploader } from "./image-uploader";
import { Card } from "./ui";

type Product = {
  id: string; name: string; slug: string; tagline: string; description: string; details: string;
  priceCents: number; compareAtCents: number | null; sku: string; stock: number; status: string;
  featured: boolean; categoryId: string; images: { url: string }[];
};

export function ProductForm({ product, categories, currency }: { product?: Product; categories: { id: string; name: string }[]; currency: string }) {
  const [state, action] = useActionState(saveProduct.bind(null, product?.id ?? null), {});
  const e = state.fieldErrors ?? {};
  return (
    <Form action={action} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="grid content-start gap-4">
        <Card title="Informations">
          <div className="grid gap-4">
            <Field label="Nom du produit" name="name" defaultValue={product?.name} error={e.name} required />
            <Field label="Accroche" name="tagline" defaultValue={product?.tagline} error={e.tagline} optional hint="Une ligne sous le titre : matière, format, usage." />
            <Field as="textarea" label="Description" name="description" defaultValue={product?.description} error={e.description} required rows={5} />
            <Field as="textarea" label="Caractéristiques" name="details" defaultValue={product?.details} error={e.details} optional rows={4} hint="Une caractéristique par ligne : elles s'affichent en liste sur la fiche." />
          </div>
        </Card>
        <Card title="Photos" description="La première photo sert de vignette dans le catalogue.">
          <ImageUploader initial={product?.images.map((i) => i.url) ?? []} />
        </Card>
        <Card title="Prix et stock">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Prix de vente (${currencyLabel(currency)})`} name="price" inputMode="decimal" defaultValue={centsToInput(product?.priceCents)} error={e.price} required placeholder={currency === "MGA" ? "25 000" : "0,00"} />
            <Field label={`Prix barré (${currencyLabel(currency)})`} name="compareAt" inputMode="decimal" defaultValue={centsToInput(product?.compareAtCents)} error={e.compareAt} optional placeholder={currency === "MGA" ? "30 000" : "0,00"} hint="Ancien prix, affiché barré en cas de promotion." />
            <Field label="Référence (SKU)" name="sku" defaultValue={product?.sku} error={e.sku} required />
            <Field label="Quantité en stock" name="stock" type="number" min={0} step={1} defaultValue={product?.stock ?? 0} error={e.stock} required />
          </div>
        </Card>
      </div>

      <div className="grid content-start gap-4">
        <Card title="Publication">
          <div className="grid gap-4">
            <Field as="select" label="Statut" name="status" defaultValue={product?.status ?? "ACTIVE"} hint="Seuls les produits « En ligne » sont visibles en boutique.">
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>{PRODUCT_STATUS_LABEL[s]}</option>
              ))}
            </Field>
            <Field as="select" label="Catégorie" name="categoryId" defaultValue={product?.categoryId ?? ""} error={e.categoryId} required>
              <option value="" disabled>Choisir…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Field>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="featured" defaultChecked={product?.featured} className="mt-0.5 size-4 accent-[var(--brand)]" />
              <span>
                <span className="font-medium">Mettre en avant</span>
                <span className="block text-[0.8125rem] text-muted-foreground">Apparaît dans « La sélection du moment » sur l'accueil.</span>
              </span>
            </label>
          </div>
        </Card>
        <Card title="Référencement">
          <Field label="Adresse de la page" name="slug" defaultValue={product?.slug} error={e.slug} optional hint="Laissez vide pour la générer depuis le nom." />
        </Card>
        <div className="sticky bottom-4 grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <FormAlert state={state} />
          <div className="flex gap-2">
            <Link href="/admin/products" className={buttonVariants({ variant: "outline", size: "md" })}>Annuler</Link>
            <SubmitButton className="flex-1">{product ? "Enregistrer" : "Créer le produit"}</SubmitButton>
          </div>
        </div>
      </div>
    </Form>
  );
}
