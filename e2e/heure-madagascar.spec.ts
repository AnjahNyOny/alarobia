import { expect, test } from "@playwright/test";
import { createDb } from "../src/lib/db";
import { E2E_DATABASE_URL } from "./database";
import { ADMIN, login, watchErrors } from "./helpers";

/*
 * Point de vigilance 10 : le serveur de test tourne en UTC, comme la production (Netlify), et le navigateur à Antananarivo (playwright.config.ts).
 * Une commande passée à 23 h 30 à Antananarivo, soit 20 h 30 UTC, s'affiche à 23:30, et à minuit passé elle est du lendemain.
 * Aucun parcours ne commande à une heure choisie : on déplace la date d'une commande de démonstration, puis on la rend.
 */
const db = createDb(E2E_DATABASE_URL);
const NUMBER = "AL-1001"; // la plus ancienne commande du seed, qu'aucun autre test n'ouvre
let original: { id: string; userId: string | null; createdAt: Date; updatedAt: Date };

test.beforeAll(async () => {
  original = await db.order.findUniqueOrThrow({ where: { number: NUMBER }, select: { id: true, userId: true, createdAt: true, updatedAt: true } });
});

test.afterAll(async () => {
  if (original) await db.order.update({ where: { id: original.id }, data: { createdAt: original.createdAt, updatedAt: original.updatedAt } });
  await db.$disconnect();
});

test("le vendeur lit l'heure d'une commande à l'heure de Madagascar, sur un serveur en UTC", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");

  await db.order.update({ where: { id: original.id }, data: { createdAt: new Date("2026-11-17T20:30:00Z") } });
  await page.goto(`/admin/orders/${original.id}`);
  await expect(page.getByText("Passée le 17 nov. 2026, 23:30")).toBeVisible();

  // Une heure plus tard, il est minuit passé à Antananarivo (21 h 30 UTC) : la commande est du 18.
  await db.order.update({ where: { id: original.id }, data: { createdAt: new Date("2026-11-17T21:30:00Z") } });
  await page.reload();
  await expect(page.getByText("Passée le 18 nov. 2026, 00:30")).toBeVisible();
  // La date seule suit la même règle : la fiche du client range la commande au 18.
  await page.goto(`/admin/customers/${original.userId}`);
  await expect(page.getByRole("row", { name: new RegExp(NUMBER) })).toContainText("18 nov. 2026");
  check();
});
