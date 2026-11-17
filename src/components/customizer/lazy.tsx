"use client";

import dynamic from "next/dynamic";

/**
 * La personnalisation, chargée seulement sur la fiche d'un produit personnalisable. Importés directement, ces
 * composants partaient avec le code de toutes les fiches (réglages, dessin et feuille des trois écritures),
 * personnalisables ou non. Rendus côté serveur comme avant : la page arrive complète, et le navigateur télécharge
 * leur code en même temps que le reste de la page.
 */
// `import()` écrit dans chaque appel : Next le lit pour annoncer le fichier dans le HTML (préchargement), sans quoi le
// navigateur ne le découvre qu'à l'hydratation, un aller-retour plus tard (2 s en 3G lente). Le même module : un seul fichier.
export const CustomizerShell = dynamic(() => import("./fiche").then((m) => m.CustomizerShell));
export const Stage = dynamic(() => import("./fiche").then((m) => m.Stage));
export const BuyBox = dynamic(() => import("./fiche").then((m) => m.BuyBox));
