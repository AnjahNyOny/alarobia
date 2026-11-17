import { expect, test, type Page } from "@playwright/test";

/**
 * Budgets de poids par page (tâche 6.2), mesurés sur un téléphone : 390 px de large, densité 2, cache vide.
 * Ce sont les octets réellement transférés (compressés), sans les préchargements de liens que Next lance une fois
 * la page chargée. Les octets ne dépendent pas de la charge de la machine ; les temps, eux, si : ils se mesurent
 * avec `node scripts/mesure-telephone.mjs` (3G lente, processeur ralenti), pas ici.
 *
 * Un dépassement veut dire qu'une page a grossi : regarder ce qui a changé (`node scripts/poids-pages.mjs`) avant de
 * relever un budget. Marge d'environ 10 % au-dessus de l'état mesuré à la fin de la tâche 6.2 (PROGRESS.md).
 */
const KO = 1024;
const BUDGETS: { name: string; path: string; cart?: boolean; total: number; js: number }[] = [
  { name: "accueil", path: "/fr", total: 0 * KO, js: 0 * KO },
  { name: "accueil en malgache", path: "/mg", total: 0 * KO, js: 0 * KO },
  { name: "catalogue", path: "/fr/products", total: 0 * KO, js: 0 * KO },
  { name: "fiche produit", path: "/fr/products/casque-studio-one", total: 0 * KO, js: 0 * KO },
  { name: "fiche personnalisable", path: "/fr/products/tasse-en-gres-vato", total: 0 * KO, js: 0 * KO },
  { name: "panier", path: "/fr/cart", cart: true, total: 0 * KO, js: 0 * KO },
  { name: "commande", path: "/fr/checkout", cart: true, total: 0 * KO, js: 0 * KO },
];
/** La police du site, réduite aux graisses et largeurs utilisées (`scripts/police-archivo.py`). */
const FONT_BUDGET = 0 * KO;

const KINDS: Record<string, string> = { Script: "js", Stylesheet: "css", Image: "images", Font: "polices", Document: "html" };

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

async function weigh(page: Page, path: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const types = new Map<string, string>();
  const bytes: Record<string, number> = { js: 0, css: 0, images: 0, polices: 0, html: 0, autres: 0 };
  cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
  cdp.on("Network.loadingFinished", (e) => {
    const type = types.get(e.requestId);
    // Préchargements des liens visibles (requêtes RSC) : lancés après le chargement, à un moment qui varie.
    if (type === "Fetch") return;
    bytes[KINDS[type ?? ""] ?? "autres"] += e.encodedDataLength;
  });
  await page.goto(path, { waitUntil: "networkidle" });
  await cdp.detach();
  return { ...bytes, total: Object.values(bytes).reduce((a, b) => a + b, 0) } as Record<"js" | "polices" | "total", number> & Record<string, number>;
}

// EN ATTENTE (tâche 6.2 interrompue) : budgets à remplir d'après la mesure finale, puis retirer `fixme`.
test.describe.fixme("budgets de poids sur téléphone", () => {
  for (const budget of BUDGETS) {
    test(`${budget.name} : ${budget.total / KO} ko au plus, dont ${budget.js / KO} ko de JavaScript`, async ({ page }) => {
      if (budget.cart) {
        for (const product of ["/fr/products/casque-studio-one", "/fr/products/tasse-en-gres-vato"]) {
          await page.goto(product);
          await page.getByRole("button", { name: "Ajouter au panier" }).click();
          await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible();
        }
      }
      const bytes = await weigh(page, budget.path);
      const detail = Object.entries(bytes).map(([k, v]) => `${k} ${(v / KO).toFixed(1)} ko`).join(", ");
      expect.soft(bytes.js, `JavaScript (${detail})`).toBeLessThanOrEqual(budget.js);
      expect.soft(bytes.total, `total (${detail})`).toBeLessThanOrEqual(budget.total);
      expect(bytes.polices, `police (${detail})`).toBeLessThanOrEqual(FONT_BUDGET);
    });
  }
});
