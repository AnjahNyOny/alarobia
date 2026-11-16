"use client";

import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { localeNames, locales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Onglets Français / English / Malagasy d'un formulaire du back-office. Les trois panneaux restent
 * montés (le panneau fermé porte `hidden`) : tout part dans un seul envoi et changer d'onglet ne perd
 * rien. Une erreur ne reste jamais cachée dans un onglet fermé :
 * - à chaque réponse du serveur (`response` change), l'onglet de la première erreur s'ouvre ;
 * - si le navigateur refuse l'envoi (champ requis vide dans un onglet fermé), cet onglet s'ouvre
 *   avant que le navigateur n'affiche son message.
 */
export function LanguageTabs({
  panels,
  missing = {},
  errors = {},
  response,
}: {
  panels: Record<Locale, React.ReactNode>;
  /** Nombre de champs à traduire, par langue. */
  missing?: Partial<Record<Locale, number>>;
  /** Langues dont un champ porte une erreur. */
  errors?: Partial<Record<Locale, boolean>>;
  /** Réponse de l'action serveur : un nouvel objet à chaque envoi. */
  response?: unknown;
}) {
  const t = useTranslations("admin.languages");
  const id = useId();
  const [current, setCurrent] = useState<Locale>("fr");
  const [seen, setSeen] = useState(response);
  const root = useRef<HTMLDivElement>(null);

  if (response !== seen) {
    setSeen(response);
    const first = locales.find((l) => errors[l]);
    if (first && !errors[current]) setCurrent(first);
  }

  const select = (locale: Locale, focus = false) => {
    setCurrent(locale);
    if (focus) document.getElementById(`${id}-tab-${locale}`)?.focus();
  };

  return (
    <div
      ref={root}
      onInvalid={(e) => {
        const panel = (e.target as HTMLElement).closest<HTMLElement>("[data-locale-panel]");
        const visible = root.current?.querySelector(`[data-locale-panel="${current}"]`);
        // Une erreur déjà visible dans l'onglet ouvert : le navigateur la montrera, on ne bouge pas.
        if (!panel || !panel.hidden || visible?.querySelector(":invalid")) return;
        flushSync(() => setCurrent(panel.dataset.localePanel as Locale));
      }}
    >
      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="mb-4 flex flex-wrap gap-x-5 gap-y-1 border-b"
        onKeyDown={(e) => {
          const index = locales.indexOf(current);
          const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: locales.length - 1 }[e.key];
          if (next === undefined) return;
          e.preventDefault();
          select(locales[(next + locales.length) % locales.length], true);
        }}
      >
        {locales.map((locale) => {
          const active = locale === current;
          const count = missing[locale] ?? 0;
          return (
            <button
              key={locale}
              type="button"
              role="tab"
              id={`${id}-tab-${locale}`}
              aria-selected={active}
              aria-controls={`${id}-panel-${locale}`}
              // Seul l'onglet ouvert est dans l'ordre de tabulation ; les flèches passent d'un onglet à l'autre.
              tabIndex={active ? 0 : -1}
              onClick={() => select(locale)}
              className={cn(
                "-mb-px flex flex-col items-start border-b-2 pt-0.5 pb-2 text-left text-sm outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/30",
                active ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span lang={locale}>{localeNames[locale]}</span>
              {errors[locale] ? (
                <span className="text-xs font-medium text-destructive">{t("hasErrors")}</span>
              ) : count > 0 ? (
                <span className="text-xs font-normal text-warning tabular-nums">{t("missing", { count })}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {locales.map((locale) => (
        <div key={locale} id={`${id}-panel-${locale}`} role="tabpanel" aria-labelledby={`${id}-tab-${locale}`} hidden={locale !== current} data-locale-panel={locale}>
          {panels[locale]}
        </div>
      ))}
    </div>
  );
}

/** Texte français sous un champ à traduire, pour l'avoir sous les yeux sans changer d'onglet. */
export function FrenchReference({ text }: { text: string }) {
  const t = useTranslations("admin.languages");
  if (!text.trim()) return null;
  return (
    <div className="-mt-2 rounded-md bg-muted/60 px-3 py-2 text-[0.8125rem] leading-relaxed">
      <span className="font-medium">{t("reference")}</span>
      <p lang="fr" className="whitespace-pre-line text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
