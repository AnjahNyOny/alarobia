// Poids réellement transféré par page, mesuré dans Chrome contre un serveur de production.
//
//   node scripts/poids-pages.mjs http://localhost:3100 /fr /fr/products
//
// Affiche pour chaque page les octets transférés (compressés) par type de ressource, et
// le détail en JSON avec --json. Sert à vérifier que l'accueil et le catalogue ne
// grossissent pas quand on ajoute une fonction lourde ailleurs (la 3D, phase 4.6).
import { chromium } from "@playwright/test";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const json = process.argv.includes("--json");
const [base, ...paths] = args;
if (!base || paths.length === 0) {
  console.error("Usage : node scripts/poids-pages.mjs <adresse du serveur> <chemin> [chemin…] [--json]");
  process.exit(1);
}

const KINDS = { Script: "js", Stylesheet: "css", Image: "images", Font: "polices", Document: "html" };

async function measure(browser, url) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const types = new Map();
  const urls = new Map();
  const totals = { js: 0, css: 0, images: 0, polices: 0, html: 0, autres: 0 };
  const scripts = [];
  cdp.on("Network.responseReceived", (e) => {
    types.set(e.requestId, e.type);
    urls.set(e.requestId, e.response.url);
  });
  cdp.on("Network.loadingFinished", (e) => {
    const kind = KINDS[types.get(e.requestId)] ?? "autres";
    totals[kind] += e.encodedDataLength;
    if (kind === "js") scripts.push({ url: urls.get(e.requestId), octets: e.encodedDataLength });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await context.close();
  return { totals, total: Object.values(totals).reduce((a, b) => a + b, 0), scripts };
}

const ko = (n) => `${(n / 1024).toFixed(1)} ko`;
const browser = await chromium.launch({ channel: "chrome" });
const report = {};
for (const path of paths) {
  const result = await measure(browser, base + path);
  report[path] = result;
  if (!json)
    console.log(
      `${path.padEnd(28)} total ${ko(result.total).padStart(10)}   js ${ko(result.totals.js).padStart(10)} (${result.scripts.length} fichiers)   css ${ko(result.totals.css).padStart(8)}   images ${ko(result.totals.images).padStart(10)}   polices ${ko(result.totals.polices).padStart(9)}`
    );
}
await browser.close();
if (json) console.log(JSON.stringify(report, null, 2));
