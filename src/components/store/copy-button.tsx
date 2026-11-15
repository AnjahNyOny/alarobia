"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";

/** Copie une valeur à recopier ailleurs sans faute (numéro marchand, montant). Sans presse-papiers, le bouton ne s'affiche pas en erreur : la valeur reste lisible à côté. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // presse-papiers refusé ou absent : rien à faire, la valeur est affichée
        }
      }}
      aria-label={`${t("copy")} : ${label}`}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-[0.8125rem] font-medium transition-colors hover:border-foreground/40 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
    </button>
  );
}
