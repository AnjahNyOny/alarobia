import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Les tests navigateur compilent dans leur propre dossier pour ne pas gêner le serveur de dev.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // Feuille CSS écrite dans le HTML au lieu d'un fichier à part : en 3G lente, la feuille bloquait l'affichage un
    // aller-retour de plus. Mesuré le 17/11/2026 (PROGRESS.md) : premier affichage 5,5 → 2,4 s à la première visite.
    // Coût : environ 29 ko de HTML en plus par page (gzip), y compris pour un visiteur qui revient (plus de cache CSS).
    // Option expérimentale : la revérifier à chaque mise à jour de Next. Une politique CSP (phase 7) devra autoriser
    // le <style> en ligne.
    inlineCss: true,
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
