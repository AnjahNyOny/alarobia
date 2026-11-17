// Ce dont la fiche d'un produit personnalisable a besoin, réuni dans un seul module pour que `lazy.tsx` le charge
// en un seul morceau (trois imports séparés dupliquaient le code commun dans trois fichiers).
export { CustomizerShell } from "./customizer-context";
export { BuyBox } from "./controls";
export { Stage } from "./stage";
