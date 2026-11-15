import type { CSSProperties } from "react";
import { Baloo_2, Caveat, Lora } from "next/font/google";
import type { FontKey } from "@/lib/customization";

/**
 * Polices proposées pour le texte imprimé. « Enseigne » est l'Archivo étroite des titres du site, déjà
 * chargée par la mise en page : on lit son nom dans la variable CSS `--font-archivo` plutôt que de la déclarer
 * une seconde fois (le fichier serait téléchargé en double). Les trois autres ne sont pas préchargées : le navigateur ne télécharge un
 * fichier que lorsqu'un texte l'utilise, donc quand le client ouvre la personnalisation et écrit.
 */
const ronde = Baloo_2({ subsets: ["latin"], display: "swap", preload: false });
const classique = Lora({ subsets: ["latin"], display: "swap", preload: false });
const manuscrite = Caveat({ subsets: ["latin"], display: "swap", preload: false });

const SITE_FONT = "var(--font-archivo)";
let siteFamily: string | undefined;
/** Un canevas ne comprend pas les variables CSS : on lui donne le nom réel de la police du site, lu une fois. */
const resolve = (family: string) => (family === SITE_FONT ? (siteFamily ??= getComputedStyle(document.documentElement).getPropertyValue("--font-archivo").trim() || "sans-serif") : family);

const FACES: Record<FontKey, { family: string; weight: number; stretch: "condensed" | "normal" }> = {
  enseigne: { family: SITE_FONT, weight: 800, stretch: "condensed" },
  ronde: { family: ronde.style.fontFamily, weight: 700, stretch: "normal" },
  classique: { family: classique.style.fontFamily, weight: 600, stretch: "normal" },
  manuscrite: { family: manuscrite.style.fontFamily, weight: 700, stretch: "normal" },
};

/** Police d'un canevas (`ctx.font`) pour une police du dessin et un corps en pixels. */
export function fontCss(font: FontKey, px: number) {
  const { family, weight, stretch } = FACES[font];
  return `${weight} ${stretch} ${px}px ${resolve(family)}`;
}

/** Style d'un élément HTML écrit dans cette police (le bouton qui la propose). */
export function fontStyle(font: FontKey): CSSProperties {
  const { family, weight, stretch } = FACES[font];
  return { fontFamily: family, fontWeight: weight, fontStretch: stretch };
}
