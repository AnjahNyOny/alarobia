import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Base PostgreSQL des tests, schéma `public` (les tests unitaires prennent chacun un schéma temporaire dans la même base).
const DATABASE = "postgresql://mac@localhost:5432/alarobia_test";
const env = { DATABASE_URL: DATABASE, DATABASE_URL_UNPOOLED: DATABASE, NEXT_DIST_DIR: ".next-e2e", UPLOAD_DIR: "uploads-test", NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}` };

export default defineConfig({
  testDir: "e2e",
  // Les parcours partagent une base : ils s'exécutent l'un après l'autre.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, locale: "fr-FR", channel: "chrome", trace: "retain-on-failure" },
  projects: [
    { name: "ordinateur", use: { viewport: { width: 1440, height: 900 } }, testIgnore: /mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /mobile/ },
  ],
  webServer: {
    // Base de test créée si besoin puis vidée et remplie par le seed, compilation de production, puis serveur : on teste ce qui sera réellement servi.
    command: `npx prisma db push --skip-generate && node prisma/seed.mjs && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env,
  },
});
