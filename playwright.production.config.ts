import { defineConfig } from "@playwright/test";

/**
 * Contrôle du site en ligne (PLAN.md 7.5, étape 7) : `e2e/production.spec.ts` seul, contre l'adresse `PROD_URL`, sans
 * serveur lancé ici. La configuration normale (playwright.config.ts) l'ignore.
 *
 *   PROD_URL=https://<nom>.netlify.app PROD_ADMIN_EMAIL=… PROD_ADMIN_PASSWORD=… PROD_CRON_SECRET=… npm run test:prod
 *
 * Sans `PROD_URL`, rien ne se lance. Les autres variables sont facultatives : le test qui en a besoin est sauté.
 */
const raw = process.env.PROD_URL?.trim();
if (!raw) {
  throw new Error("PROD_URL manquante : adresse du site à contrôler, par exemple PROD_URL=https://alarobia.netlify.app npm run test:prod. Ce contrôle ne lance aucun serveur.");
}
const url = URL.parse(raw);
if (!url || !["https:", "http:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
  throw new Error(`PROD_URL invalide (« ${raw} ») : attendu l'adresse du site seule, comme https://alarobia.netlify.app, sans chemin.`);
}
const PROD_URL = url.origin;
// Valeur normalisée (sans barre finale) relue par la spec : elle compare les adresses canoniques à cette origine.
process.env.PROD_URL = PROD_URL;

export default defineConfig({
  testDir: "e2e",
  testMatch: /production\.spec\.ts$/,
  // Un seul navigateur à la fois, aucune nouvelle tentative : la connexion au back-office ne doit être essayée qu'une
  // fois (limites de débit du site en ligne), et un échec se lit tel quel.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: PROD_URL,
    locale: "fr-FR",
    timezoneId: "Indian/Antananarivo",
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    // Pas de trace, ni de capture : une trace garde les requêtes en clair, donc le mot de passe du back-office et
    // `Authorization: Bearer <CRON_SECRET>`, dans test-results/.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "production" }],
});
