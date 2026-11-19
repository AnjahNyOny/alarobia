import { expect, test, type Page } from "@playwright/test";
import { ADMIN, login, watchErrors, CART_ADD_TIMEOUT } from "./helpers";

test.describe.configure({ mode: "serial" });

/** Commande invitée d'un Clavier Frappe (2 en stock au départ) avec le moyen de paiement donné. Renvoie l'adresse de la confirmation. */
async function order(page: Page, email: string, payment: RegExp) {
  await page.goto("/fr/products/clavier-frappe");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible({ timeout: CART_ADD_TIMEOUT });
  await page.goto("/fr/checkout");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Nom complet").fill("Noro Rasoa");
  await page.getByLabel("Téléphone", { exact: true }).fill("033 45 678 90");
  await page.getByLabel("Adresse ou lot").fill("Lot 7 A");
  await page.getByLabel("Quartier").fill("Tsaralalana");
  await page.getByLabel("Ville", { exact: true }).fill("Antananarivo");
  await page.getByLabel("Province", { exact: true }).selectOption("Antananarivo");
  await page.getByRole("radio", { name: payment }).check();
  await page.getByRole("button", { name: "Valider la commande" }).click();
  await page.waitForURL(/\/order\/c/);
  return page.url();
}

/** Cellule « stock » du Clavier Frappe dans la liste des produits, attendue à cette valeur. */
const keyboardStockCell = async (page: Page, stock: number) => {
  await page.goto("/admin/products?q=Clavier Frappe");
  return page.getByRole("row", { name: /Clavier Frappe/ }).getByRole("cell", { name: String(stock), exact: true });
};

let unpaidOrderUrl = "";

// Point de vigilance 7 : le client dit avoir payé, l'argent n'arrive jamais.
test("Mobile Money déclaré mais jamais reçu : la commande reste en attente", async ({ page }) => {
  const check = watchErrors(page);
  unpaidOrderUrl = await order(page, "jamais.recu@example.com", /Orange Money/);
  const panel = page.getByRole("region", { name: "Paiement Orange Money" });
  // 120 000 Ar + 3 000 Ar de livraison, à envoyer au numéro Orange du vendeur.
  await expect(panel.getByText("123 000 Ar")).toBeVisible();
  await expect(panel.getByText("032 00 123 45")).toBeVisible();
  await panel.getByLabel("Référence de la transaction").fill("pp261114.1010.a00001");
  await panel.getByRole("button", { name: "Envoyer la référence" }).click();
  await expect(panel.getByText(/Référence PP261114\.1010\.A00001 reçue/)).toBeVisible();
  // Le client peut corriger une faute de frappe tant que le vendeur n'a pas tranché.
  await panel.getByLabel("Référence de la transaction").fill("PP261114.1010.A00002");
  await panel.getByRole("button", { name: "Corriger la référence" }).click();
  await expect(panel.getByText(/Référence PP261114\.1010\.A00002 reçue/)).toBeVisible();
  // Déclarer ne vaut pas paiement : rien n'annonce un paiement reçu.
  await page.reload();
  await expect(page.getByText(/Paiement reçu/)).toHaveCount(0);
  check();
});

test("le vendeur voit la référence, n'a rien reçu, annule : le stock est rendu", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  // Le dernier exemplaire reste réservé tant que la commande est en attente.
  await expect(await keyboardStockCell(page, 1)).toBeVisible();

  await page.goto("/admin/orders?q=jamais.recu");
  const row = page.getByRole("row", { name: /jamais\.recu/ });
  await expect(row).toContainText("En attente");
  await expect(row).toContainText("Référence à vérifier");
  await row.getByRole("link", { name: /^AL-/ }).click();
  await page.waitForURL(/\/admin\/orders\/c/);
  await expect(page.getByText("PP261114.1010.A00002")).toBeVisible();
  await expect(page.getByText(/n'expédiez pas avant/)).toBeVisible();

  await page.getByLabel("Statut").selectOption("CANCELLED");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Commande mise à jour.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Paiement reçu" })).toHaveCount(0);
  await expect(await keyboardStockCell(page, 2)).toBeVisible();
  check();
});

test("après l'annulation, le client ne peut plus déclarer de paiement", async ({ page }) => {
  await page.goto(unpaidOrderUrl);
  await expect(page.getByRole("region", { name: /Paiement/ })).toHaveCount(0);
  await expect(page.getByLabel("Référence de la transaction")).toHaveCount(0);
});

test("paiement à la livraison : pas d'indications Mobile Money, encaissé à la remise du colis", async ({ page }) => {
  const check = watchErrors(page);
  await order(page, "a.la.livraison@example.com", /Paiement à la livraison/);
  await expect(page.getByText("Vous réglerez à la livraison.")).toBeVisible();
  await expect(page.getByLabel("Référence de la transaction")).toHaveCount(0);

  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto("/admin/orders?q=a.la.livraison");
  await page.getByRole("row", { name: /a\.la\.livraison/ }).getByRole("link", { name: /^AL-/ }).click();
  await page.waitForURL(/\/admin\/orders\/c/);
  await expect(page.getByText("À encaisser par le livreur, en espèces.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Paiement reçu" })).toHaveCount(0);
  await page.getByLabel("Statut").selectOption("DELIVERED");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/Encaissé à la livraison le/)).toBeVisible();
  check();
});

test("réglages : un numéro du mauvais réseau est refusé, un opérateur sans numéro n'est plus proposé", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto("/admin/settings");
  await page.getByLabel("Numéro MVola").fill("032 11 222 33");
  await page.getByLabel("Numéro Airtel Money").fill("");
  await page.getByRole("button", { name: "Enregistrer les réglages" }).click();
  await expect(page.getByText("Ce numéro n'est pas sur le réseau MVola (il commence par 034 ou 038).")).toBeVisible();
  await page.getByLabel("Numéro MVola").fill("+261 38 11 222 33");
  await page.getByRole("button", { name: "Enregistrer les réglages" }).click();
  await expect(page.getByText("Réglages enregistrés.")).toBeVisible();
  // Le numéro est enregistré sous sa forme nationale, celle que le client verra.
  await page.reload();
  await expect(page.getByLabel("Numéro MVola")).toHaveValue("038 11 222 33");
  await expect(page.getByLabel("Numéro Airtel Money")).toHaveValue("");

  await page.goto("/fr/products/tasse-en-gres-vato");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible({ timeout: CART_ADD_TIMEOUT });
  await page.goto("/fr/checkout");
  await expect(page.getByRole("radio", { name: /MVola/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Orange Money/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Airtel Money/ })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Carte bancaire/ })).toHaveCount(0);
  check();
});
