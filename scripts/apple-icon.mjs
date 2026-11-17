// Régénère src/app/apple-icon.png (180 × 180) à partir de src/app/icon.svg : `node scripts/apple-icon.mjs`.
// iOS arrondit lui-même les coins et remplit la transparence en noir : l'icône est donc pleine, fond blanc
// jusqu'aux bords, avec une marge autour de l'étiquette. Le PNG (et non une route apple-icon.tsx servie à
// « /apple-icon ») passe à côté du proxy de langue, qui ne traite pas les adresses contenant un point.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const SIZE = 180;

const svg = (await readFile(`${root}src/app/icon.svg`, "utf8"))
  // Carré plein (pas de coins arrondis) et 9 unités de marge de chaque côté.
  .replace('viewBox="0 0 52 52"', 'viewBox="-9 -9 70 70"')
  .replace('<rect width="52" height="52" rx="10" fill="#fff"/>', '<rect x="-9" y="-9" width="70" height="70" fill="#fff"/>');
if (!svg.includes('viewBox="-9 -9 70 70"') || svg.includes('rx="10"')) throw new Error("icon.svg a changé : adapter ce script.");

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${SIZE}px;height:${SIZE}px}</style>${svg}`);
await page.screenshot({ path: `${root}src/app/apple-icon.png`, omitBackground: false });
await browser.close();
console.log("src/app/apple-icon.png écrit");
