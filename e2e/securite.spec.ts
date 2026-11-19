import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { ADMIN, CLIENT, expectSecurityHeaders, login, watchErrors } from "./helpers";

test("connexion : après huit échecs sur un compte, même le bon mot de passe est refusé ; les autres comptes passent", async ({ page }) => {
  // Une inscription et onze connexions, chacune avec un calcul bcrypt volontairement lent.
  test.slow();
  const check = watchErrors(page);
  // Compte propre au test : le verrou posé ici ne gêne aucune autre spec.
  const email = `verrou.${Date.now()}@example.com`;
  const password = "motdepasse1";
  await page.goto("/register");
  await page.getByLabel("Nom complet").fill("Rado Verrou");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/account");
  await page.context().clearCookies();

  // Le formulaire garde l'e-mail après un échec : on renvoie le même, sans recharger la page,
  // en attendant la réponse de chaque envoi (le message d'erreur, lui, reste affiché d'une fois sur l'autre).
  const submit = async (pass: string) => {
    await page.getByLabel("Mot de passe").fill(pass);
    const answered = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/login"));
    await page.getByRole("button", { name: "Se connecter" }).click();
    await answered;
  };
  await login(page, email, "mauvais1");
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  for (let i = 2; i <= 8; i++) {
    await submit(`mauvais${i}`);
    await expect(page.getByText("E-mail ou mot de passe incorrect."), `échec n° ${i}`).toBeVisible();
  }

  // Neuvième tentative, avec le bon mot de passe : la limite répond avant toute comparaison.
  await expect(page.getByLabel("Adresse e-mail")).toHaveValue(email);
  await submit(password);
  await expect(page.getByText(/Trop de tentatives en peu de temps\. Réessayez dans \d+ minutes?\./)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);

  // Le verrou vise ce compte : un autre client, depuis la même adresse, se connecte normalement.
  await login(page, CLIENT.email, CLIENT.password);
  await page.waitForURL("**/account");
  check();
});

test("photos du back-office : un texte renommé en .jpg est refusé, une vraie photo passe", async ({ page }) => {
  // Pas de watchErrors ici : le refus attendu (HTTP 415) est inscrit par Chrome dans la console comme une erreur.
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto("/admin/products/new");
  const input = page.locator('input[type="file"]');

  // Le navigateur annonce image/jpeg et le nom finit en .jpg : seul le contenu trahit le texte.
  const refused = page.waitForResponse((r) => r.url().endsWith("/api/admin/upload"));
  await input.setInputFiles({ name: "faux.jpg", mimeType: "image/jpeg", buffer: Buffer.from("Ceci n'est pas une photo, juste du texte.\n".repeat(20)) });
  expect((await refused).status()).toBe(415);
  await expect(page.getByText("faux.jpg : Format accepté : JPG, PNG, WebP ou AVIF.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Photo 1" })).toHaveCount(0);

  // Contre-épreuve : une vraie photo du dépôt est acceptée par la même route.
  const accepted = page.waitForResponse((r) => r.url().endsWith("/api/admin/upload"));
  await input.setInputFiles({ name: "bougie.jpg", mimeType: "image/jpeg", buffer: await readFile(path.join(process.cwd(), "public/products/bougie.jpg")) });
  expect((await accepted).status()).toBe(200);
  await expect(page.getByRole("img", { name: "Photo 1" })).toBeVisible();
});

test("caractère nul dans une recherche : la page répond, sans erreur (PostgreSQL le refuse dans un texte)", async ({ page }) => {
  const response = await page.goto("/fr/products?q=caf%00e");
  expect(response?.status()).toBe(200);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  const admin = await page.goto("/fr/admin/products?q=%00");
  expect(admin?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

/*
 * En-têtes de sécurité (`expectSecurityHeaders`, helpers.ts) sur toutes les adresses : pages de la boutique et du
 * back-office, routes API, fichiers envoyés, page introuvable.
 */
test.describe("en-têtes de sécurité", () => {
  test("sur une page de la boutique", async ({ request }) => {
    const response = await request.get("/fr/products");
    expect(response.status()).toBe(200);
    expectSecurityHeaders(response.headersArray(), "/fr/products");
  });

  test("sur une page du back-office", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.waitForURL("**/admin");
    const response = await page.goto("/fr/admin/products");
    expect(response?.status()).toBe(200);
    expectSecurityHeaders(await response!.headersArray(), "/fr/admin/products");
  });

  test("sur une route API, méthode refusée comprise", async ({ request }) => {
    const response = await request.get("/api/customizer/upload");
    expect(response.status()).toBe(405);
    expectSecurityHeaders(response.headersArray(), "GET /api/customizer/upload");
  });

  test("sur un fichier envoyé (/uploads/…)", async ({ request }) => {
    // Adresse propre au test : son envoi ne compte pas dans la limite de débit partagée par la suite.
    const sent = await request.post("/api/customizer/upload", {
      headers: { "x-forwarded-for": "198.51.100.41" },
      multipart: { file: { name: "bougie.jpg", mimeType: "image/jpeg", buffer: await readFile(path.join(process.cwd(), "public/products/bougie.jpg")) } },
    });
    expect(sent.status()).toBe(200);
    expectSecurityHeaders(sent.headersArray(), "POST /api/customizer/upload");
    const { url } = (await sent.json()) as { url: string };
    const file = await request.get(url);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toBe("image/jpeg");
    expectSecurityHeaders(file.headersArray(), url);
  });

  test("sur une page introuvable", async ({ request }) => {
    const response = await request.get("/fr/cette-page-n-existe-pas");
    expect(response.status()).toBe(404);
    expectSecurityHeaders(response.headersArray(), "/fr/cette-page-n-existe-pas");
  });
});
