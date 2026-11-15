"use client";

import { useCallback, useId, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cleanText, defaultDesign, inkFor, textLength, type CustomizerOptions } from "@/lib/customization";
import { DEMO_COLOR, DEMO_NAME, DEMO_STILL } from "@/lib/customizer/demo";

/**
 * Démonstration de la page d'accueil : on écrit son prénom, la tasse le porte. Tant que le visiteur n'a pas
 * touché le champ, la page ne montre qu'une photo de la tasse et ne télécharge rien de la personnalisation ;
 * au premier contact, l'objet en direct est chargé et prend la place de la photo.
 */
const LiveObject = dynamic(() => import("./live-object"), { ssr: false });

export function HomeDemo({ options, slug, name }: { options: CustomizerOptions; slug: string; name: string }) {
  const sample = DEMO_NAME;
  const t = useTranslations("home.demo");
  const tc = useTranslations("customizer");
  const id = useId();
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const [live, setLive] = useState(false);

  const shown = cleanText(text) || sample;
  const design = useMemo(() => ({ ...defaultDesign(options), color: DEMO_COLOR, ink: inkFor(DEMO_COLOR), text: shown, textSize: 60 }), [options, shown]);
  const ready = useCallback(() => setLive(true), []);

  return (
    <div className="min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-sm bg-stone">
        {!live && <Image src={DEMO_STILL} alt={t("alt", { name: sample })} fill priority sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />}
        {touched && (
          <LiveObject template={options.template} design={design} label={`${tc("alt", { name, color: tc(`colors.${DEMO_COLOR}`) })}, ${tc("summary.text", { text: shown })}`} className="absolute inset-0" caption={false} waiting={false} onReady={ready} />
        )}
      </div>
      <label htmlFor={id} className="display mt-5 block text-3xl sm:text-4xl">
        {t("label")}
      </label>
      <div className="mt-3 flex flex-wrap gap-3">
        <input
          id={id}
          type="text"
          value={text}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={sample}
          onFocus={() => setTouched(true)}
          onChange={(e) => textLength(cleanText(e.target.value)) <= options.textMax && setText(e.target.value)}
          className="display-sm h-14 min-w-0 flex-[1_1_12rem] rounded-md border-2 border-foreground bg-card px-3.5 text-2xl outline-none placeholder:text-muted-foreground/60 focus-visible:ring-4 focus-visible:ring-ring/30"
        />
        <Link href={cleanText(text) ? `/products/${slug}?perso=${encodeURIComponent(cleanText(text))}` : `/products/${slug}`} className={buttonVariants({ size: "xl", className: "h-14 flex-[1_1_auto]" })}>
          {t("cta")}
        </Link>
      </div>
      <p className="mt-2.5 text-sm text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
