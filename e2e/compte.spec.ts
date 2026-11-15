import { expect, test } from "@playwright/test";
import { login, watchErrors } from "./helpers";

test("inscription, favori, avis, puis accès refusé au back-office", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/register");
  await page.getByLabel("Nom complet").fill("Alice Martin");
  await page.getByLabel("Adresse e-mail").fill(`alice.${Date.now()}@example.com`);
  await page.getByLabel("Mot de passe").fill("motdepasse1");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/account");

  await page.goto("/products/bougie-veillee");
  await page.getByRole("button", { name: /Ajouter Bougie Veillée aux favoris/ }).click();
  await page.getByRole("button", { name: "5 étoiles sur 5" }).click();
  await page.getByLabel("Votre avis").fill("Parfum discret et très agréable, tient longtemps.");
  await page.getByRole("button", { name: "Publier mon avis" }).click();
  await expect(page.getByText("Merci, votre avis est publié.")).toBeVisible();

  await page.goto("/account/wishlist");
  await expect(page.getByRole("link", { name: "Bougie Veillée" })).toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/fr$/);
  check();
});

test("mot de passe incorrect : message générique, sans vider l'e-mail", async ({ page }) => {
  await login(page, "client@alarobia.example", "mauvais");
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  await expect(page.getByLabel("Adresse e-mail")).toHaveValue("client@alarobia.example");
});

test("un client ne peut pas lire la commande d'un autre", async ({ page }) => {
  await page.goto("/account/orders/inexistante");
  await expect(page).toHaveURL(/login/);
});

test("adresse du compte : téléphone malgache exigé, adresse proposée ensuite à la commande", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, "client@alarobia.example", "client1234");
  await page.waitForURL("**/account");
  await page.goto("/account/profile");
  // L'adresse de démonstration est préremplie, quartier et province compris.
  await expect(page.getByLabel("Quartier")).toHaveValue("Ankadivato");
  await expect(page.getByLabel("Province", { exact: true })).toHaveValue("Antananarivo");
  await page.getByLabel("Quartier").fill("Isoraka");
  await page.getByLabel("Code postal").fill("75001");
  await page.getByRole("button", { name: "Enregistrer l'adresse" }).click();
  await expect(page.getByText("Le code postal compte trois chiffres, par exemple 101.")).toBeVisible();
  await page.getByLabel("Code postal").fill("");
  await page.getByRole("button", { name: "Enregistrer l'adresse" }).click();
  await expect(page.getByText("Adresse enregistrée.")).toBeVisible();

  await page.goto("/products/tasse-en-gres-vato");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible();
  await page.goto("/checkout");
  await expect(page.getByLabel("Quartier")).toHaveValue("Isoraka");
  await expect(page.getByLabel("Code postal")).toHaveValue("");
  check();
});
