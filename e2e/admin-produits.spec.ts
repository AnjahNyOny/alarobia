import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { ADMIN, heavyPhoto, login, naturalSize, sentBytes, UPLOAD_LIMIT, watchErrors } from "./helpers";

// Produits et rayon choisis parce qu'aucune autre spec ne les vérifie (base partagée, rechargée une fois au début).
// Thé noir Matinée : traduit en anglais ; en malgache, les caractéristiques manquent.

test.beforeEach(async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL("**/admin");
});

test("traduction d'un produit : onglets de langue, compteur à traduire, nom anglais visible en boutique", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/admin/products?q=Thé noir Matinée");
  const row = page.getByRole("row", { name: /Thé noir Matinée/ });
  await expect(row).toContainText("À traduire : mg");
  await row.getByRole("link", { name: "Thé noir Matinée", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Thé noir Matinée" })).toBeVisible();

  const english = page.getByRole("tab", { name: /English/ });
  const malagasy = page.getByRole("tab", { name: /Malagasy/ });
  await expect(english).not.toContainText("à traduire");
  await expect(malagasy).toContainText("1 à traduire");

  // Clavier : les flèches passent d'un onglet à l'autre.
  await page.getByRole("tab", { name: "Français" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(english).toBeFocused();
  await expect(english).toHaveAttribute("aria-selected", "true");
  const name = page.getByLabel("Nom du produit (anglais)");
  await expect(name).toBeVisible();
  // Le français reste sous les yeux du traducteur.
  await expect(page.getByRole("tabpanel").getByText("Thé noir Matinée", { exact: true })).toBeVisible();

  // Le compteur suit la saisie.
  const tagline = page.getByLabel("Accroche (anglais)");
  await tagline.fill("");
  await expect(english).toContainText("1 à traduire");
  await tagline.fill("Whole leaf, 100 g tin");
  await expect(english).not.toContainText("à traduire");

  await name.fill("Morning black tea");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/admin\/products(\?|$)/);

  await page.goto("/en/products/the-noir-matinee");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Morning black tea");
  await page.goto("/mg/products/the-noir-matinee");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dite mainty Matinée");
  // En malgache, les caractéristiques non traduites restent en français.
  await expect(page.getByRole("region", { name: "Toetoetra" }).getByRole("listitem").first()).toHaveText("Thé noir en feuilles entières");
  check();
});

test("une erreur dans un onglet fermé ouvre cet onglet", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/admin/products/new");
  await page.getByRole("tab", { name: /Malagasy/ }).click();
  // Le nom français, requis, est vide dans l'onglet fermé : le navigateur bloque l'envoi et l'onglet s'ouvre.
  await page.getByRole("button", { name: "Créer le produit" }).click();
  await expect(page.getByRole("tab", { name: "Français" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Nom du produit", { exact: true })).toBeVisible();

  // Erreur renvoyée par le serveur sur un champ malgache (trop long) : l'onglet malgache s'ouvre et l'erreur se lit.
  await page.getByLabel("Nom du produit", { exact: true }).fill("Natte en vondro");
  await page.getByLabel("Description", { exact: true }).fill("Une natte tressée pour le sol, à poser partout.");
  await page.getByLabel(/Prix de vente/).fill("15 000");
  await page.getByLabel("Référence (SKU)").fill("AL-TEST-NATTE");
  await page.getByLabel("Catégorie").selectOption({ label: "Maison" });
  await page.getByRole("tab", { name: /Malagasy/ }).click();
  // maxlength protège la saisie au clavier ; on le retire pour simuler un envoi qui le contourne.
  const mgName = page.getByLabel("Nom du produit (malgache)");
  await mgName.evaluate((el) => el.removeAttribute("maxlength"));
  await mgName.fill("a".repeat(121));
  await page.getByRole("tab", { name: "Français" }).click();
  await page.getByRole("button", { name: "Créer le produit" }).click();
  await expect(page.getByRole("tab", { name: /Malagasy/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /Malagasy/ })).toContainText("à corriger");
  await expect(page.getByText("120 caractères au maximum.")).toBeVisible();
  await expect(page.getByLabel("Nom du produit", { exact: true })).toHaveValue("Natte en vondro");
  check();
});

test("rendre un produit personnalisable : validation, puis couleurs proposées sur la fiche", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/products/portefeuille-marius");
  await expect(page.getByRole("tab", { name: "Personnaliser" })).toHaveCount(0);

  await page.goto("/admin/products?q=Portefeuille Marius");
  await page.getByRole("link", { name: "Portefeuille Marius", exact: true }).click();
  await expect(page.getByLabel("Longueur maximale du texte")).toBeHidden();
  await page.getByLabel("Gabarit").selectOption({ label: "Carnet" });
  await page.getByLabel("Longueur maximale du texte").fill("20");
  await page.getByLabel(/Supplément d'impression/).fill("2 000");
  await page.getByLabel("Le client peut ajouter une image").check();

  // Aucune couleur cochée : refus du serveur, la saisie reste.
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Cochez au moins une couleur.")).toBeVisible();
  await expect(page.getByLabel("Gabarit")).toHaveValue("carnet");
  await expect(page.getByLabel("Longueur maximale du texte")).toHaveValue("20");
  await expect(page.getByLabel(/Supplément d'impression/)).toHaveValue("2 000");

  const colors = page.getByRole("group", { name: "Couleurs proposées" });
  await colors.getByLabel("Indigo").check();
  await colors.getByLabel("Latérite").check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/admin\/products(\?|$)/);

  await page.goto("/products/portefeuille-marius");
  await page.getByRole("tab", { name: "Personnaliser" }).click();
  const swatches = page.locator("input[name=couleur]");
  await expect(swatches).toHaveCount(2);
  expect(await swatches.evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value))).toEqual(["laterite", "indigo"]);
  // Texte autorisé (20 caractères) : le champ est proposé.
  await expect(page.getByLabel("Votre texte")).toBeVisible();
  await expect(page.getByText("0 / 20")).toBeVisible();
  check();
});

test("une catégorie reçoit un nom anglais, visible dans la navigation en anglais", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/admin/categories");
  await page.getByRole("link", { name: "Modifier Soin" }).click();
  await expect(page.getByRole("heading", { name: "Modifier « Soin »" })).toBeVisible();
  const english = page.getByRole("tab", { name: /English/ });
  await english.click();
  await page.getByLabel("Nom (anglais)").fill("Body care");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Catégorie modifiée.")).toBeVisible();

  await page.goto("/en");
  await expect(page.getByRole("navigation", { name: "Aisles" }).getByRole("link", { name: "Body care" })).toBeVisible();
  check();
});

test("les textes du back-office ne sont envoyés qu'aux pages du back-office", async ({ page }) => {
  // La clé figure dans les messages sérialisés pour le fournisseur client (charge RSC incluse dans le HTML).
  const marker = "fallbackNote";
  await page.goto("/admin/products/new");
  expect(await page.content()).toContain(marker);
  for (const url of ["/fr", "/en/products/the-noir-matinee", "/mg/products?category=soin"]) {
    await page.goto(url);
    // Témoin : les messages de la boutique, eux, sont bien là.
    const html = await page.content();
    expect(html, url).toContain("customizer");
    expect(html, url).not.toContain(marker);
  }
});

test.describe("photos de produits (point de vigilance 11)", () => {
  test("une photo de téléphone de 8 Mo est réduite à 2048 px dans le navigateur, puis envoyée sous 4 Mo", async ({ page }) => {
    const check = watchErrors(page);
    await page.goto("/admin/products/new");
    const photo = await heavyPhoto(page);
    expect(photo.length).toBeGreaterThan(8 * 1024 * 1024);

    const answered = page.waitForResponse((r) => r.url().endsWith("/api/admin/upload"));
    await page.locator('input[type="file"]').setInputFiles({ name: "IMG_2041.jpg", mimeType: "image/jpeg", buffer: photo });
    const response = await answered;
    // Le corps envoyé est la photo réduite (une centaine de ko au moins), pas l'original.
    const sent = await sentBytes(response.request());
    expect(sent).toBeGreaterThan(100_000);
    expect(sent).toBeLessThan(UPLOAD_LIMIT);
    expect(response.status()).toBe(200);

    const { url } = await response.json();
    const served = await page.request.get(url);
    expect(served.status()).toBe(200);
    expect((await served.body()).length).toBeLessThan(UPLOAD_LIMIT);
    expect(await naturalSize(page, url)).toEqual({ width: 2048, height: 1536 });
    await expect(page.getByRole("img", { name: "Photo 1" })).toBeVisible();
    check();
  });

  test("une photo que le navigateur ne sait pas réduire (AVIF) et qui dépasse 4 Mo est refusée sans être envoyée", async ({ page }) => {
    const check = watchErrors(page);
    await page.goto("/admin/products/new");
    const sent: string[] = [];
    page.on("request", (r) => r.url().endsWith("/api/admin/upload") && sent.push(r.url()));
    // Signature AVIF, puis du vide jusqu'à 4 Mo + 1 octet : le navigateur ne la réduit pas (format inconnu de `reduceImage`).
    const avif = Buffer.concat([Buffer.from([0, 0, 0, 28]), Buffer.from("ftypavif")]);
    const heavy = Buffer.concat([avif, Buffer.alloc(UPLOAD_LIMIT + 1 - avif.length)]);
    await page.locator('input[type="file"]').setInputFiles({ name: "export.avif", mimeType: "image/avif", buffer: heavy });
    await expect(page.getByText("export.avif : Image trop lourde (4 Mo maximum).")).toBeVisible();
    expect(sent).toEqual([]);
    await expect(page.getByRole("img", { name: "Photo 1" })).toHaveCount(0);
    check();
  });

  test("une photo HEIC de plus de 4 Mo, illisible hors Safari, est refusée pour son format, sans être envoyée", async ({ page }) => {
    const check = watchErrors(page);
    await page.goto("/admin/products/new");
    const sent: string[] = [];
    page.on("request", (r) => r.url().endsWith("/api/admin/upload") && sent.push(r.url()));
    // Signature HEIC, puis du vide : Chrome ne sait pas la décoder. Le poids n'est pas le vrai problème, le format l'est.
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic")]);
    const heavy = Buffer.concat([heic, Buffer.alloc(UPLOAD_LIMIT + 1 - heic.length)]);
    await page.locator('input[type="file"]').setInputFiles({ name: "IMG_0042.HEIC", mimeType: "image/heic", buffer: heavy });
    await expect(page.getByText("IMG_0042.HEIC : Format accepté : JPG, PNG, WebP ou AVIF.")).toBeVisible();
    expect(sent).toEqual([]);
    check();
  });

  test("un envoi direct de plus de 4 Mo est refusé avec son motif", async ({ page }) => {
    // Une vraie photo, alourdie à 4 Mo + 1 octet : seul le poids peut la faire refuser.
    const photo = await readFile(path.join(process.cwd(), "public/products/bougie.jpg"));
    const heavy = Buffer.concat([photo, Buffer.alloc(UPLOAD_LIMIT + 1 - photo.length)]);
    const res = await page.request.post("/api/admin/upload", { multipart: { file: { name: "lourde.jpg", mimeType: "image/jpeg", buffer: heavy } } });
    expect(res.status()).toBe(413);
    expect(await res.json()).toEqual({ error: "Image trop lourde (4 Mo maximum).", code: "tooLarge" });
  });
});

test("le back-office ne reçoit pas les polices de la personnalisation", async ({ page }) => {
  const CUSTOMIZER_FONTS = /Baloo 2|Lora|Caveat/;
  // Familles et fichiers des @font-face de toutes les feuilles de la page, écrites dans le HTML ou liées.
  const faces = () =>
    page.evaluate(() =>
      [...document.styleSheets]
        .flatMap((sheet) => [...sheet.cssRules])
        .filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
        .map((rule) => ({ family: rule.style.getPropertyValue("font-family"), src: rule.style.getPropertyValue("src") })),
    );

  // Témoin : la fiche d'un produit personnalisable déclare bien les trois polices.
  await page.goto("/products/tasse-en-gres-vato");
  const store = (await faces()).filter((f) => CUSTOMIZER_FONTS.test(f.family));
  expect(new Set(store.map((f) => f.family.replaceAll('"', "")))).toEqual(new Set(["Baloo 2", "Baloo 2 Fallback", "Lora", "Lora Fallback", "Caveat", "Caveat Fallback"]));
  const files = store.flatMap((f) => [...f.src.matchAll(/url\("?([^")]+)"?\)/g)].map((m) => new URL(m[1], page.url()).pathname));
  expect(files.length).toBeGreaterThan(0);

  const downloaded: string[] = [];
  page.on("request", (r) => r.resourceType() === "font" && downloaded.push(new URL(r.url()).pathname));
  await page.goto("/admin/products/new");
  await page.waitForLoadState("networkidle");
  const html = await (await page.request.get("/fr/admin/products/new")).text();
  expect(html).toContain("@font-face");
  const declared = new Set(html.match(/@font-face\s*\{[^}]*\}/g)?.map((rule) => rule.match(/font-family:([^;]+)/)?.[1].replace(/[\\"]/g, "")));
  expect([...declared].filter((family) => family && CUSTOMIZER_FONTS.test(family))).toEqual([]);
  expect((await faces()).filter((f) => CUSTOMIZER_FONTS.test(f.family))).toEqual([]);
  expect(downloaded.filter((file) => files.includes(file))).toEqual([]);
});
