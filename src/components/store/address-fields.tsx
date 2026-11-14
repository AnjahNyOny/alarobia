"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/components/form";
import { PROVINCES } from "@/lib/address";

export type AddressDefaults = Partial<Record<"fullName" | "phone" | "line1" | "line2" | "district" | "city" | "province" | "postalCode", string | null>>;

/**
 * Champs d'une adresse malgache, partagés par la commande et l'espace client.
 * À placer dans une grille à deux colonnes. L'ordre suit la façon dont on donne son adresse :
 * qui, comment le joindre, le lot, le quartier, un repère, puis la ville et la province.
 */
export function AddressFields({ defaults, errors }: { defaults: AddressDefaults; errors: Record<string, string | undefined> }) {
  const t = useTranslations("address");
  const d = (key: keyof AddressDefaults) => defaults[key] ?? "";
  return (
    <>
      <Field label={t("fullName")} name="fullName" autoComplete="name" defaultValue={d("fullName")} error={errors.fullName} required />
      <Field label={t("phone")} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="034 12 345 67" defaultValue={d("phone")} error={errors.phone} required hint={t("phoneHint")} />
      <Field label={t("line1")} name="line1" autoComplete="address-line1" placeholder="Lot II M 45" defaultValue={d("line1")} error={errors.line1} required />
      <Field label={t("district")} name="district" autoComplete="address-level3" defaultValue={d("district")} error={errors.district} required />
      <Field className="sm:col-span-2" label={t("landmark")} name="line2" autoComplete="off" placeholder={t("landmarkPlaceholder")} defaultValue={d("line2")} error={errors.line2} optional={t("optional")} />
      <Field label={t("city")} name="city" autoComplete="address-level2" defaultValue={d("city")} error={errors.city} required />
      <Field as="select" label={t("province")} name="province" autoComplete="address-level1" defaultValue={d("province")} error={errors.province} required>
        <option value="">{t("provinceChoose")}</option>
        {PROVINCES.map((province) => (
          <option key={province}>{province}</option>
        ))}
      </Field>
      <Field label={t("postalCode")} name="postalCode" inputMode="numeric" autoComplete="postal-code" placeholder="101" defaultValue={d("postalCode")} error={errors.postalCode} optional={t("optional")} />
    </>
  );
}
