import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

/** Échoue le test si la page émet une erreur JavaScript, une erreur console ou une réponse 5xx. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()} : ${String(e).slice(0, 300)}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console ${page.url()} : ${m.text().slice(0, 300)}`));
  page.on("response", (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  return () => expect(errors, "aucune erreur navigateur ou serveur").toEqual([]);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

export const ADMIN = { email: "admin@alarobia.example", password: "admin1234" };

export const CLIENT = { email: "client@alarobia.example", password: "client1234" };

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
 * quand le champ lui-même est caché : le libellé parent (`has-focus-visible`) ou l'élément suivant (`peer-focus-visible`).
 */
export async function focusIndicator(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { where: "body", indicator: null, visible: false };
    const where = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} « ${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)} »`;
    const transparent = (color: string) => color === "transparent" || /rgba?\([^)]*,\s*0\)$/.test(color.replace(/\s+/g, " ")) || /\/\s*0\)$/.test(color);
    const shadows = (value: string) => (value === "none" ? [] : value.split(/,(?![^(]*\))/));
    const drawn = (node: Element) => {
      const s = getComputedStyle(node);
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
    return { where, indicator: null, visible: el.matches(":focus-visible") };
  });
}

/** L'élément actif est focalisé au clavier et son focus se voit. */
export async function expectFocusShown(page: Page, step: string) {
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
