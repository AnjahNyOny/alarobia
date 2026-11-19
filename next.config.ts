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
  // En-têtes de sécurité sur toutes les adresses : pages, routes API, fichiers envoyés, page introuvable
  // (e2e/securite.spec.ts). Pas de CSP pour l'instant : elle demande des nonces, incompatibles avec la mise en cache
  // statique des pages (PLAN.md, « Ce que la phase 7A ne fait pas »).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Le site ne s'affiche dans le cadre d'aucun autre (détournement de clic).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
