"use client";

import { useTranslations } from "next-intl";
import { Gallery } from "@/components/store/gallery";
import { cleanText } from "@/lib/customization";
import { cn } from "@/lib/utils";
import { useCustomizer } from "./customizer-context";
import LiveObject from "./live-object";

/**
 * Colonne de gauche de la fiche d'un produit personnalisable : onglets « Photos » et « Personnaliser »,
 * puis soit la galerie, soit l'objet en direct (`live-object.tsx`). Rien de la 3D n'est téléchargé
 * tant que le second onglet n'est pas ouvert.
 */
export function Stage({ images, name }: { images: string[]; name: string }) {
  const { options, mode, setMode, design } = useCustomizer()!;
  const t = useTranslations("customizer");

  const text = cleanText(design.text);
  const label = [t("alt", { name, color: t(`colors.${design.color}`) }), text && t("summary.text", { text }), design.image && t("summary.image")].filter(Boolean).join(", ");

  const tab = (key: "photos" | "custom") => (
    <button
      key={key}
      type="button"
      role="tab"
      id={`onglet-${key}`}
      aria-selected={mode === key}
      aria-controls="scene-produit"
      // Seul l'onglet ouvert est dans l'ordre de tabulation ; les flèches passent de l'un à l'autre.
      tabIndex={mode === key ? 0 : -1}
      onClick={() => setMode(key)}
      className={cn("display-sm rounded-sm px-3.5 py-2 text-lg", mode === key ? "bg-highlight text-highlight-foreground" : "text-muted-foreground hover:text-foreground")}
    >
      {t(`tabs.${key}`)}
    </button>
  );

  return (
    // Sur téléphone, l'objet reste en haut de l'écran pendant qu'on fait défiler les réglages.
    <div className={cn("min-w-0", mode === "custom" && "sticky top-[4.5rem] z-10 -mx-4 bg-background px-4 pb-3 sm:-mx-6 sm:px-6 lg:top-24 lg:mx-0 lg:self-start lg:px-0 lg:pb-0")}>
      <div
        role="tablist"
        aria-label={t("tabs.label")}
        className="mb-3 flex gap-1.5"
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          const next = mode === "photos" ? "custom" : "photos";
          setMode(next);
          document.getElementById(`onglet-${next}`)?.focus();
        }}
      >
        {tab("photos")}
        {tab("custom")}
      </div>
      <div id="scene-produit" role="tabpanel" aria-labelledby={`onglet-${mode}`}>
        {mode === "photos" ? <Gallery images={images} name={name} /> : <LiveObject template={options.template} design={design} label={label} className="h-[34svh] min-h-56 rounded-sm bg-stone lg:aspect-square lg:h-auto" />}
      </div>
    </div>
  );
}
