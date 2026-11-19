import { expect, test, type Page } from "@playwright/test";
import { createDb } from "../src/lib/db";
import { E2E_DATABASE_URL } from "./database";
import { ADMIN, login, watchErrors } from "./helpers";

/*
 * Tâche 7.4b : la boutique telle que `prisma/init-production.mjs` la laisse au départ (presque tous les produits en brouillon,
 * aucun numéro Mobile Money, aucune commande). Chaque test met la base dans l'état voulu, puis la rend exactement comme il l'a
 * trouvée, même en cas d'échec : la suite partage la base et ne fait tourner qu'un test à la fois (`workers: 1`).
 */

const db = createDb(E2E_DATABASE_URL);
test.afterAll(() => db.$disconnect());

type Numbers = { mvolaNumber: string; orangeMoneyNumber: string; airtelMoneyNumber: string };

/** Numéros Mobile Money du vendeur remplacés le temps de `run`, puis ceux qui étaient en base (`paiement.spec.ts` en change un). */
async function withNumbers(numbers: Numbers, run: () => Promise<void>) {
  const before = await db.storeSettings.findUniqueOrThrow({ where: { id: 1 }, select: { mvolaNumber: true, orangeMoneyNumber: true, airtelMoneyNumber: true } });
  await db.storeSettings.update({ where: { id: 1 }, data: numbers });
  try {
    await run();
  } finally {
    await db.storeSettings.update({ where: { id: 1 }, data: before });
  }
}

/** « Commander en trois temps », sur l'accueil, dans toutes les langues. */
const steps = (page: Page) => page.locator('section[aria-labelledby="etapes-titre"]');
/** Réponse de la question fréquente sur les moyens de paiement. */
const paymentAnswer = (page: Page) => page.locator("dt", { hasText: "Quels moyens de paiement acceptez-vous ?" }).locator("xpath=following-sibling::dd[1]");

test("seuls les opérateurs dont le numéro est saisi sont annoncés", async ({ page }) => {
  const check = watchErrors(page);
  await withNumbers({ mvolaNumber: "034 00 123 45", orangeMoneyNumber: "", airtelMoneyNumber: "033 00 123 45" }, async () => {
    await page.goto("/fr");
    await expect(steps(page)).toContainText("Par MVola ou Airtel Money, ou à la livraison.");
    await expect(steps(page)).not.toContainText("Orange Money");

    await page.goto("/fr/help");
    await expect(paymentAnswer(page)).toHaveText(/^MVola ou Airtel Money : après la commande, vous envoyez le montant au numéro indiqué/);
    await expect(paymentAnswer(page)).toContainText("Vous pouvez aussi payer en espèces à la livraison.");
    await expect(paymentAnswer(page)).not.toContainText("Orange Money");

    await page.goto("/fr/about");
    await expect(page.getByText("Par MVola ou Airtel Money, ou en espèces quand le colis arrive.")).toBeVisible();

    await page.goto("/fr/products/tasse-en-gres-vato");
    await expect(page.getByText("Paiement par MVola ou Airtel Money, ou à la livraison.")).toBeVisible();

    // La liste se forme dans chaque langue.
    await page.goto("/en");
    await expect(steps(page)).toContainText("By MVola or Airtel Money, or on delivery.");
    await page.goto("/mg");
    await expect(steps(page)).toContainText("Amin'ny MVola na Airtel Money, na rehefa tonga ny entana.");
  });
  check();
});

test("sans numéro Mobile Money, seul le paiement à la livraison est annoncé", async ({ page }) => {
  const check = watchErrors(page);
  await withNumbers({ mvolaNumber: "", orangeMoneyNumber: "", airtelMoneyNumber: "" }, async () => {
    const operators = /Mobile Money|MVola|Orange Money|Airtel Money/;
    await page.goto("/fr");
    await expect(steps(page)).toContainText("En espèces, à la livraison.");
    await expect(steps(page)).not.toContainText(operators);

    await page.goto("/fr/help");
    await expect(paymentAnswer(page)).toHaveText("En espèces, à la livraison : vous payez le livreur quand il vous remet le colis.");

    await page.goto("/fr/about");
    await expect(page.getByText("En espèces, quand le colis arrive.")).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(operators);

    await page.goto("/fr/products/tasse-en-gres-vato");
    await expect(page.getByText("Paiement à la livraison.", { exact: true })).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(operators);

    await page.goto("/en");
    await expect(steps(page)).toContainText("Cash on delivery.");
    await page.goto("/mg");
    await expect(steps(page)).toContainText("Vola eny an-tanana, rehefa tonga ny entana.");
  });
  check();
});

test("un rayon sans article le dit, et renvoie vers tous les produits ; avec un filtre, le message reste celui d'une recherche", async ({ page }) => {
  const check = watchErrors(page);
  const aisle = await db.category.create({ data: { name: "Rayon d'essai", slug: "rayon-d-essai-e2e", position: 99, translations: { create: [{ locale: "en", name: "Test aisle" }] } } });
  try {
    await page.goto(`/fr/products?category=${aisle.slug}`);
    const main = page.getByRole("main");
    await expect(main.getByText("Ce rayon est encore vide", { exact: true })).toBeVisible();
    await expect(main.getByText("Aucun article n'y est en vente pour le moment.", { exact: true })).toBeVisible();
    await expect(main.getByText("Aucun article ne correspond")).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Voir tous les produits" })).toHaveAttribute("href", "/fr/products");

    // Le tri ne filtre rien : le rayon reste « vide ».
    await page.goto(`/fr/products?category=${aisle.slug}&sort=newest`);
    await expect(main.getByText("Ce rayon est encore vide", { exact: true })).toBeVisible();

    await page.goto(`/en/products?category=${aisle.slug}`);
    await expect(main.getByText("This aisle is still empty", { exact: true })).toBeVisible();
    await expect(main.getByRole("link", { name: "View all products" })).toHaveAttribute("href", "/en/products");

    // Un filtre actif : c'est lui qui peut expliquer l'absence de résultat.
    await page.goto(`/fr/products?category=${aisle.slug}&stock=1`);
    await expect(main.getByText("Aucun article ne correspond", { exact: true })).toBeVisible();
    await expect(main.getByText("Essayez un autre mot ou retirez un filtre.", { exact: true })).toBeVisible();
    await expect(main.getByText("Ce rayon est encore vide")).toHaveCount(0);
  } finally {
    await db.category.delete({ where: { id: aisle.id } });
  }
  check();
});

test("une recherche sans résultat garde son message", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/fr/products?q=introuvable-e2e");
  const main = page.getByRole("main");
  await expect(main.getByText("Aucun article ne correspond", { exact: true })).toBeVisible();
  await expect(main.getByText("Essayez un autre mot ou retirez un filtre.", { exact: true })).toBeVisible();
  await expect(main.getByRole("link", { name: "Voir tous les produits" })).toHaveAttribute("href", "/fr/products");
  check();
});

test("sans article à prix réduit, la page Promotions le dit ; avec un autre filtre, le message reste celui d'une recherche", async ({ page }) => {
  const check = watchErrors(page);
  // SQL brut : `updatedAt` ne bouge pas. Chaque prix barré est remis tel quel à la fin.
  const onSale = await db.$queryRaw<{ id: string; compareAtCents: number }[]>`SELECT id, "compareAtCents" FROM "Product" WHERE "compareAtCents" IS NOT NULL`;
  expect(onSale.length).toBeGreaterThan(0);
  await db.$executeRaw`UPDATE "Product" SET "compareAtCents" = NULL WHERE "compareAtCents" IS NOT NULL`;
  try {
    await page.goto("/fr/products?sale=1");
    const main = page.getByRole("main");
    await expect(main.getByText("Aucune promotion en ce moment", { exact: true })).toBeVisible();
    await expect(main.getByText("Les articles à prix réduit apparaîtront ici.", { exact: true })).toBeVisible();
    await expect(main.getByText("Aucun article ne correspond")).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Voir tous les produits" })).toHaveAttribute("href", "/fr/products");

    await page.goto("/en/products?sale=1");
    await expect(main.getByText("No deals right now", { exact: true })).toBeVisible();

    // Promotions et un autre filtre : c'est ce filtre qui peut expliquer l'absence de résultat.
    await page.goto("/fr/products?sale=1&stock=1");
    await expect(main.getByText("Aucun article ne correspond", { exact: true })).toBeVisible();
    await expect(main.getByText("Aucune promotion en ce moment")).toHaveCount(0);
  } finally {
    for (const p of onSale) await db.$executeRaw`UPDATE "Product" SET "compareAtCents" = ${p.compareAtCents} WHERE id = ${p.id}`;
  }
  check();
});

test("un catalogue sans article en ligne le dit, sans lien vers lui-même", async ({ page }) => {
  const check = watchErrors(page);
  // SQL brut : `updatedAt` ne bouge pas, l'accueil (trié par mise à jour) retrouve exactement son ordre.
  const online = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE status = 'ACTIVE'`;
  await db.$executeRaw`UPDATE "Product" SET status = 'DRAFT' WHERE status = 'ACTIVE'`;
  try {
    await page.goto("/fr/products");
    const main = page.getByRole("main");
    await expect(main.getByText("Aucun article en vente pour le moment", { exact: true })).toBeVisible();
    await expect(main.getByText("Le catalogue est en préparation. Revenez bientôt.", { exact: true })).toBeVisible();
    await expect(main.getByText("Aucun article ne correspond")).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Voir tous les produits" })).toHaveCount(0);
  } finally {
    const ids = online.map((p) => p.id);
    await db.$executeRaw`UPDATE "Product" SET status = 'ACTIVE' WHERE id = ANY(${ids})`;
  }
  check();
});

/** Graduations de l'axe des montants du graphique, une fois le graphique dessiné. */
async function revenueTicks(page: Page) {
  const ticks = page.locator(".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value");
  await expect(ticks.first()).toBeVisible();
  return ticks.allTextContents();
}

test("tableau de bord : des commandes, puis aucune", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  const recent = page.locator("section").filter({ has: page.getByRole("heading", { name: "Dernières commandes" }) });

  // Avec les commandes du seed : des lignes, et un axe dont chaque graduation est différente.
  await expect(recent.locator("tbody tr")).not.toHaveCount(0);
  const ticks = await revenueTicks(page);
  expect(ticks.length).toBeGreaterThan(1);
  expect(new Set(ticks).size, `graduations : ${ticks.join(" | ")}`).toBe(ticks.length);

  // Sans commande : les commandes partent dans un schéma de sauvegarde, puis reviennent telles quelles (seule la table OrderItem en dépend).
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS e2e_depart_commandes CASCADE`);
  await db.$executeRawUnsafe(`CREATE SCHEMA e2e_depart_commandes`);
  await db.$executeRawUnsafe(`CREATE TABLE e2e_depart_commandes."Order" AS SELECT * FROM public."Order"`);
  await db.$executeRawUnsafe(`CREATE TABLE e2e_depart_commandes."OrderItem" AS SELECT * FROM public."OrderItem"`);
  const saved = await db.order.count();
  try {
    await db.$executeRawUnsafe(`DELETE FROM public."Order"`);
    await page.reload();
    await expect(recent.getByText("Aucune commande", { exact: true })).toBeVisible();
    await expect(recent.getByText("Les commandes apparaîtront ici dès le premier achat.", { exact: true })).toBeVisible();
    await expect(recent.getByRole("table")).toHaveCount(0);
    // Toutes les valeurs sont nulles : un seul « 0 », au pied du graphique.
    expect(await revenueTicks(page)).toEqual(["0"]);
  } finally {
    await db.$transaction([
      db.$executeRawUnsafe(`DELETE FROM public."Order"`),
      db.$executeRawUnsafe(`INSERT INTO public."Order" SELECT * FROM e2e_depart_commandes."Order"`),
      db.$executeRawUnsafe(`INSERT INTO public."OrderItem" SELECT * FROM e2e_depart_commandes."OrderItem"`),
    ]);
    await db.$executeRawUnsafe(`DROP SCHEMA e2e_depart_commandes CASCADE`);
  }
  expect(await db.order.count()).toBe(saved);
  check();
});
