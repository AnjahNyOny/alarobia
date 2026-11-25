import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL, E2E_MAIL_OUTBOX } from "./e2e/database";

const PORT = 3100;
// Base PostgreSQL des tests, schéma `public` (les tests unitaires prennent chacun un schéma temporaire dans la même base).
const DATABASE = E2E_DATABASE_URL;
// Serveur en UTC, comme la production (fonctions Netlify) : ni la machine (EST) ni Madagascar. Le navigateur, lui, est à Antananarivo, comme les clients.
// E-mails : écrits dans E2E_MAIL_OUTBOX, jamais envoyés. SMTP_USER et SMTP_PASSWORD sont forcés à vide : une variable
// déjà définie, même vide, l'emporte sur les fichiers .env que Next charge, et rien ne part même si le terminal les a.
const env = {
  DATABASE_URL: DATABASE,
  DATABASE_URL_UNPOOLED: DATABASE,
  NEXT_DIST_DIR: ".next-e2e",
  UPLOAD_DIR: "uploads-test",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  TZ: "UTC",
  MAIL_OUTBOX: E2E_MAIL_OUTBOX,
  SMTP_USER: "",
  SMTP_PASSWORD: "",
};
// Vide l'outbox avant le démarrage du serveur : chaque suite part sans message.
const clearOutbox = `node -e "require('node:fs').rmSync('${E2E_MAIL_OUTBOX}', { recursive: true, force: true })"`;

// Contrôle du site en ligne : il a sa propre configuration (playwright.production.config.ts, `npm run test:prod`) et ne
// tourne jamais ici. Le `testIgnore` d'un projet remplace celui de la configuration : chaque projet l'écarte lui-même.
const PRODUCTION_SPEC = /production\.spec\.ts$/;

export default defineConfig({
  testDir: "e2e",
  // Les parcours partagent une base : ils s'exécutent l'un après l'autre.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, locale: "fr-FR", timezoneId: "Indian/Antananarivo", channel: "chrome", trace: "retain-on-failure" },
  projects: [
    { name: "ordinateur", use: { viewport: { width: 1440, height: 900 } }, testIgnore: [/mobile/, PRODUCTION_SPEC] },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /mobile/, testIgnore: PRODUCTION_SPEC },
  ],
  webServer: {
    // Outbox vidée, base de test créée si besoin puis vidée et remplie par le seed, compilation de production, puis serveur : on teste ce qui sera réellement servi.
    command: `${clearOutbox} && npx prisma db push --skip-generate && node prisma/seed.mjs && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env,
  },
});
