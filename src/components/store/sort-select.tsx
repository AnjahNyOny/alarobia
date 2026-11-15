"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

const SORTS = [
  ["featured", "sortFeatured"],
  ["newest", "sortNewest"],
  ["price-asc", "sortPriceAsc"],
  ["price-desc", "sortPriceDesc"],
] as const;

export function SortSelect({ value }: { value: string }) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t("sort")}</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("sort", e.target.value);
          next.delete("page");
          router.push(`${pathname}?${next}`);
        }}
        className="field-select h-10 w-auto"
      >
        {SORTS.map(([key, label]) => (
          <option key={key} value={key}>
            {t(label)}
          </option>
        ))}
      </select>
    </label>
  );
}
