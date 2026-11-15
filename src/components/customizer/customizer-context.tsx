"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { defaultDesign, type CustomizerOptions, type Design } from "@/lib/customization";
import { ensureFont, loadImage } from "./texture";

/**
 * État partagé entre l'aperçu (colonne de gauche de la fiche) et les réglages (colonne de droite) :
 * l'onglet ouvert et le dessin en cours. Le dessin reste en mémoire quand on revient aux photos.
 */
type Mode = "photos" | "custom";
type Value = {
  options: CustomizerOptions;
  mode: Mode;
  setMode: (mode: Mode) => void;
  design: Design;
  change: (changes: Partial<Design>) => void;
};

const Context = createContext<Value | null>(null);

/** Enveloppe de la fiche produit : sans réglages de personnalisation, elle ne fait rien. */
/** `initialText` : prénom déjà écrit sur la page d'accueil ; la fiche s'ouvre alors sur l'onglet « Personnaliser ». */
export function CustomizerShell({ options, initialText = "", children }: { options: CustomizerOptions | null; initialText?: string; children: React.ReactNode }) {
  return options ? (
    <CustomizerProvider options={options} initialText={initialText}>
      {children}
    </CustomizerProvider>
  ) : (
    children
  );
}

function CustomizerProvider({ options, initialText, children }: { options: CustomizerOptions; initialText: string; children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(initialText ? "custom" : "photos");
  const [design, setDesign] = useState(() => ({ ...defaultDesign(options), text: initialText }));
  const change = useCallback((changes: Partial<Design>) => setDesign((d) => ({ ...d, ...changes })), []);
  const value = useMemo(() => ({ options, mode, setMode, design, change }), [options, mode, design, change]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** `null` hors d'un produit personnalisable. */
export const useCustomizer = () => useContext(Context);

/**
 * Ce qu'il faut avoir chargé avant de peindre : l'image du client et la police choisie. `ready` change
 * à chaque arrivée, pour que les canevas se repeignent (ils ne le font pas d'eux-mêmes).
 */
export function useDesignAssets(design: Design) {
  const [loaded, setLoaded] = useState<{
    name: string;
    element: HTMLImageElement;
  } | null>(null);
  const [ready, setReady] = useState(0);
  const { image, font, text } = design;

  useEffect(() => {
    if (!image) return;
    let current = true;
    loadImage(`/uploads/${image}`).then(
      (element) => current && setLoaded({ name: image, element }),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [image]);

  useEffect(() => {
    let current = true;
    ensureFont(font, text).then(() => current && setReady((n) => n + 1));
    return () => {
      current = false;
    };
  }, [font, text]);

  return {
    image: image && loaded?.name === image ? loaded.element : null,
    ready,
  };
}
