import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { frozenDeployContext, frozenPreviewUrl, robotsHeaders } from "./src/lib/deploy-context";

// Contexte de déploiement Netlify (production, branch-deploy, deploy-preview), connu seulement à la compilation : figé
// ici pour le code serveur (magasin des images, robots.txt) et pour les en-têtes (src/lib/deploy-context.ts).
const deployContext = frozenDeployContext({ NETLIFY: process.env.NETLIFY, CONTEXT: process.env.CONTEXT });
// Hors production, adresse du déploiement (DEPLOY_PRIME_URL, https://preview--alarobia-shop.netlify.app pour la branche
// preview) : adresses canoniques et plan du site de l'aperçu, sans régler NEXT_PUBLIC_SITE_URL par contexte. Vide sinon.
const previewUrl = frozenPreviewUrl(deployContext, process.env.DEPLOY_PRIME_URL);

const nextConfig: NextConfig = {
  // Remplacées à la compilation partout où `process.env.DEPLOY_CONTEXT` et `process.env.PREVIEW_SITE_URL` sont écrits :
  // aucun composant client ne les lit, elles n'arrivent donc pas dans le JavaScript du navigateur.
  env: { DEPLOY_CONTEXT: deployContext, PREVIEW_SITE_URL: previewUrl },
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
          // Hors production (déploiement de branche, aperçu) : X-Robots-Tag: noindex. Rien en production ni en local.
          ...robotsHeaders(deployContext),
        ],
      },
    ];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
