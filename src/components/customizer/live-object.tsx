"use client";

import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { RotateCcw, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Design, Template } from "@/lib/customization";
import { cn } from "@/lib/utils";
import { useDesignAssets } from "./customizer-context";
import type { Turn } from "./scene";
import { paintFlat } from "./texture";

/**
 * L'objet personnalisé, en direct : en 3D quand le navigateur le peut, à plat sinon, avec les mêmes
 * réglages. three.js n'est téléchargé que lorsque ce composant s'affiche avec WebGL disponible ; sans
 * WebGL, ou si l'appareil peine, il ne l'est pas ou n'est plus utilisé.
 */
const Scene = dynamic(() => import("./scene"), { ssr: false });

let webgl: boolean | undefined;
function hasWebGL() {
  if (webgl === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webgl = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

const REDUCED = "(prefers-reduced-motion: reduce)";
const never = () => () => {};
const subscribeMotion = (notify: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

/** Une erreur de la scène 3D (pilote graphique, mémoire) ne doit pas emporter la page : on passe à plat. */
class SceneGuard extends Component<{ onError: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** `label` absent : le canevas n'est qu'une image d'attente sous la 3D, cachée aux lecteurs d'écran. */
function FlatCanvas({ template, design, label, onReady }: { template: Template; design: Design; label?: string; onReady?: () => void }) {
  const { image, ready } = useDesignAssets(design);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    paintFlat(canvas.current, template, design, image, 900);
    onReady?.();
  }, [template, design, image, ready, onReady]);
  if (label === undefined) return <canvas ref={canvas} aria-hidden className="absolute inset-0 size-full object-contain" />;
  return <canvas ref={canvas} role="img" aria-label={label} data-view="flat" className="size-full object-contain" />;
}

export default function LiveObject({
  template,
  design,
  label,
  className,
  caption = true,
  waiting = true,
  onReady,
}: {
  template: Template;
  design: Design;
  /** Description de l'objet pour les lecteurs d'écran. */
  label: string;
  /** Taille et fond du cadre. */
  className?: string;
  /** Ligne d'aide et bascule 3D / à plat sous le cadre. */
  caption?: boolean;
  /** Montrer l'objet à plat pendant le téléchargement de la 3D (243 ko : plusieurs secondes en 3G). L'accueil a déjà sa photo. */
  waiting?: boolean;
  /** Appelé quand l'objet est à l'écran (la page d'accueil retire alors son image fixe). */
  onReady?: () => void;
}) {
  const t = useTranslations("customizer");
  const supported = useSyncExternalStore(never, hasWebGL, () => null);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(REDUCED).matches,
    () => true
  );
  const { image, ready } = useDesignAssets(design);
  const [struggling, setStruggling] = useState(false);
  const [preferFlat, setPreferFlat] = useState(false);
  const [touched, setTouched] = useState(false);
  const turn = useRef<Turn | null>(null);
  const [painted, setPainted] = useState(false);
  const fallBack = useCallback(() => setStruggling(true), []);
  // Deux images d'attente après la création de la scène : l'image d'attente ne disparaît qu'une fois l'objet réellement peint.
  const scenePainted = useCallback(
    () =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setPainted(true);
          onReady?.();
        })
      ),
    [onReady]
  );
  const gesture = useCallback(() => setTouched(true), []);

  const canTurn = supported === true && !struggling;
  const flat = !canTurn || preferFlat;
  const rotate = (radians: number) => {
    setTouched(true);
    turn.current?.by(radians);
  };

  return (
    <>
      <div className={cn("relative overflow-hidden", className)}>
        {supported === null ? null : flat ? (
          <FlatCanvas template={template} design={design} label={label} onReady={onReady} />
        ) : (
          <>
            {waiting && !painted && <FlatCanvas template={template} design={design} />}
            <div role="img" aria-label={label} data-view="3d" className="relative size-full">
              <SceneGuard onError={fallBack}>
                <Scene template={template} design={design} image={image} ready={ready} sway={!touched && !reduced} turn={turn} onGesture={gesture} onStruggle={fallBack} onReady={scenePainted} />
              </SceneGuard>
            </div>
            <div className="absolute right-2 bottom-2 flex gap-1.5">
              {(
                [
                  [-Math.PI / 4, RotateCcw, "turnLeft"],
                  [Math.PI / 4, RotateCw, "turnRight"],
                ] as const
              ).map(([angle, Icon, key]) => (
                <button key={key} type="button" onClick={() => rotate(angle)} aria-label={t(key)} className="grid size-11 place-items-center rounded-full border border-input bg-background hover:bg-muted">
                  <Icon className="size-4.5" aria-hidden />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {caption && supported !== null && (
        <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{canTurn ? (flat ? t("flatChosen") : t("dragHint")) : t("flatOnly")}</span>
          {canTurn && (
            <button type="button" onClick={() => setPreferFlat(!preferFlat)} className="font-medium text-foreground underline underline-offset-4">
              {flat ? t("see3d") : t("seeFlat")}
            </button>
          )}
        </p>
      )}
    </>
  );
}
