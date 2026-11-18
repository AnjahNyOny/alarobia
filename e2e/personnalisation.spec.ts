import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

// Images minimales mais réelles : un PNG d'un pixel, et de quoi tromper un contrôle fait sur le nom ou le type annoncé.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>');
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.from([0, 0, 0, 0]), Buffer.from("mif1heic")]);
const UPLOAD = "/api/customizer/upload";
const CUSTOM_FILE = /^perso-[0-9a-f-]{36}\.(jpg|png|webp)$/;

test.describe("envoi d'image par un visiteur (point de vigilance 2)", () => {
  test("une image valide est enregistrée sous un nom généré par le serveur, puis servie comme image", async ({ request }) => {
    const res = await request.post(UPLOAD, { multipart: { file: { name: "../../etc/passwd.jpg", mimeType: "image/jpeg", buffer: PNG } } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Le nom et le type annoncés (« .jpg », image/jpeg) sont ignorés : c'est un PNG, il est rangé comme tel.
    expect(body.name).toMatch(CUSTOM_FILE);
    expect(body.name.endsWith(".png")).toBe(true);
    expect(body).toMatchObject({ url: `/uploads/${body.name}`, width: 1, height: 1 });

    const served = await request.get(body.url);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toBe("image/png");
    expect(served.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("un SVG déguisé en photo est refusé avec son motif", async ({ request }) => {
    const res = await request.post(UPLOAD, { multipart: { file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: SVG } } });
    expect(res.status()).toBe(415);
    expect(await res.json()).toEqual({ error: "type" });
  });

  test("une photo HEIC d'iPhone est refusée avec un motif à part", async ({ request }) => {
    const res = await request.post(UPLOAD, { multipart: { file: { name: "IMG_0042.HEIC", mimeType: "image/heic", buffer: HEIC } } });
    expect(res.status()).toBe(415);
    expect(await res.json()).toEqual({ error: "heic" });
  });

  test("un fichier de plus de 5 Mo est refusé", async ({ request }) => {
    const heavy = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await request.post(UPLOAD, { multipart: { file: { name: "photo.png", mimeType: "image/png", buffer: heavy } } });
    expect(res.status()).toBe(413);
    expect(await res.json()).toEqual({ error: "tooLarge" });
  });

  test("un envoi sans fichier est refusé", async ({ request }) => {
    const res = await request.post(UPLOAD, { multipart: { autre: "champ" } });
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ error: "missing" });
  });
});

test.describe("personnalisation sur la fiche produit", () => {
  test("une tasse à son nom : aperçu en direct, supplément, aperçu jusque dans le panier", async ({ page }) => {
    const check = watchErrors(page);
    await page.goto("/products/tasse-en-gres-vato");
    await page.getByRole("tab", { name: "Personnaliser" }).click();
    await expect(page.locator('[data-view="3d"]')).toBeVisible();
    await page.getByLabel("Votre texte").fill("Anjah");
    await page.locator('label:has(input[name="couleur"][value="laterite"])').click();
    await expect(page.getByRole("img", { name: /Latérite, « Anjah »/ })).toBeVisible();
    await expect(page.getByText("Avec l'impression (+ 3 000 Ar)")).toBeVisible();
    await expect(page.getByText("n'est ni repris ni échangé")).toBeVisible();

    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Personnalisé : Latérite, « Anjah »")).toBeVisible();
    await expect(drawer.getByText("15 000 Ar").first()).toBeVisible();
    // L'aperçu remplace la photo du produit, et c'est bien un fichier de personnalisation.
    await expect(drawer.locator('img[src*="perso-"]')).toHaveCount(1);
    check();
  });

  test("on peut passer à la vue à plat puis revenir à la 3D", async ({ page }) => {
    await page.goto("/products/tasse-en-gres-vato");
    await page.getByRole("tab", { name: "Personnaliser" }).click();
    // Attendre le canevas lui-même : le cadre « 3d » existe avant que la scène ne soit téléchargée.
    await expect(page.locator('[data-view="3d"] canvas')).toBeVisible();
    await page.getByRole("button", { name: "Voir à plat" }).click();
    await expect(page.locator('[data-view="flat"]')).toBeVisible();
    // La scène 3D libère son contexte graphique une demi-seconde après sa fermeture : cela ne doit pas passer pour une panne.
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Voir en 3D" }).click();
    await expect(page.locator('[data-view="3d"] canvas')).toBeVisible();
  });

  test("réseau lent : l'objet s'affiche à plat pendant le téléchargement de la 3D, qui le remplace ensuite", async ({ page }) => {
    await page.goto("/products/tasse-en-gres-vato");
    await page.waitForLoadState("networkidle");
    // Tout script demandé à partir d'ici (la scène 3D) met deux secondes à arriver.
    await page.route("**/_next/static/chunks/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });
    await page.getByRole("tab", { name: "Personnaliser" }).click();
    const waiting = page.locator("#scene-produit canvas[aria-hidden]");
    await expect(waiting).toBeVisible();
    await expect(page.locator('[data-view="3d"] canvas')).toHaveCount(0);
    await expect(page.locator('[data-view="3d"] canvas')).toBeVisible({ timeout: 15_000 });
    await expect(waiting).toHaveCount(0);
  });

  test("un prénom écrit sur l'accueil suit jusqu'à la fiche, ouverte sur la personnalisation", async ({ page }) => {
    const check = watchErrors(page);
    await page.goto("/");
    // Au repos, la page ne montre qu'une photo : rien de la personnalisation n'est chargé.
    await expect(page.getByRole("img", { name: "Tasse rouge latérite portant le prénom Anjah" })).toBeVisible();
    await expect(page.locator("[data-view]")).toHaveCount(0);
    await page.getByLabel("Écrivez votre prénom").fill("Tsiky");
    await expect(page.getByRole("img", { name: /Latérite, « Tsiky »/ })).toBeVisible();
    await page.getByRole("link", { name: "Personnaliser cette tasse" }).click();
    await page.waitForURL("**/products/tasse-en-gres-vato?perso=Tsiky");
    await expect(page.getByRole("tab", { name: "Personnaliser" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Votre texte")).toHaveValue("Tsiky");
    check();
  });

  test("le même dessin ajouté deux fois augmente la quantité au lieu de créer une ligne", async ({ page }) => {
    await page.goto("/products/gourde-isotherme-foret");
    await page.getByRole("tab", { name: "Personnaliser" }).click();
    await page.getByLabel("Votre texte").fill("Aina");
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Ajouter au panier" }).click();
      await expect(page.getByRole("dialog").getByText("Personnalisé : Forêt, « Aina »")).toBeVisible();
      await page.keyboard.press("Escape");
    }
    await page.goto("/cart");
    await expect(page.getByText("Personnalisé : Forêt, « Aina »")).toHaveCount(1);
  });

  test("une image refusée est expliquée sous le bouton, sans rien casser", async ({ page }) => {
    const check = watchErrors(page);
    await page.goto("/products/tasse-en-gres-vato");
    await page.getByRole("tab", { name: "Personnaliser" }).click();
    await page.getByLabel("Ajouter une image").setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: SVG });
    // Next ajoute sa propre zone « alert » (annonce des changements de page) : on cible le message par son texte.
    await expect(page.getByRole("alert").filter({ hasText: "Ce fichier n'est pas une image JPG, PNG ou WebP." })).toBeVisible();
    await page.getByLabel("Ajouter une image").setInputFiles({ name: "IMG_0042.HEIC", mimeType: "image/heic", buffer: HEIC });
    await expect(page.getByRole("alert").filter({ hasText: "format de photo d'iPhone (HEIC)" })).toBeVisible();
    check();
  });

  test("une image acceptée apparaît, avec ses réglages de taille et de position", async ({ page }) => {
    await page.goto("/products/tasse-en-gres-vato");
    await page.getByRole("tab", { name: "Personnaliser" }).click();
    await page.getByLabel("Ajouter une image").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("img", { name: "Votre image" })).toHaveAttribute("src", /\/uploads\/perso-.*\.png$/);
    await expect(page.getByLabel("Taille de l'image")).toBeVisible();
    await expect(page.getByRole("button", { name: "Changer d'image" })).toBeVisible();
  });
});

test.describe("téléphone sans WebGL (point de vigilance 1)", () => {
  test("l'aperçu passe à plat avec les mêmes réglages, et la commande reste possible", async ({ page }) => {
    // Le navigateur refuse tout contexte WebGL, comme un téléphone ancien ou un pilote graphique en liste noire.
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return /webgl/i.test(type) ? null : getContext.call(this, type, ...(rest as []));
      } as typeof getContext;
    });
    const check = watchErrors(page);
    await page.goto("/products/tasse-en-gres-vato");
    await page.getByRole("tab", { name: "Personnaliser" }).click();
    await expect(page.locator('[data-view="flat"]')).toBeVisible();
    await expect(page.getByText("la 3D n'est pas disponible sur cet appareil")).toBeVisible();
    await page.getByLabel("Votre texte").fill("Haja");
    await expect(page.getByRole("img", { name: /« Haja »/ })).toBeVisible();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByRole("dialog").getByText("Personnalisé : Blanc, « Haja »")).toBeVisible();
    check();
  });
});
