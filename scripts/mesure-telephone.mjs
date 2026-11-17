// Mesure des pages sur un « téléphone modeste en 3G lente », dans Chrome, contre un serveur de production.
//
//   node scripts/mesure-telephone.mjs http://localhost:3100            # toutes les pages, fr et mg, 5 passages
//   node scripts/mesure-telephone.mjs http://localhost:3100 --pages=accueil,3d --langues=fr --passages=3
//   node scripts/mesure-telephone.mjs http://localhost:3100 --profil=3g --json > mesure.json
//   node scripts/mesure-telephone.mjs http://localhost:3100 --pages=accueil --retour    # second chargement, cache rempli
//
// Compagnon de `poids-pages.mjs` (octets seuls, sans ralentissement, quelques secondes) : celui-ci simule le réseau
// et le processeur, rejoue chaque page plusieurs fois et donne des temps (médiane, plus petit et plus grand passage).
// Il prend plusieurs minutes. Les octets sont contrôlés automatiquement par `e2e/performance.spec.ts` ; les temps,
// trop sensibles à la charge de la machine, restent ici.
//
// Une mesure locale n'a pas la latence d'un vrai serveur : le profil réseau l'ajoute à chaque requête. Le serveur, lui,
// répond en quelques millisecondes ; en production il faudra compter son temps de réponse en plus.
// Les temps ne valent rien si la machine est chargée : la charge (`uptime`) est affichée au début et à la fin.
import { execSync } from "node:child_process";
import { chromium } from "@playwright/test";

// Débits en octets par seconde, latence ajoutée à chaque requête (aller-retour), ralentissement du processeur.
// « 3g-lente » reprend le préréglage « Slow 3G » de Chrome DevTools ; « 3g » son préréglage « 3G » (ex-« Fast 3G »).
// Processeur ×4 : le réglage de Lighthouse pour un téléphone moyen ; ×6 avec --cpu=6 pour un appareil d'entrée de gamme.
const PROFILS = {
  "3g-lente": { latence: 2000, descendant: (400 * 1000) / 8, montant: (400 * 1000) / 8 },
  "3g": { latence: 562.5, descendant: (1.44 * 1000 * 1000) / 8, montant: (675 * 1000) / 8 },
};

const PAGES = {
  accueil: "",
  catalogue: "/products",
  fiche: "/products/casque-studio-one",
  "fiche-perso": "/products/tasse-en-gres-vato",
  "3d": "/products/tasse-en-gres-vato",
  panier: "/cart",
  commande: "/checkout",
};

const option = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const base = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!base) {
  console.error("Usage : node scripts/mesure-telephone.mjs <adresse du serveur> [--pages=accueil,catalogue,…] [--langues=fr,mg] [--passages=5] [--profil=3g-lente|3g] [--cpu=4] [--detail] [--retour] [--json]");
  process.exit(1);
}
const profilName = option("profil", "3g-lente");
const profil = PROFILS[profilName];
const cpu = Number(option("cpu", "4"));
const runs = Number(option("passages", "5"));
const langues = option("langues", "fr,mg").split(",");
const pages = option("pages", Object.keys(PAGES).join(",")).split(",");
const json = process.argv.includes("--json");
// --detail : pour le premier passage de chaque page, chaque ressource (type, octets, fin du téléchargement), chaque
// image (pixels reçus et pixels affichés) et l'origine des décalages.
const detail = process.argv.includes("--detail");
// --retour : visiteur qui revient. La page est d'abord chargée une fois dans un autre onglet (sans ralentissement), ce
// qui remplit le cache du navigateur ; seul le second chargement, cache gardé, est mesuré.
const retour = process.argv.includes("--retour");
if (!profil || pages.some((p) => !(p in PAGES))) {
  console.error(`Profils : ${Object.keys(PROFILS).join(", ")}. Pages : ${Object.keys(PAGES).join(", ")}.`);
  process.exit(1);
}

// Téléphone : écran de 390 px, densité 2 (720 px réels environ, celle des Android d'entrée de gamme), tactile.
const DEVICE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR" };
const KINDS = { Script: "js", Stylesheet: "css", Image: "images", Font: "polices", Document: "html" };

/**
 * Observateurs posés avant tout script de la page : peintures, plus grand élément peint (LCP), décalages (CLS),
 * longues tâches, et premier rendu de React. React prévient les outils de développement à chaque rendu validé,
 * y compris en production : un faux crochet `__REACT_DEVTOOLS_GLOBAL_HOOK__` note l'heure du premier, qui marque
 * la fin de l'hydratation de la page.
 */
function observe() {
  const m = (window.__mesure = { fcp: null, lcp: null, lcpEl: null, shifts: [], longTasks: [], commits: [] });
  const describe = (el) => {
    if (!el) return null;
    const tag = el.tagName.toLowerCase();
    if (tag === "img") return `img ${(el.currentSrc || el.src).replace(location.origin, "").replace(/&w=.*/, "").slice(0, 70)}`;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    return `${tag}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""} « ${text} »`;
  };
  new PerformanceObserver((l) => l.getEntries().forEach((e) => e.name === "first-contentful-paint" && (m.fcp = e.startTime))).observe({ type: "paint", buffered: true });
  new PerformanceObserver((l) => {
    const e = l.getEntries().at(-1);
    m.lcp = e.startTime;
    m.lcpEl = describe(e.element) ?? e.url ?? null;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => !e.hadRecentInput && m.shifts.push([e.startTime, e.value, e.sources?.map((s) => describe(s.node)).filter(Boolean).join(" + ")]))
  ).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => m.longTasks.push([e.startTime, e.duration]))).observe({ type: "longtask", buffered: true });
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject: () => 1,
    onCommitFiberRoot: () => m.commits.push(performance.now()),
    onCommitFiberUnmount: () => {},
    onPostCommitFiberRoot: () => {},
    checkDCE: () => {},
  };
}

/** CLS au sens de Chrome : la plus grosse fenêtre de décalages (moins d'une seconde entre deux, cinq secondes au plus). */
function cls(shifts) {
  let best = 0;
  let current = 0;
  let start = 0;
  let last = -Infinity;
  for (const [t, v] of shifts) {
    if (t - last > 1000 || t - start > 5000) {
      current = 0;
      start = t;
    }
    current += v;
    last = t;
    best = Math.max(best, current);
  }
  return best;
}

async function newPhone(browser, cookies) {
  const context = await browser.newContext(DEVICE);
  if (cookies) await context.addCookies(cookies);
  await context.addInitScript(observe);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: !retour });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: profil.latence, downloadThroughput: profil.descendant, uploadThroughput: profil.montant });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const bytes = { js: 0, css: 0, images: 0, polices: 0, html: 0, autres: 0 };
  const types = new Map();
  const resources = [];
  cdp.on("Network.responseReceived", (e) => types.set(e.requestId, [e.type, e.response.url]));
  cdp.on("Network.loadingFinished", (e) => {
    const [type, url] = types.get(e.requestId) ?? [];
    bytes[KINDS[type] ?? "autres"] += e.encodedDataLength;
    resources.push({ type, url, octets: e.encodedDataLength, fin: e.timestamp });
  });
  return { context, page, bytes, resources };
}

/** Un passage : page chargée à froid jusqu'au calme du réseau ; pour « 3d », ouverture de l'onglet jusqu'à l'objet peint. */
async function measure(browser, key, url, cookies, verbose) {
  const { context, page, bytes, resources } = await newPhone(browser, cookies);
  try {
    if (retour) {
      const first = await context.newPage();
      await first.goto(url, { waitUntil: "networkidle", timeout: 180_000 });
      await first.close();
    }
    await page.goto(url, { waitUntil: "networkidle", timeout: 180_000 });
    const m = await page.evaluate(() => window.__mesure);
    const fcp = m.fcp ?? NaN;
    const result = {
      fcp,
      lcp: m.lcp ?? NaN,
      lcpEl: m.lcpEl,
      cls: cls(m.shifts),
      // Temps total de blocage : part au-delà de 50 ms des longues tâches qui commencent après la première peinture.
      tbt: m.longTasks.filter(([s]) => s >= fcp).reduce((sum, [, d]) => sum + Math.max(0, d - 50), 0),
      hydratation: m.commits[0] ?? NaN,
      octets: { ...bytes, total: Object.values(bytes).reduce((a, b) => a + b, 0) },
    };
    if (verbose) {
      const t0 = Math.min(...resources.map((r) => r.fin));
      result.ressources = resources.map((r) => ({ ...r, url: r.url.replace(base, ""), fin: Math.round((r.fin - t0) * 1000) }));
      result.images = await page.evaluate(() =>
        [...document.images].filter((i) => i.currentSrc).map((i) => ({ src: i.currentSrc.replace(location.origin, ""), recu: i.naturalWidth, affiche: Math.round(i.getBoundingClientRect().width * devicePixelRatio), lazy: i.loading, priorite: i.fetchPriority }))
      );
      result.decalages = m.shifts.filter(([, v]) => v > 0.001).map(([t, v, src]) => `${Math.round(t)} ms ${v.toFixed(3)} ${src}`);
    }
    if (key === "3d") {
      const before = { ...bytes };
      const start = await page.evaluate(() => performance.now());
      await page.getByRole("tab").nth(1).click();
      // Peinte : le canevas 3D est là et l'image d'attente (canevas à plat caché) a été retirée.
      await page.waitForFunction(
        () => {
          const frame = document.querySelector('[data-view="3d"]');
          return frame?.querySelector("canvas") && !frame.parentElement.querySelector(":scope > canvas[aria-hidden]");
        },
        null,
        { timeout: 180_000, polling: 50 }
      );
      result.scene = (await page.evaluate(() => performance.now())) - start;
      result.octetsScene = Object.keys(before).reduce((s, k) => s + bytes[k] - before[k], 0);
    }
    return result;
  } finally {
    await context.close();
  }
}

/** Panier de démonstration (une fiche simple, une tasse) préparé sans ralentissement, puis copié dans chaque passage. */
async function cartCookies(browser) {
  const context = await browser.newContext(DEVICE);
  const page = await context.newPage();
  for (const path of [PAGES.fiche, PAGES["fiche-perso"]]) {
    await page.goto(`${base}/fr${path}`);
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await page.getByRole("heading", { name: "Votre panier" }).waitFor();
  }
  const cookies = await context.cookies();
  await context.close();
  return cookies.filter((c) => c.name === "cart");
}

const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};
const spread = (xs) => [Math.min(...xs), Math.max(...xs)];
const charge = () => execSync("uptime").toString().trim().replace(/.*load averages?: /, "");

const browser = await chromium.launch({ channel: "chrome" });
const report = { profil: { nom: profilName, ...profil, cpu, passages: runs, retour, appareil: DEVICE }, chargeDebut: charge(), pages: {} };
if (!json) console.error(`Profil ${profilName} : latence ${profil.latence} ms, ${(profil.descendant * 8) / 1000} kbit/s descendant, ${(profil.montant * 8) / 1000} kbit/s montant, processeur ×${cpu}, ${runs} passages${retour ? ", visiteur qui revient (cache rempli)" : ""}. Charge : ${report.chargeDebut}`);
const cookies = pages.some((p) => p === "panier" || p === "commande") ? await cartCookies(browser) : null;
for (const langue of langues) {
  for (const key of pages) {
    const url = `${base}/${langue}${PAGES[key]}`;
    const passes = [];
    for (let i = 0; i < runs; i++) passes.push(await measure(browser, key, url, key === "panier" || key === "commande" ? cookies : null, detail && i === 0));
    if (detail && !json) {
      const { ressources, images, decalages } = passes[0];
      console.log(`\n${langue} ${key} — ressources (octets, fin du téléchargement)`);
      for (const r of ressources.sort((a, b) => a.fin - b.fin)) console.log(`  ${String(r.fin).padStart(6)} ms ${(r.octets / 1024).toFixed(1).padStart(7)} ko  ${String(r.type).padEnd(10)} ${r.url.slice(0, 110)}`);
      console.log("  images (largeur reçue / largeur affichée en pixels réels)");
      for (const i of images) console.log(`    ${String(i.recu).padStart(5)} / ${String(i.affiche).padStart(5)}  ${i.lazy} ${i.priorite}  ${i.src.slice(0, 90)}`);
      console.log(`  décalages : ${decalages.join(" ; ") || "aucun"}`);
    }
    const metric = (f) => passes.map(f);
    const row = {
      url,
      fcp: metric((p) => p.fcp),
      lcp: metric((p) => p.lcp),
      lcpEl: [...new Set(passes.map((p) => p.lcpEl))],
      cls: metric((p) => p.cls),
      tbt: metric((p) => p.tbt),
      hydratation: metric((p) => p.hydratation),
      octets: Object.fromEntries(Object.keys(passes[0].octets).map((k) => [k, median(metric((p) => p.octets[k]))])),
      ...(key === "3d" && { scene: metric((p) => p.scene), octetsScene: median(metric((p) => p.octetsScene)) }),
    };
    report.pages[`${langue} ${key}`] = row;
    if (!json) {
      const s = (xs) => `${(median(xs) / 1000).toFixed(1)} s [${spread(xs).map((x) => (x / 1000).toFixed(1)).join("–")}]`;
      const ko = (n) => `${(n / 1024).toFixed(1)} ko`;
      console.log(
        `${`${langue} ${key}`.padEnd(15)} ${ko(row.octets.total).padStart(9)} (js ${ko(row.octets.js)}, polices ${ko(row.octets.polices)}, images ${ko(row.octets.images)})` +
          `  FCP ${s(row.fcp)}  LCP ${s(row.lcp)}  CLS ${median(row.cls).toFixed(3)}  TBT ${Math.round(median(row.tbt))} ms [${spread(row.tbt).map(Math.round).join("–")}]  hydratation ${s(row.hydratation)}` +
          (row.scene ? `  3D peinte en ${s(row.scene)} (+${ko(row.octetsScene)})` : "") +
          `\n${"".padEnd(16)}LCP : ${row.lcpEl.join(" | ")}`
      );
    }
  }
}
report.chargeFin = charge();
await browser.close();
if (json) console.log(JSON.stringify(report, null, 2));
else console.error(`Charge à la fin : ${report.chargeFin}`);
