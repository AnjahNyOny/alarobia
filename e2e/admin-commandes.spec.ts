import { expect, test, type Page } from "@playwright/test";
import { ADMIN, CART_ADD_TIMEOUT, login, watchErrors } from "./helpers";

test.describe.configure({ mode: "serial" });

// Un PNG d'un pixel, choisi par le client comme image à imprimer.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const EMAIL = "atelier.miora@example.com";

let orderPath = "";
let orderNumber = "";
let printUrl = "";
let imageUrl = "";
/** Fichier envoyé par la fiche produit (le navigateur le prépare avant l'envoi : ce n'est pas l'octet près du PNG choisi). */
let sentImage = "";

/** Ouvre, côté vendeur, la commande passée par ce parcours. */
async function openOrder(page: Page) {
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto(orderPath);
}

test("un client commande une tasse à son nom, avec une image, et une tasse ordinaire", async ({ page }) => {
  const check = watchErrors(page);
  // La tasse Vato : 85 en stock, aucun autre parcours ne vérifie son stock ni ne compte les commandes.
  await page.goto("/products/tasse-en-gres-vato");
  await page.getByRole("tab", { name: "Personnaliser" }).click();
  await page.getByLabel("Votre texte").fill("Anjah");
  await page.locator('label:has(input[name="couleur"][value="laterite"])').click();
  await page.getByLabel("Ajouter une image").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "Votre image" })).toHaveAttribute("src", /\/uploads\/perso-.*\.png$/);
  sentImage = (await page.getByRole("img", { name: "Votre image" }).getAttribute("src")) ?? "";
  await expect(page.getByRole("img", { name: /Latérite, « Anjah »/ })).toBeVisible();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("dialog").getByText(/Personnalisé : Latérite, « Anjah »/)).toBeVisible({ timeout: CART_ADD_TIMEOUT });

  await page.goto("/products/tasse-en-gres-vato");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible({ timeout: CART_ADD_TIMEOUT });

  await page.goto("/checkout");
  await page.getByLabel("Adresse e-mail").fill(EMAIL);
  await page.getByLabel("Nom complet").fill("Anjah Rakoto");
  await page.getByLabel("Téléphone", { exact: true }).fill("034 12 345 67");
  await page.getByLabel("Adresse ou lot").fill("Lot II J 45");
  await page.getByLabel("Quartier").fill("Analakely");
  await page.getByLabel("Ville", { exact: true }).fill("Antananarivo");
  await page.getByLabel("Province", { exact: true }).selectOption("Antananarivo");
  await page.getByRole("radio", { name: /Paiement à la livraison/ }).check();
  await page.getByRole("button", { name: "Valider la commande" }).click();
  await page.waitForURL(/\/order\/c/);
  check();
});

test("le vendeur repère la commande à imprimer, puis y lit tout ce qu'il faut pour fabriquer la tasse", async ({ page }) => {
  const check = watchErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto(`/admin/orders?q=${EMAIL}`);
  const row = page.getByRole("row", { name: /atelier\.miora/ });
  await expect(row).toContainText("1 article à imprimer");
  await row.getByRole("link", { name: /^AL-/ }).click();
  await page.waitForURL(/\/admin\/orders\/c/);
  orderPath = new URL(page.url()).pathname;
  orderNumber = ((await page.getByRole("heading", { level: 1 }).textContent()) ?? "").replace("Commande ", "").trim();
  expect(orderNumber).toMatch(/^AL-/);

  const custom = page.locator("li[data-customized]");
  await expect(custom).toHaveCount(1);
  await expect(custom.getByRole("img", { name: /Aperçu de l'objet personnalisé : Tasse, Latérite/ })).toBeVisible();
  // Le texte exact, l'écriture, les couleurs, la zone imprimable et la taille du fichier.
  await expect(custom.locator("[data-print-text]")).toHaveText("Anjah");
  await expect(custom.getByText("Tasse", { exact: true })).toBeVisible();
  await expect(custom.getByText("Latérite", { exact: true })).toBeVisible();
  await expect(custom.getByText("Enseigne", { exact: true })).toBeVisible();
  await expect(custom.getByText("Envoyée par le client")).toBeVisible();
  await expect(custom.getByText("90 × 75 mm")).toBeVisible();
  await expect(custom.getByText("1600 × 1333 px, fond transparent")).toBeVisible();

  const print = custom.getByRole("link", { name: "Fichier d'impression" });
  const image = custom.getByRole("link", { name: "Image du client" });
  await expect(print).toHaveAttribute("download", "");
  printUrl = (await print.getAttribute("href")) ?? "";
  imageUrl = (await image.getAttribute("href")) ?? "";
  expect(printUrl).toMatch(/^\/api\/admin\/orders\/c\w+\/items\/c\w+\/print$/);

  // Atteignable au clavier : le lien reçoit le focus.
  await print.focus();
  await expect(print).toBeFocused();

  const printed = await page.request.get(printUrl);
  expect(printed.status()).toBe(200);
  expect(printed.headers()["content-type"]).toBe("image/png");
  expect(printed.headers()["content-disposition"]).toMatch(new RegExp(`^attachment; filename="${orderNumber}-\\d-impression\\.png"$`));
  expect(printed.headers()["cache-control"]).toBe("private, no-store");
  expect(printed.headers()["x-content-type-options"]).toBe("nosniff");

  const original = await page.request.get(imageUrl);
  expect(original.status()).toBe(200);
  expect(original.headers()["content-type"]).toBe("image/png");
  expect(original.headers()["content-disposition"]).toContain(`${orderNumber}-`);
  // C'est bien le fichier que le client a envoyé, octet pour octet.
  const sent = await page.request.get(sentImage);
  expect(Buffer.from(await original.body()).equals(Buffer.from(await sent.body()))).toBe(true);
  check();
});

test("les téléchargements répondent 404 sans session et avec la session d'un client", async ({ browser, playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL });
  for (const url of [printUrl, imageUrl]) {
    const res = await anonymous.get(url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(404);
  }
  await anonymous.dispose();

  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "client@alarobia.example", "client1234");
  await page.waitForURL("**/account");
  for (const url of [printUrl, imageUrl]) {
    const res = await page.request.get(url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(404);
  }
  await context.close();
});

test("le vendeur ne peut demander que les fichiers de cet article de cette commande", async ({ page }) => {
  await openOrder(page);
  const [, , , orderId, , itemId] = printUrl.split("/").slice(1);
  // Autre nature de fichier, article d'une autre commande, commande inexistante, chemin forgé : 404.
  const plainId = await page.locator("ul > li:not([data-customized])").first().getAttribute("data-item");
  for (const url of [
    `/api/admin/orders/${orderId}/items/${itemId}/preview`,
    `/api/admin/orders/inexistante/items/${itemId}/print`,
    `/api/admin/orders/${orderId}/items/inexistant/print`,
    `/api/admin/orders/${orderId}/items/${plainId}/print`,
    `/api/admin/orders/${orderId}/items/${itemId}/..%2F..%2F.env`,
  ]) {
    const res = await page.request.get(url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(404);
  }
});

test("un article ordinaire, de cette commande ou d'une autre, n'a aucun bloc de personnalisation", async ({ page }) => {
  const check = watchErrors(page);
  await openOrder(page);
  const items = page.locator("ul > li[data-item]");
  await expect(items).toHaveCount(2);
  const plain = items.and(page.locator(":not([data-customized])"));
  await expect(plain).toHaveCount(1);
  await expect(plain.getByText("Zone imprimable")).toHaveCount(0);
  await expect(plain.getByRole("link", { name: /Fichier d'impression|Image du client/ })).toHaveCount(0);
  await expect(page.getByText("Zone imprimable")).toHaveCount(1);

  // Commande de démonstration, sans personnalisation.
  await page.goto("/admin/orders?q=AL-10");
  await page.getByRole("link", { name: /^AL-10/ }).first().click();
  await page.waitForURL(/\/admin\/orders\/c/);
  await expect(page.locator("ul > li[data-item]").first()).toBeVisible();
  await expect(page.locator("li[data-customized]")).toHaveCount(0);
  await expect(page.getByText("Zone imprimable")).toHaveCount(0);
  check();
});

/** Stock de la tasse Vato, lu dans la liste des produits du back-office. */
async function vatoStock(page: Page) {
  await page.goto("/admin/products?q=Tasse en grès Vato");
  const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: "Tasse en grès Vato", exact: true }) });
  return Number(await row.getByRole("cell").nth(3).textContent());
}

test("une commande livrée n'a pas de bouton « Annuler la commande » : le colis ne revient pas forcément", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  await page.goto("/admin/orders?status=DELIVERED");
  await page.getByRole("link", { name: /^AL-/ }).first().click();
  await page.waitForURL(/\/admin\/orders\/c/);
  await expect(page.locator("#commande-statut")).toHaveText("Livrée");
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler la commande" })).toHaveCount(0);
});

test("une commande payée par Mobile Money prévient que le remboursement se fait à la main", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
  // Commandes de démonstration « payées » : toutes en Mobile Money (un paiement à la livraison n'est payé qu'à la remise).
  await page.goto("/admin/orders?status=PAID");
  await page.getByRole("link", { name: /^AL-/ }).first().click();
  await page.waitForURL(/\/admin\/orders\/c/);
  await page.getByRole("button", { name: "Annuler la commande" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(/Le client a payé .+ par (MVola|Orange Money|Airtel Money) : remboursez-le vous-même/);
  await dialog.getByRole("button", { name: "Garder la commande" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#commande-statut")).toHaveText("Payée");
});

test("le vendeur annule la commande depuis sa page : il peut renoncer, puis confirme, et le stock revient", async ({ page }) => {
  const check = watchErrors(page);
  await openOrder(page);
  const before = await vatoStock(page);
  await page.goto(orderPath);
  const cancel = page.getByRole("button", { name: "Annuler la commande" });
  const dialog = page.getByRole("dialog", { name: `Annuler la commande ${orderNumber} ?` });

  // Renoncer : la fenêtre se referme, le focus revient au bouton, rien ne change.
  await cancel.click();
  await expect(dialog).toContainText("ses articles retournent en stock");
  await expect(dialog).toContainText("C'est définitif");
  await expect(dialog).not.toContainText("remboursez-le"); // payée à la livraison, rien n'a été encaissé
  await dialog.getByRole("button", { name: "Garder la commande" }).click();
  await expect(dialog).toBeHidden();
  await expect(cancel).toBeFocused();
  await page.reload();
  await expect(page.locator("#commande-statut")).toHaveText("En attente");
  expect(await vatoStock(page)).toBe(before);

  // Confirmer au clavier.
  await page.goto(orderPath);
  await cancel.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Annuler la commande" }).click();
  await expect(page.getByText("Commande annulée : les articles sont de retour en stock.")).toBeVisible();
  await expect(page.locator("#commande-statut")).toHaveText("Annulée");
  await expect(page.locator("#commande-statut")).toBeFocused();
  await expect(cancel).toHaveCount(0);
  expect(await vatoStock(page)).toBe(before + 2);
  check();
});
