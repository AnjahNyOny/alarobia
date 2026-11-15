import { expect, test, type Page } from "@playwright/test";
import { ADMIN, login, watchErrors } from "./helpers";

// Point de vigilance 6 : « 1 250 000 Ar » et au-delà doivent tenir à 320 px, la largeur minimale supportée.
test.use({ viewport: { width: 320, height: 640 } });

/**
 * Relève les montants en ariary mal affichés : coupés par le bord de l'écran ou par un parent
 * qui masque son débordement, ou cassés sur deux lignes. Un tableau qui défile horizontalement
 * (back-office) n'est pas un défaut : le montant y reste lisible en entier.
 */
async function amountProblems(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    let seen = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      if (!/\d\sAr\b|\bAr\s\d/.test(text)) continue;
      const parent = node.parentElement!;
      if (!parent.checkVisibility() || parent.closest(".sr-only, [aria-hidden=true], [inert]")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      if (rects.length === 0) continue;
      seen++;
      const label = text.trim().slice(0, 40);
      if (new Set(rects.map((r) => Math.round(r.top))).size > 1 && /^[\d\s]*Ar[\d\s,]*$/.test(text.trim())) problems.push(`sur deux lignes : ${label}`);
      const left = Math.min(...rects.map((r) => r.left));
      const right = Math.max(...rects.map((r) => r.right));
      let limitLeft = 0;
      let limitRight = window.innerWidth;
      let scrollable = false;
      for (let el: HTMLElement | null = parent; el && el !== document.body; el = el.parentElement) {
        const overflowX = getComputedStyle(el).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") scrollable = true;
        else if (overflowX === "hidden" || overflowX === "clip") {
          const box = el.getBoundingClientRect();
          limitLeft = Math.max(limitLeft, box.left);
          limitRight = Math.min(limitRight, box.right);
        }
      }
      if (!scrollable && (left < limitLeft - 0.5 || right > limitRight + 0.5)) problems.push(`coupé : ${label}`);
    }
    if (seen === 0) problems.push("aucun montant en ariary trouvé sur la page");
    return problems;
  });
}

async function expectAmountsFit(page: Page, where: string) {
  // Un panneau en cours d'ouverture est mesuré décalé : on attend la fin des transitions.
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => null))));
  // clientWidth et non innerWidth : en émulation mobile, innerWidth s'élargit avec un contenu qui déborde et masque le défaut.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  // 1 px toléré : à une densité d'écran fractionnaire (2,625 sur le Pixel 7), scrollWidth s'arrondit au pixel supérieur.
  expect(overflow, `défilement horizontal sur ${where}`).toBeLessThanOrEqual(1);
  expect(await amountProblems(page), `montants sur ${where}`).toEqual([]);
}

test("gros montants en ariary à 320 px : catalogue, fiche, panier et commande dans les trois langues", async ({ page }) => {
  const check = watchErrors(page);
  // Deux canapés à 2 850 000 Ar : sous-total de 5 700 000 Ar, prix barré de 3 200 000 Ar sur la carte.
  await page.goto("/fr/products/canape-dune-en-lin");
  await page.getByRole("button", { name: "Augmenter la quantité" }).click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible();
  await expectAmountsFit(page, "le panneau du panier");

  for (const locale of ["fr", "en", "mg"]) {
    for (const url of ["/products?sort=price-desc", "/products/canape-dune-en-lin", "/cart", "/checkout"]) {
      await page.goto(`/${locale}${url}`);
      await expectAmountsFit(page, `/${locale}${url}`);
    }
  }
  await page.goto("/fr/cart");
  await expect(page.getByText("5 700 000 Ar").first()).toBeVisible();

  // Jusqu'au bout : sur la confirmation, le montant à envoyer par Mobile Money est écrit en grand.
  await page.goto("/fr/checkout");
  await page.getByLabel("Adresse e-mail").fill("gros.montant@example.com");
  await page.getByLabel("Nom complet").fill("Lova Rabe");
  await page.getByLabel("Téléphone", { exact: true }).fill("034 55 666 77");
  await page.getByLabel("Adresse ou lot").fill("Lot 3");
  await page.getByLabel("Quartier").fill("Analakely");
  await page.getByLabel("Ville", { exact: true }).fill("Antananarivo");
  await page.getByLabel("Province", { exact: true }).selectOption("Antananarivo");
  await page.getByRole("button", { name: "Valider la commande" }).click();
  await page.waitForURL(/\/order\/c/);
  const confirmation = new URL(page.url()).pathname.replace(/^\/fr/, "");
  for (const locale of ["fr", "en", "mg"]) {
    await page.goto(`/${locale}${confirmation}`);
    await expect(page.getByRole("region").getByText(/5[\s,]700[\s,]000/)).toBeVisible();
    await expectAmountsFit(page, `/${locale}/order/…`);
  }
  check();
});

test("gros montants en ariary à 320 px : tableaux du back-office", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  for (const url of ["/admin", "/admin/products?q=Canapé", "/admin/orders", "/admin/customers", "/admin/promotions", "/admin/shipping"]) {
    await page.goto(url);
    await expectAmountsFit(page, url);
  }
  check();
});
