// Banc d'essai des erreurs d'hydratation : quatre onglets rechargent une page en rafale, cache chaud.
// Usage : node scripts/stress-hydratation.mjs http://localhost:3100 /aide 600
// Attendu : 0 erreur. Sous Next 15.5, ce banc en donnait 15 à 25 % sur une page longue.
import { chromium, devices } from "@playwright/test";

const [base = "http://localhost:3100", path = "/", total = "600"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const kinds = {};
let errors = 0;
let loads = 0;

await Promise.all(
  [0, 1, 2, 3].map(async () => {
    const context = await browser.newContext({ ...devices["Pixel 7"], locale: "fr-FR" });
    const page = await context.newPage();
    page.on("pageerror", (e) => {
      errors++;
      const key = String(e).slice(0, 70);
      kinds[key] = (kinds[key] || 0) + 1;
    });
    for (let i = 0; i < Number(total) / 4; i++) {
      await page.goto(base + path);
      loads++;
    }
    await page.waitForTimeout(300);
  })
);

console.log(`${errors} erreur(s) sur ${loads} chargements de ${path}`, errors ? kinds : "");
await browser.close();
process.exit(errors ? 1 : 0);
