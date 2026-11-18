import type { ColorKey } from "../customization";

/**
 * Démonstration de la page d'accueil. La couleur est celle de la photo fixe (`public/home/tasse-anjah.jpg`),
 * le prénom aussi : si l'un change, refaire la photo. Module sans « use client » : la page (serveur) et le
 * composant (navigateur) lisent les mêmes valeurs.
 */
export const DEMO_COLOR: ColorKey = "laterite";
export const DEMO_NAME = "Anjah";
export const DEMO_STILL = "/home/tasse-anjah.jpg";
