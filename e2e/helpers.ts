import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, type Request } from "@playwright/test";

/** Échoue le test si la page émet une erreur JavaScript, une erreur console ou une réponse 5xx. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()} : ${String(e).slice(0, 300)}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console ${page.url()} : ${m.text().slice(0, 300)}`));
  page.on("response", (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  return () => expect(errors, "aucune erreur navigateur ou serveur").toEqual([]);
}

/**
 * En-têtes de sécurité, posés sur toutes les adresses par `headers()` dans next.config.ts. Pas de CSP pour l'instant
 * (PLAN.md, « Ce que la phase 7A ne fait pas »). Contrôlés en local (`securite.spec.ts`) et en ligne (`production.spec.ts`).
 */
export const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

/** Chaque en-tête de sécurité est présent une seule fois (pas de doublon entre next.config.ts et une route qui poserait le sien). */
export function expectSecurityHeaders(headers: { name: string; value: string }[], what: string) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    const values = headers.filter((h) => h.name.toLowerCase() === name).map((h) => h.value);
    expect(values, `${what} : ${name}`).toEqual([value]);
  }
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

export const ADMIN = { email: "admin@alarobia.example", password: "admin1234" };

export const CLIENT = { email: "client@alarobia.example", password: "client1234" };

/**
 * Attente du tiroir ou du panier après un ajout au panier, au lieu des 5 s par défaut. Tout ajout passe par la même
 * action serveur, qui redessine toute la mise en page ; pour un article personnalisé s'y ajoutent l'encodage de deux
 * images dans le navigateur (aperçu, fichier d'impression) et deux envois. Machine en pagination (8 Go de mémoire,
 * swap presque plein), l'ajout personnalisé a été mesuré à 9 s : action à 2,8 s, puis un navigateur qui ne peignait
 * plus qu'une image toutes les une à deux secondes ; d'habitude, 0,4 à 3,4 s.
 * Un ajout réellement en panne échoue quand même : envoi refusé ou action en erreur, le tiroir ne s'ouvre pas et un
 * message d'erreur s'affiche.
 */
export const CART_ADD_TIMEOUT = 15_000;

/**
 * Limite d'envoi voulue, 4 Mo : une requête vers une fonction Netlify ne dépasse pas 6 Mo, et le fichier y arrive encodé en
 * Base64. Écrite ici plutôt qu'importée de `src/lib/upload.ts` (`MAX_UPLOAD_BYTES`) : relever la constante doit faire échouer ces tests.
 */
export const UPLOAD_LIMIT = 4 * 1024 * 1024;

/**
 * Photo de téléphone de plus de 8 Mo (4000 × 3000, JPEG à 0,95), fabriquée dans la page plutôt que rangée dans le dépôt :
 * un dégradé couvert d'un bruit pseudo-aléatoire, que le JPEG compresse mal, comme le grain d'une vraie photo.
 * Le bruit est toujours le même : 9,2 Mo dans Chrome, réduite à 2048 px elle en pèse 1,1.
 */
export async function heavyPhoto(page: Page) {
  const base64 = await page.evaluate(async () => {
    const width = 4000;
    const height = 3000;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#c2410c");
    gradient.addColorStop(0.5, "#15803d");
    gradient.addColorStop(1, "#1d4ed8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height);
    let seed = 0x9e3779b9;
    for (let i = 0; i < pixels.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        pixels.data[i + c] += ((seed >>> 0) / 2 ** 32 - 0.5) * 120;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95));
    const url = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    return url.slice(url.indexOf(",") + 1);
  });
  return Buffer.from(base64, "base64");
}

/**
 * Poids du corps d'une requête tel que Chrome l'a envoyé, enveloppe du formulaire comprise. On lit l'en-tête
 * Content-Length : Playwright ne voit pas le contenu d'un fichier joint (`request.sizes()` y donne 0).
 */
export async function sentBytes(request: Request) {
  return Number(await request.headerValue("content-length"));
}

/** Dimensions réelles d'une image servie, lues par le navigateur. */
export function naturalSize(page: Page, url: string) {
  return page.evaluate(
    (src) =>
      new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error(`image illisible : ${src}`));
        img.src = src;
      }),
    url,
  );
}

/** Critères vérifiés par axe : WCAG 2.0 et 2.1, niveaux A et AA (plancher du projet, PLAN.md « Contraintes »). */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Attend la fin des transitions et animations CSS en cours (tiroir qui s'ouvre, onglet qui change) :
 * axe mesurerait sinon des contrastes et des positions intermédiaires. Les animations sans fin sont ignorées.
 */
export async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => null)),
    ),
  );
}

/**
 * Analyse axe de la page dans son état actuel. Échec souple : un parcours analyse tous ses écrans
 * avant d'échouer, et chaque défaut est nommé (écran, règle, élément, résumé).
 * `rules` remplace les critères WCAG par une liste de règles précises (par exemple `target-size`).
 */
export async function expectAccessible(page: Page, where: string, { rules }: { rules?: string[] } = {}) {
  await settle(page);
  const builder = new AxeBuilder({ page });
  if (rules) builder.withRules(rules);
  else builder.withTags(WCAG);
  const { violations } = await builder.analyze();
  const found = violations.flatMap((v) =>
    v.nodes.map((n) => `${v.id} (${v.impact}) ${n.target.join(" ")} : ${(n.failureSummary ?? v.help).replace(/\s+/g, " ").trim()}`),
  );
  expect.soft(found, `axe : ${where} (${page.url()})`).toEqual([]);
}

/**
 * Description de l'indicateur de focus de l'élément actif, ou `null` s'il n'en a pas.
 * Cherche un contour ou une ombre non nuls sur l'élément, puis là où les composants le dessinent
 * quand le champ lui-même est caché : le libellé parent (`has-focus-visible`) ou l'élément suivant (`peer-focus-visible`),
 * enfin sur les pseudo-éléments de l'élément.
 */
export async function focusIndicator(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { where: "body", indicator: null, visible: false };
    const where = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} « ${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)} »`;
    const transparent = (color: string) => color === "transparent" || /rgba?\([^)]*,\s*0\)$/.test(color.replace(/\s+/g, " ")) || /\/\s*0\)$/.test(color);
    const shadows = (value: string) => (value === "none" ? [] : value.split(/,(?![^(]*\))/));
    const drawn = (node: Element, pseudo?: string) => {
      const s = getComputedStyle(node, pseudo);
      if (pseudo && s.content === "none") return null;
      if (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && !transparent(s.outlineColor)) return `outline ${s.outlineWidth} ${s.outlineColor}`;
      for (const shadow of shadows(s.boxShadow)) {
        const color = shadow.match(/(rgba?|oklch|oklab|lab|color)\([^)]*\)|#[0-9a-f]+/i)?.[0] ?? "";
        const lengths = (shadow.replace(color, "").match(/-?\d*\.?\d+px/g) ?? []).map(parseFloat);
        if (!transparent(color) && lengths.some((n, i) => i >= 2 && n > 0)) return `box-shadow ${shadow.trim()}`;
      }
      return null;
    };
    const candidates = [el, el.closest("label"), el.nextElementSibling].filter((n): n is Element => !!n);
    for (const node of candidates) {
      const found = drawn(node);
      if (found) return { where, indicator: found, visible: el.matches(":focus-visible") };
    }
    // Lien qui couvre toute une carte : le contour est dessiné sur son pseudo-élément (`focus-visible:after:outline-2`).
    for (const pseudo of ["::after", "::before"]) {
      const found = drawn(el, pseudo);
      if (found) return { where, indicator: `${pseudo} ${found}`, visible: el.matches(":focus-visible") };
    }
    return { where, indicator: null, visible: el.matches(":focus-visible") };
  });
}

/**
 * L'élément actif est focalisé au clavier et son focus se voit. On mesure une fois les transitions finies :
 * les boutons (`transition-all`) et les champs font apparaître leur anneau en 150 ms, mesuré à 0 px juste après Tab.
 */
export async function expectFocusShown(page: Page, step: string) {
  await settle(page);
  const f = await focusIndicator(page);
  expect.soft(f.indicator, `${step} : indicateur de focus sur ${f.where}`).not.toBeNull();
}

/**
 * Appuie sur Tab (ou Maj+Tab) jusqu'à ce que `target` ait le focus, en vérifiant l'indicateur de focus
 * de chaque élément traversé. Échoue après `max` appuis.
 */
export async function tabTo(page: Page, target: Locator, { max = 60, back = false, step = "" }: { max?: number; back?: boolean; step?: string } = {}) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
    await expectFocusShown(page, step || String(target));
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
  }
  throw new Error(`${step} : ${String(target)} jamais atteint en ${max} tabulations`);
}
