import { useTranslations } from "next-intl";
import type { DesignSummary } from "@/lib/customization";
import { cn } from "@/lib/utils";

/** Rappel d'une personnalisation sous le nom de l'article : couleur, texte, présence d'une image. */
export function CustomSummary({ custom, className }: { custom: DesignSummary; className?: string }) {
  const t = useTranslations("customizer");
  const parts = [t(`colors.${custom.color}`), custom.text && t("summary.text", { text: custom.text }), custom.hasImage && t("summary.image")].filter(Boolean);
  return <p className={cn("text-sm break-words text-muted-foreground", className)}>{t("summary.label", { details: parts.join(", ") })}</p>;
}
