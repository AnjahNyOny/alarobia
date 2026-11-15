"use client";

import { useEffect, useRef } from "react";

/**
 * Rangée des rayons du catalogue. Sur petit écran elle défile dans son cadre :
 * à l'arrivée, on amène le rayon ouvert dans le champ, sans faire bouger la page.
 */
export function AisleStrip({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const strip = ref.current;
    const current = strip?.querySelector<HTMLElement>("[aria-current]");
    if (strip && current) strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2;
  });
  return (
    <nav ref={ref} aria-label={label} className="relative mt-7 overflow-x-auto border-y">
      {children}
    </nav>
  );
}
