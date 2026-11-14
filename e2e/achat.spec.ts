import { expect, test } from "@playwright/test";
import { ADMIN, login, watchErrors } from "./helpers";

test.describe.configure({ mode: "serial" });

test("achat invité : panier, code promo, validation du formulaire, confirmation", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/products/casque-studio-one");
  await page.getByRole("button", { name: "Augmenter la quantité" }).click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible();
  await page.getByRole("link", { name: "Voir le panier" }).click();
  await page.waitForURL("**/cart");

  await page.getByLabel("Code promo").fill("NIMPORTE");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("n'existe pas")).toBeVisible();
  await page.getByLabel("Code promo").fill("bienvenue10");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("BIENVENUE10").first()).toBeVisible();

  await page.getByRole("link", { name: "Passer la commande" }).click();
  await page.waitForURL("**/checkout");
  await page.getByLabel("Adresse e-mail").fill("test.invite@example.com");
  await page.getByLabel("Nom complet").fill("Test Invité");
  await page.getByLabel("Adresse ou lot").fill("Lot IVB 12");
  await page.getByLabel("Quartier").fill("Ambohijatovo");
  await page.getByLabel("Repère").fill("En face de la pharmacie");
  await page.getByLabel("Ville", { exact: true }).fill("Antsirabe");
  await page.getByLabel("Province", { exact: true }).selectOption("Antananarivo");
  // Un numéro français n'est pas joignable par le livreur : le message dit quoi saisir.
  await page.getByLabel("Téléphone").fill("06 11 22 33 44");
  await page.getByRole("button", { name: /Payer et commander/ }).click();
  await expect(page.getByText("Indiquez un numéro malgache, par exemple 034 12 345 67.")).toBeVisible();
  // La saisie est conservée après l'erreur : seul le champ fautif est à corriger.
  await expect(page.getByLabel("Ville", { exact: true })).toHaveValue("Antsirabe");
  await expect(page.getByLabel("Province", { exact: true })).toHaveValue("Antananarivo");

  await page.getByLabel("Téléphone").fill("+261 34 11 222 33");
  // Le total suit la zone choisie : 2 × 350 000 Ar − 10 % = 630 000 Ar, au-dessus du seuil de gratuité.
  await expect(page.getByRole("radio", { name: /Antananarivo ville/ })).toBeChecked();
  await page.getByRole("radio", { name: /Grandes villes de province/ }).check();
  await expect(page.getByRole("radio", { name: /Grandes villes de province/ })).toBeChecked();
  await page.getByRole("button", { name: /Payer et commander/ }).click();
  await page.waitForURL(/\/order\/c/);
  await expect(page.getByRole("heading", { name: /votre commande est enregistrée/ })).toBeVisible();
  await expect(page.getByText("630 000 Ar").first()).toBeVisible();
  // L'adresse est relue comme elle a été donnée, le téléphone ramené à la forme nationale, la zone et la date promise affichées.
  await expect(page.getByText("Ambohijatovo")).toBeVisible();
  await expect(page.getByText("Antsirabe, Antananarivo")).toBeVisible();
  await expect(page.getByText("034 11 222 33")).toBeVisible();
  await expect(page.getByText("Grandes villes de province")).toBeVisible();
  await expect(page.getByText(/Livraison prévue au plus tard (lundi|mardi|mercredi|jeudi|vendredi|samedi) \d/)).toBeVisible();
  check();
});

test("le stock a baissé et l'administrateur expédie la commande", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto("/admin/orders?q=test.invite");
  await page.getByRole("link", { name: /^SV-/ }).first().click();
  await page.waitForURL(/\/admin\/orders\/c/);
  await page.getByLabel("Statut").selectOption("SHIPPED");
  await page.getByLabel("Numéro de suivi").fill("6A00011122233");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Commande mise à jour.")).toBeVisible();

  await page.goto("/admin/products?q=Casque Studio");
  await expect(page.getByRole("row", { name: /Casque Studio One/ })).toContainText("18");
  check();
});

test("sous le seuil de gratuité, le total change avec la zone de livraison", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/products/tasse-en-gres-vato");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible();
  await page.goto("/cart");
  // Dans le panier, la livraison n'est pas encore connue : elle dépend de la zone.
  await expect(page.getByText("Calculée à l'étape suivante")).toBeVisible();
  await page.goto("/checkout");
  // 12 000 Ar + 3 000 Ar pour Antananarivo ville, proposée par défaut.
  const total = page.locator("dd[aria-live]");
  await expect(total).toHaveText("15 000 Ar");
  await page.getByRole("radio", { name: /Autres localités/ }).check();
  await expect(total).toHaveText("27 000 Ar");
  // Chaque zone annonce son délai et la date promise.
  await expect(page.getByText(/1 à 2 jours ouvrés, au plus tard \w+ \d+ \w+/)).toBeVisible();
  check();
});
