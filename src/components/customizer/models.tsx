"use client";

import { useMemo } from "react";
import { DoubleSide, LatheGeometry, Vector2, type Texture } from "three";
import type { Template } from "@/lib/customization";
import { PRINT_ZONES } from "@/lib/customizer/layout";

/**
 * Les quatre gabarits, construits par le code : aucun fichier 3D à télécharger. Une unité vaut 100 mm.
 * Chaque objet porte une « étiquette » transparente posée à fleur de sa surface, aux dimensions exactes
 * de la zone imprimable : c'est elle qui reçoit le dessin du client (`texture.ts`), le reste de l'objet
 * ne porte que sa couleur.
 */
type ModelProps = { color: string; print: Texture };

const MM = 0.01;
const lathe = (points: [number, number][]) =>
  new LatheGeometry(
    points.map(([x, y]) => new Vector2(x, y)),
    64,
  );

/** Étiquette courbe, centrée face à la caméra, pour un objet rond de rayon `radius`. */
function CurvedPrint({ template, radius, y, print }: { template: Template; radius: number; y: number; print: Texture }) {
  const { width, height } = PRINT_ZONES[template];
  const arc = (width * MM) / radius;
  return (
    <mesh position={[0, y, 0]} renderOrder={1}>
      <cylinderGeometry args={[radius + 0.004, radius + 0.004, height * MM, 48, 1, true, -arc / 2, arc]} />
      <meshStandardMaterial map={print} transparent depthWrite={false} roughness={0.5} />
    </mesh>
  );
}

function FlatPrint({ template, y, z, print }: { template: Template; y: number; z: number; print: Texture }) {
  const { width, height } = PRINT_ZONES[template];
  return (
    <mesh position={[0, y, z]} renderOrder={1}>
      <planeGeometry args={[width * MM, height * MM]} />
      <meshStandardMaterial map={print} transparent depthWrite={false} roughness={0.8} />
    </mesh>
  );
}

/** Tasse de 33 cl : 82 mm de diamètre, 95 mm de haut, creuse. */
function Mug({ color, print }: ModelProps) {
  const body = useMemo(
    () =>
      lathe([
        [0, -0.475],
        [0.37, -0.475],
        [0.41, -0.435],
        [0.41, 0.465],
        [0.395, 0.475],
        [0.375, 0.465],
        [0.375, -0.41],
        [0, -0.41],
      ]),
    [],
  );
  return (
    <group scale={1.45}>
      <mesh geometry={body}>
        <meshStandardMaterial color={color} roughness={0.32} side={DoubleSide} />
      </mesh>
      <mesh position={[0.4, 0, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1.2, 1, 1]}>
        <torusGeometry args={[0.24, 0.05, 14, 40, Math.PI]} />
        <meshStandardMaterial color={color} roughness={0.32} />
      </mesh>
      <CurvedPrint template="mug" radius={0.41} y={0} print={print} />
    </group>
  );
}

/** Gourde de 75 cl : 70 mm de diamètre, 240 mm de haut avec son bouchon. */
function Gourde({ color, print }: ModelProps) {
  const body = useMemo(
    () =>
      lathe([
        [0, -1.2],
        [0.31, -1.2],
        [0.35, -1.16],
        [0.35, 0.7],
        [0.33, 0.84],
        [0.22, 0.97],
        [0.17, 1.02],
        [0.17, 1.06],
        [0, 1.06],
      ]),
    [],
  );
  return (
    <group scale={0.7}>
      <mesh geometry={body}>
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.15} />
      </mesh>
      <mesh position={[0, 1.13, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.16, 40]} />
        <meshStandardMaterial color="#b9bcc4" roughness={0.35} metalness={0.6} />
      </mesh>
      <CurvedPrint template="gourde" radius={0.35} y={-0.25} print={print} />
    </group>
  );
}

/** Carnet A5 : 148 × 210 mm, couverture rigide et élastique. */
function Carnet({ color, print }: ModelProps) {
  return (
    <group scale={0.78}>
      <mesh>
        <boxGeometry args={[1.48, 2.1, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      {/* La tranche des pages dépasse à peine de la couverture, à droite, en haut et en bas. */}
      <mesh position={[0.012, 0, 0]}>
        <boxGeometry args={[1.47, 2.115, 0.12]} />
        <meshStandardMaterial color="#f1ece0" roughness={0.9} />
      </mesh>
      <mesh position={[0.56, 0, 0]}>
        <boxGeometry args={[0.035, 2.12, 0.175]} />
        <meshStandardMaterial color="#26262b" roughness={0.8} />
      </mesh>
      <FlatPrint template="carnet" y={0} z={0.083} print={print} />
    </group>
  );
}

/** Sac en toile : 380 × 420 mm, deux anses. */
function Tote({ color, print }: ModelProps) {
  return (
    <group scale={0.3} position={[0, -0.22, 0]}>
      <mesh>
        <boxGeometry args={[3.8, 4.2, 0.14]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {[0.05, -0.05].map((z) => (
        <mesh key={z} position={[0, 2.08, z]} scale={[1, 1.7, 1]}>
          <torusGeometry args={[0.75, 0.055, 10, 40, Math.PI]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      ))}
      <FlatPrint template="tote" y={-0.3} z={0.074} print={print} />
    </group>
  );
}

/** Hauteur du dessous de chaque objet, après mise à l'échelle : l'ombre de contact s'y pose. */
export const FLOOR: Record<Template, number> = { mug: -0.475 * 1.45, gourde: -1.2 * 0.7, carnet: -1.05 * 0.78, tote: -0.22 - 2.1 * 0.3 };

export const MODELS: Record<Template, (props: ModelProps) => React.ReactNode> = { mug: Mug, gourde: Gourde, carnet: Carnet, tote: Tote };
