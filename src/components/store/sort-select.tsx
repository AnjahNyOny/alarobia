"use client";

import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

export const SORTS = [
  { value: "featured", label: "Sélection" },
  { value: "newest", label: "Nouveautés" },
  { value: "price-asc", label: "Prix croissant" },
  { value: "price-desc", label: "Prix décroissant" },
];

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Trier par</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("sort", e.target.value);
          next.delete("page");
          router.push(`${pathname}?${next}`);
        }}
        className="field-select h-9 w-auto"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
