"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { localeNames, locales } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Liens vers la même page dans chaque langue. `compact` affiche les codes (FR, EN, MG), sinon les noms complets. */
export function LanguageSwitcher({ compact = false, className }: { compact?: boolean; className?: string }) {
  const t = useTranslations("common");
  const current = useLocale();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const href = query ? `${pathname}?${query}` : pathname;
  return (
    <nav aria-label={t("language")} className={className}>
      <ul className={cn("flex items-center", compact ? "gap-0.5" : "flex-wrap gap-x-4 gap-y-1")}>
        {locales.map((locale) => (
          <li key={locale}>
            <Link
              href={href}
              locale={locale}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === current ? "true" : undefined}
              aria-label={compact ? localeNames[locale] : undefined}
              className={cn(
                "rounded-md transition-colors",
                compact ? "grid h-8 min-w-8 place-items-center px-1.5 text-xs font-medium uppercase" : "text-sm",
                locale === current ? (compact ? "bg-muted text-foreground" : "font-medium underline underline-offset-4") : "opacity-70 hover:opacity-100"
              )}
            >
              {compact ? locale : localeNames[locale]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
