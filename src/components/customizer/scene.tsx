"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, SRGBColorSpace, type Group } from "three";
import { COLORS, type Design, type Template } from "@/lib/customization";
import { FLOOR, MODELS } from "./models";
import { paintZone, TEXTURE_LONG_SIDE } from "./texture";

/**
 * L'objet en 3D. Ce fichier et three.js ne sont téléchargés qu'à l'ouverture de l'onglet « Personnaliser »
 * (`stage.tsx` l'importe à la demande). L'objet se balance doucement jusqu'au premier geste du client,
 * puis ne bouge plus que sous son doigt : l'image n'est alors recalculée que lorsqu'elle change.
 */
export type Turn = { by: (radians: number) => void };

const START = -0.45; // légèrement de trois quarts : on voit le dessin et l'anse
const DRAG = 0.011; // radians par pixel

function Turntable({ sway, turnRef, onGesture, onStruggle, children }: { sway: boolean; turnRef: RefObject<Turn | null>; onGesture: () => void; onStruggle: () => void; children: React.ReactNode }) {
  const group = useRef<Group>(null);
  const motion = useRef({ angle: START, target: START, frames: 0, slow: 0 });
  const invalidate = useThree((s) => s.invalidate);
  const element = useThree((s) => s.gl.domElement);

  useEffect(() => {
    turnRef.current = {
      by(radians) {
        motion.current.target += radians;
        invalidate();
      },
    };
    let last: number | null = null;
    const down = (e: PointerEvent) => {
      last = e.clientX;
      element.setPointerCapture(e.pointerId);
      onGesture();
    };
    const move = (e: PointerEvent) => {
      if (last === null) return;
      motion.current.target += (e.clientX - last) * DRAG;
      last = e.clientX;
      invalidate();
    };
    const up = () => {
      last = null;
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    return () => {
      turnRef.current = null;
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
    };
  }, [element, invalidate, onGesture, turnRef]);

  useFrame((state, delta) => {
    const m = motion.current;
    if (sway) {
      m.target = START + 0.4 * Math.sin(state.clock.elapsedTime * 0.7);
      // Un appareil qui n'arrive pas à suivre : la moitié des trente premières images à moins de huit par seconde.
      if (m.frames < 30) {
        m.frames++;
        if (delta > 0.125) m.slow++;
        if (m.frames === 30 && m.slow >= 15) onStruggle();
      }
    }
    m.angle += (m.target - m.angle) * Math.min(1, delta * 10);
    if (group.current) group.current.rotation.y = m.angle;
    if (!sway && Math.abs(m.target - m.angle) > 0.001) invalidate();
  });

  return <group ref={group}>{children}</group>;
}

function Product({ template, design, image, ready }: { template: Template; design: Design; image: HTMLImageElement | null; ready: number }) {
  const invalidate = useThree((s) => s.invalidate);
  const print = useMemo(() => {
    const texture = new CanvasTexture(document.createElement("canvas"));
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }, []);
  useEffect(() => () => print.dispose(), [print]);
  useEffect(() => {
    paintZone(print.image as HTMLCanvasElement, template, design, image, TEXTURE_LONG_SIDE);
    // eslint-disable-next-line react-hooks/immutability -- une texture three.js se met à jour en place : c'est ainsi qu'on lui dit de relire son canevas
    print.needsUpdate = true;
    invalidate();
  }, [print, template, design, image, ready, invalidate]);

  const Model = MODELS[template];
  return <Model color={COLORS[design.color]} print={print} />;
}

/** Ombre de contact : un dégradé rond posé au sol, sans calcul d'ombre. */
function Ground({ y }: { y: number }) {
  const shadow = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, "rgba(31, 37, 71, 0.34)");
      gradient.addColorStop(1, "rgba(31, 37, 71, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => shadow.dispose(), [shadow]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y - 0.002, 0]}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial map={shadow} transparent depthWrite={false} />
    </mesh>
  );
}

export default function Scene({
  template,
  design,
  image,
  ready,
  sway,
  turn,
  onGesture,
  onStruggle,
  onReady,
}: {
  template: Template;
  design: Design;
  image: HTMLImageElement | null;
  ready: number;
  sway: boolean;
  turn: RefObject<Turn | null>;
  onGesture: () => void;
  onStruggle: () => void;
  onReady?: () => void;
}) {
  // En se fermant, la scène libère elle-même son contexte graphique, ce qui déclenche « webglcontextlost » une
  // demi-seconde plus tard. Seule une perte subie pendant que l'objet est affiché est une panne.
  const shown = useRef(true);
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
    };
  }, []);
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={sway ? "always" : "demand"}
      camera={{ position: [0, 0.7, 5], fov: 27 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      // Le doigt fait tourner l'objet de gauche à droite ; de haut en bas, il fait défiler la page.
      style={{ touchAction: "pan-y", cursor: "grab" }}
      onCreated={({ gl, camera }) => {
        camera.lookAt(0, 0, 0);
        gl.domElement.addEventListener("webglcontextlost", () => shown.current && onStruggle());
        onReady?.();
      }}
    >
      <hemisphereLight args={["#ffffff", "#cfc9bb", 1.5]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.4} />
      <directionalLight position={[-3, 1.5, 2]} intensity={0.8} />
      <Turntable sway={sway} turnRef={turn} onGesture={onGesture} onStruggle={onStruggle}>
        <Product template={template} design={design} image={image} ready={ready} />
      </Turntable>
      <Ground y={FLOOR[template]} />
    </Canvas>
  );
}
