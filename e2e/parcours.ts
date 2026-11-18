// Parcours de bout en bout, enchaînés comme un client puis le vendeur les vivent, dans une langue et sur un appareil.
// Partagé par `parcours.spec.ts` (ordinateur) et `parcours-mobile.spec.ts` (téléphone) : le projet « mobile » ne prend
// que les fichiers dont le nom contient « mobile », le projet « ordinateur » les ignore.
//
// Les libellés attendus sont lus dans `messages/<langue>.json` (fusionnés sur le français comme le fait l'application),
// les noms et prix des produits dans `prisma/catalog.mjs` : un parcours en malgache vérifie le malgache réel.
// Produits choisis parce qu'aucune autre spec ne les modifie (base partagée, rechargée une fois au début de la suite) :
// le café et la tasse Vato pour le parcours A, un favori différent par langue et par appareil pour le parcours B.
// La commande garde les noms français des produits et de la zone (décision de la tâche 2.6) : la confirmation et le
// back-office ne sont donc pas comparés aux noms traduits.
// `admin.spec.ts` supprime des zones de livraison et `paiement.spec.ts` change le numéro MVola : on ne suppose ni l'un ni
// l'autre, on lit la première zone proposée et le numéro affiché, puis on les recoupe d'un écran à l'autre.

import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import { categories, products } from "../prisma/catalog.mjs";
import { mergeMessages, type Messages } from "../src/i18n/messages";
import { formatPrice, slugify } from "../src/lib/format";
import enMessages from "../messages/en.json";
import frMessages from "../messages/fr.json";
import mgMessages from "../messages/mg.json";
import { ADMIN, CLIENT } from "./helpers";

export const LOCALES = ["fr", "en", "mg"] as const;
export type Locale = (typeof LOCALES)[number];
export type Device = "ordinateur" | "mobile";
type Values = Record<string, string | number>;
type Translate = (key: string, values?: Values) => string;

const RAW: Record<Locale, Messages> = { fr: frMessages, en: enMessages, mg: mgMessages };
const messagesFor = (locale: Locale) => (locale === "fr" ? RAW.fr : mergeMessages(RAW.fr, RAW[locale]));

/** Traduction telle que l'application la produit (même socle, même moteur ICU). */
function translator(locale: Locale): Translate {
  const t = createTranslator({ locale, messages: messagesFor(locale) }) as unknown as (key: string, values?: Values) => string;
  return (key, values) => t(key, values);
}

const space = (text: string) => text.replace(/\s+/g, " ").trim();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Message traduit en expression régulière : les variables nommées dans `groups` deviennent ces motifs.
 * Espaces normalisés comme le fait Playwright avant de comparer un texte (espaces insécables compris).
 */
function pattern(t: Translate, key: string, groups: Record<string, string>) {
  const names = Object.keys(groups);
  let source = escape(space(t(key, Object.fromEntries(names.map((name, i) => [name, `@@${i}@@`])))));
  names.forEach((name, i) => (source = source.replace(`@@${i}@@`, groups[name])));
  return new RegExp(source);
}

/** Montant affiché (« 27 000 Ar », « Ar 27,000 ») en ariary ; le libellé « offerte » d'une livraison gratuite vaut 0. */
const ariary = (text: string) => Number(text.replace(/\D/g, "") || "0");
const price = (ar: number, locale: Locale) => formatPrice(ar * 100, "MGA", locale);

type CatalogEntry = { name: string; priceAr: number; custom?: { colors: string[]; surchargeAr: number }; en?: { name?: string }; mg?: { name?: string } };
function product(frenchName: string, locale: Locale) {
  const p = (products as unknown as CatalogEntry[]).find((candidate) => candidate.name === frenchName);
  if (!p) throw new Error(`produit absent du catalogue : ${frenchName}`);
  return { name: (locale !== "fr" && p[locale]?.name) || p.name, slug: slugify(p.name), priceAr: p.priceAr, custom: p.custom };
}
function aisle(slug: string, locale: Locale) {
  const c = categories.find((candidate) => candidate.slug === slug)!;
  return locale === "fr" ? c.name : c[locale].name;
}

// ── Contrôles faits à chaque écran ────────────────────────────────────────────────────────────────────────────

/** Espaces de premier niveau des messages : une clé affichée à la place d'un texte ressemble à « cart.title ». */
const NAMESPACES = Object.keys(RAW.fr);

function flatten(messages: Messages, prefix = ""): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]): [string, string][] => (typeof value === "string" ? [[`${prefix}${key}`, value]] : flatten(value, `${prefix}${key}.`)));
}

const leftoversCache = new Map<Locale, { whole: string[]; parts: string[] }>();
/**
 * Textes français qui ne doivent pas apparaître sur une page en anglais ou en malgache : un texte resté en dur dans un
 * composant, ou un message retombé sur le français. Seuls ceux qui diffèrent dans la langue visée, et qu'aucun texte
 * de cette langue ne contient, sont cherchés. Message sans variable : comparé à chaque texte de la page en entier ;
 * avec variables ou balises : ses morceaux fixes d'au moins 12 caractères sont cherchés dans le texte de la page.
 */
function frenchLeftovers(locale: Locale) {
  if (!leftoversCache.has(locale)) leftoversCache.set(locale, computeLeftovers(locale));
  return leftoversCache.get(locale)!;
}
function computeLeftovers(locale: Locale): { whole: string[]; parts: string[] } {
  if (locale === "fr") return { whole: [], parts: [] };
  const target = flatten(messagesFor(locale)).map(([, value]) => space(value));
  const translated = new Set(target);
  const french = flatten(RAW.fr).filter(([key, value]) => {
    const local = space(String(key.split(".").reduce<Messages | string | undefined>((node, k) => (typeof node === "object" ? node[k] : undefined), messagesFor(locale))));
    // Exemples de saisie (« Antananarivo ville ») : une donnée de la base peut légitimement les reprendre.
    return !key.endsWith("Placeholder") && space(value) !== local;
  });
  const whole = french.map(([, value]) => space(value)).filter((value) => !/[{}<>]/.test(value) && value.length >= 3 && !translated.has(value));
  const parts = french
    .flatMap(([, value]) => (/[{}<>]/.test(value) ? value.split(/[{}<>#]/).map(space) : []))
    .filter((part) => part.length >= 12 && /\p{L}{3}/u.test(part) && !target.some((text) => text.includes(part)));
  return { whole: [...new Set(whole)], parts: [...new Set(parts)] };
}

/** Relève, au fil du parcours, les erreurs JavaScript, les erreurs de console et les réponses 5xx d'une page. */
function errorLog(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()} : ${String(e).slice(0, 300)}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console ${page.url()} : ${m.text().slice(0, 300)}`));
  page.on("response", (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  return () => errors.splice(0);
}

type Session = { page: Page; locale: Locale; device: Device; who: string; errors: () => string[] };

/**
 * Contrôles communs à chaque écran du parcours, en échec souple : le parcours continue et tous les défauts sont nommés.
 * Langue de la page et de l'adresse, liens internes dans la langue, aucune clé ni texte français à la place d'une
 * traduction, aucun défilement horizontal sur téléphone, aucune erreur depuis l'écran précédent.
 */
async function checkScreen(s: Session, where: string) {
  const label = `${s.locale}, ${s.device}, ${s.who} — ${where}`;
  await expect.soft(s.page.locator("html"), `${label} : <html lang>`).toHaveAttribute("lang", s.locale);
  expect.soft(new URL(s.page.url()).pathname, `${label} : adresse`).toMatch(new RegExp(`^/${s.locale}(/|$)`));
  const leftovers = frenchLeftovers(s.locale);
  const found = await s.page.evaluate(
    ({ locale, namespaces, whole, parts }) => {
      const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
      const texts: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script, style, noscript, template") || !parent.checkVisibility()) continue;
        const text = normalize(node.textContent ?? "");
        if (text) texts.push(text);
      }
      const attributes = [...document.querySelectorAll("[aria-label], [placeholder], [alt], [title]")].flatMap((el) =>
        ["aria-label", "placeholder", "alt", "title"].map((name) => el.getAttribute(name)).filter((value): value is string => !!value).map(normalize),
      );
      const everything = [...texts, ...attributes, normalize(document.title)];
      const key = new RegExp(`(^|[^\\w@.])(${namespaces.join("|")})\\.[a-zA-Z]\\w*(\\.\\w+)*`);
      const keys = everything.filter((text) => key.test(text));
      const wholeSet = new Set(whole);
      const page = normalize(document.body.innerText);
      const french = [...everything.filter((text) => wholeSet.has(text)), ...parts.filter((part) => page.includes(part))];
      const prefix = (href: string) => href === `/${locale}` || /^\/(api|uploads|_next)\//.test(href) || new RegExp(`^/${locale}[/?#]`).test(href);
      const links = [
        ...[...document.querySelectorAll("a[href]:not([hreflang])")].map((a) => a.getAttribute("href")!),
        ...[...document.querySelectorAll("form[action]")].map((form) => form.getAttribute("action")!),
      ].filter((href) => href.startsWith("/") && !href.startsWith("//") && !prefix(href));
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return { keys, french: [...new Set(french)], links: [...new Set(links)], overflow };
    },
    { locale: s.locale, namespaces: NAMESPACES, ...leftovers },
  );
  expect.soft(found.keys, `${label} : clés de traduction affichées`).toEqual([]);
  expect.soft(found.french, `${label} : textes restés en français`).toEqual([]);
  expect.soft(found.links, `${label} : liens sans le préfixe /${s.locale}`).toEqual([]);
  // 1 px toléré : à une densité d'écran fractionnaire (2,625 sur le Pixel 7), scrollWidth s'arrondit au pixel supérieur.
  if (s.device === "mobile") expect.soft(found.overflow, `${label} : défilement horizontal`).toBeLessThanOrEqual(1);
  expect.soft(s.errors(), `${label} : erreurs navigateur ou serveur`).toEqual([]);
}

/**
 * Capture pleine page, seulement si `PARCOURS_CAPTURES` désigne un dossier (relecture des écrans).
 * Depuis le haut de la page : sinon l'en-tête collant apparaît au milieu de la capture, là où la page défilait.
 */
async function capture(page: Page, name: string) {
  const dir = process.env.PARCOURS_CAPTURES;
  if (!dir) return;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

// ── Gestes communs ────────────────────────────────────────────────────────────────────────────────────────────

/** Ouvre le menu du téléphone si besoin et renvoie où chercher les liens de navigation de la boutique. */
async function storeNav(s: Session, t: Translate): Promise<Locator> {
  if (s.device === "mobile") {
    await s.page.getByRole("button", { name: t("nav.openMenu") }).click();
    return s.page.getByRole("dialog");
  }
  return s.page.getByRole("banner");
}

/** Même chose dans le back-office : la barre latérale sur ordinateur, le menu sur téléphone. */
async function adminNav(s: Session, t: Translate): Promise<Locator> {
  if (s.device === "mobile") {
    await s.page.getByRole("button", { name: t("admin.nav.openMenu") }).click();
    return s.page.getByRole("dialog").getByRole("navigation", { name: t("admin.nav.label") });
  }
  return s.page.getByRole("navigation", { name: t("admin.nav.label") });
}

async function signIn(s: Session, t: Translate, account: { email: string; password: string }, landing: string) {
  await s.page.getByLabel(t("auth.email"), { exact: true }).fill(account.email);
  await s.page.getByLabel(t("auth.password"), { exact: true }).fill(account.password);
  await s.page.getByRole("button", { name: t("auth.signIn"), exact: true }).click();
  await s.page.waitForURL(new RegExp(`/${s.locale}${landing}$`));
}

/** Le vendeur, sur son propre appareil : connexion, puis la commande retrouvée par son numéro dans la liste. */
async function vendorOpensOrder(s: Session, t: Translate, number: string) {
  await s.page.goto(`/${s.locale}/login`);
  await checkScreen(s, "connexion");
  await signIn(s, t, ADMIN, "/admin");
  await expect(s.page.getByRole("heading", { level: 1 })).toHaveText(t("admin.dashboard.title"));
  await checkScreen(s, "tableau de bord");

  await (await adminNav(s, t)).getByRole("link", { name: new RegExp(`^${escape(t("admin.nav.orders"))}`) }).click();
  await s.page.waitForURL(new RegExp(`/${s.locale}/admin/orders$`));
  const search = s.page.getByRole("searchbox", { name: t("admin.orders.searchPlaceholder") });
  await search.fill(number);
  await search.press("Enter");
  await s.page.waitForURL(new RegExp(`/${s.locale}/admin/orders\\?q=${number}$`));
  const row = s.page.getByRole("row", { name: new RegExp(number) });
  await expect(row).toHaveCount(1);
  return row;
}

async function vendorShips(s: Session, t: Translate, tracking: string) {
  await s.page.getByLabel(t("admin.orderForm.status"), { exact: true }).selectOption("SHIPPED");
  await s.page.getByLabel(new RegExp(`^${escape(t("admin.orderForm.tracking"))}`)).fill(tracking);
  await s.page.getByRole("button", { name: t("admin.orderForm.save"), exact: true }).click();
  await expect(s.page.getByText(t("admin.notices.orderUpdated"), { exact: true })).toBeVisible();
  const header = s.page.locator("header", { has: s.page.getByRole("heading", { level: 1 }) });
  await expect(header.getByText(t("status.SHIPPED"), { exact: true })).toBeVisible();
}

/** Remplit l'adresse de livraison d'un client sans compte, avec une adresse malgache. */
async function fillGuestAddress(page: Page, t: Translate, email: string) {
  const field = (key: string) => page.getByLabel(t(key), { exact: true });
  await field("checkout.email").fill(email);
  await field("address.fullName").fill("Fara Randrianarisoa");
  await field("address.phone").fill("034 21 654 98");
  await field("address.line1").fill("Lot IVD 27 bis");
  await field("address.district").fill("Ambatonakanga");
  // Champ facultatif : son nom accessible se termine par « facultatif » dans la langue de la page.
  await page.getByLabel(new RegExp(`^${escape(t("address.landmark"))}`)).fill("Portail vert");
  await field("address.city").fill("Antananarivo");
  await field("address.province").selectOption("Antananarivo");
}

/** Zone et total de la page de commande : la première zone proposée est choisie d'office. */
async function checkoutTotals(page: Page, t: Translate) {
  const zones = page.getByRole("group", { name: t("delivery.legend") });
  await expect(zones.getByRole("radio").first()).toBeChecked();
  const summary = page.getByRole("complementary");
  const shipping = await summary.getByText(t("cart.shipping"), { exact: true }).locator("xpath=following-sibling::dd[1]").innerText();
  const total = await summary.locator("dd[aria-live]").innerText();
  return { shippingAr: shipping.trim() === t("delivery.free") ? 0 : ariary(shipping), totalAr: ariary(total) };
}

// ── Parcours A : client sans compte, Mobile Money, puis le vendeur ───────────────────────────────────────────

/** Un mot de la langue pour trouver le café par la recherche de l'en-tête. */
const COFFEE_WORD: Record<Locale, string> = { fr: "café", en: "coffee", mg: "kafe" };
const FIRST_NAME: Record<Locale, string> = { fr: "Miora", en: "Tiana", mg: "Fanja" };

export async function guestMobileMoney({ browser, page, locale, device }: { browser: Browser; page: Page; locale: Locale; device: Device }) {
  const t = translator(locale);
  const client: Session = { page, locale, device, who: "client", errors: errorLog(page) };
  const coffee = product("Café en grains des Hautes Terres", locale);
  const mug = product("Tasse en grès Vato", locale);
  const mugColor = mug.custom!.colors[0];
  const firstName = FIRST_NAME[locale];
  const mugUnitAr = mug.priceAr + mug.custom!.surchargeAr;
  const subtotalAr = coffee.priceAr + mugUnitAr;
  const design = `${t(`customizer.colors.${mugColor}`)}, ${t("customizer.summary.text", { text: firstName })}`;
  let number = "";
  let totalAr = 0;
  let merchantNumber = "";
  let orderUrl = "";
  // Adresse longue mais réaliste (les noms malgaches le sont) : elle est recopiée en entier sur la confirmation,
  // et dépassait de l'écran d'un téléphone avant que le paragraphe ne puisse la couper.
  const email = `razafindrakoto.voahirana.${locale}${device === "mobile" ? "m" : "o"}${Date.now() % 100_000}@example.com`;
  const reference = `MP${Date.now().toString(36).toUpperCase()}`;
  const tracking = `6A${Date.now().toString().slice(-11)}`;

  await test.step("accueil, puis recherche par l'en-tête", async () => {
    await page.goto(`/${locale}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("home.title"));
    await checkScreen(client, "accueil");
    const search = (await storeNav(client, t)).getByRole("searchbox", { name: t("nav.search") });
    await search.fill(COFFEE_WORD[locale]);
    await search.press("Enter");
    await page.waitForURL(new RegExp(`/${locale}/products\\?q=`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("catalog.results", { q: COFFEE_WORD[locale] }));
    await checkScreen(client, "résultats de la recherche");
  });

  await test.step("fiche simple : ajout au panier", async () => {
    await page.getByRole("link", { name: coffee.name, exact: true }).click();
    await page.waitForURL(new RegExp(`/${locale}/products/${coffee.slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(coffee.name);
    await expect(page.getByText(price(coffee.priceAr, locale), { exact: true }).first()).toBeVisible();
    await checkScreen(client, "fiche du café");
    await page.getByRole("button", { name: t("product.add"), exact: true }).click();
    const drawer = page.getByRole("dialog", { name: t("cart.title") });
    await expect(drawer.getByRole("link", { name: coffee.name, exact: true })).toBeVisible();
    await checkScreen(client, "tiroir du panier, café ajouté");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  await test.step("tasse personnalisable : un prénom, ajout au panier", async () => {
    const kitchen = aisle("cuisine", locale);
    await (await storeNav(client, t)).getByRole("link", { name: kitchen, exact: true }).click();
    await page.waitForURL(new RegExp(`/${locale}/products\\?category=cuisine$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(kitchen);
    await checkScreen(client, "rayon Cuisine");
    await page.getByRole("link", { name: mug.name, exact: true }).click();
    await page.waitForURL(new RegExp(`/${locale}/products/${mug.slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(mug.name);
    await checkScreen(client, "fiche de la tasse");

    await page.getByRole("tab", { name: t("customizer.tabs.custom"), exact: true }).click();
    await expect(page.locator("[data-view]")).toBeVisible();
    await page.getByLabel(t("customizer.text"), { exact: true }).fill(firstName);
    await expect(page.getByRole("img", { name: `${t("customizer.alt", { name: mug.name, color: t(`customizer.colors.${mugColor}`) })}, ${t("customizer.summary.text", { text: firstName })}`, exact: true })).toBeVisible();
    // Le supplément d'impression et le prix final de la tasse, sur la même ligne.
    const surcharge = page.getByText(t("customizer.surcharge", { surcharge: `+ ${price(mug.custom!.surchargeAr, locale)}` }), { exact: true });
    await expect(surcharge).toBeVisible();
    await expect(surcharge.locator("xpath=..")).toContainText(space(price(mugUnitAr, locale)));
    await expect(page.getByText(t("customizer.noReturn"), { exact: true })).toBeVisible();
    await checkScreen(client, "onglet Personnaliser, prénom saisi");

    await page.getByRole("button", { name: t("product.add"), exact: true }).click();
    const drawer = page.getByRole("dialog", { name: t("cart.title") });
    await expect(drawer.getByText(t("customizer.summary.label", { details: design }), { exact: true })).toBeVisible();
    await expect(drawer.getByRole("listitem")).toHaveCount(2);
    // L'aperçu dessiné remplace la photo du produit dans la ligne personnalisée.
    await expect(drawer.locator('img[src*="perso-"]')).toHaveCount(1);
    await expect(drawer.getByText(price(subtotalAr, locale), { exact: true })).toBeVisible();
    await checkScreen(client, "tiroir du panier, tasse ajoutée");
    await drawer.getByRole("link", { name: t("cart.view"), exact: true }).click();
  });

  await test.step("panier : deux lignes, aperçu de la tasse, totaux", async () => {
    await page.waitForURL(new RegExp(`/${locale}/cart$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("cart.pageTitle"));
    const lines = page.getByRole("main").getByRole("listitem").filter({ has: page.getByRole("link", { name: new RegExp(`^(${escape(coffee.name)}|${escape(mug.name)})$`) }) });
    await expect(lines).toHaveCount(2);
    const mugLine = lines.filter({ hasText: mug.name });
    await expect(mugLine.getByText(t("customizer.summary.label", { details: design }), { exact: true })).toBeVisible();
    await expect(mugLine.locator('img[src*="perso-"]')).toBeVisible();
    await expect(mugLine.getByText(price(mugUnitAr, locale), { exact: true })).toBeVisible();
    await expect(lines.filter({ hasText: coffee.name }).getByText(price(coffee.priceAr, locale), { exact: true })).toBeVisible();
    const summary = page.getByRole("complementary");
    await expect(summary.getByText(t("cart.shippingLater"), { exact: true })).toBeVisible();
    await expect(summary.getByText(price(subtotalAr, locale), { exact: true })).toHaveCount(2);
    await checkScreen(client, "panier");
    await summary.getByRole("link", { name: t("cart.checkout"), exact: true }).click();
  });

  await test.step("commande sans compte : adresse malgache, première zone, MVola", async () => {
    await page.waitForURL(new RegExp(`/${locale}/checkout$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("checkout.title"));
    await checkScreen(client, "commande, formulaire vide");
    await fillGuestAddress(page, t, email);
    await page.getByRole("radio", { name: /^MVola/ }).check();
    const totals = await checkoutTotals(page, t);
    totalAr = totals.totalAr;
    expect(totalAr, "total de la commande = articles + livraison de la première zone").toBe(subtotalAr + totals.shippingAr);
    await checkScreen(client, "commande, formulaire rempli");
    await page.getByRole("button", { name: t("payment.submit"), exact: true }).click();
    await page.waitForURL(new RegExp(`/${locale}/order/c\\w+$`));
    orderUrl = page.url();
  });

  await test.step("confirmation : montant, numéro du vendeur, référence", async () => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("order.thanks"));
    await expect(page.getByText(t("payment.confirmationMobile", { operator: "MVola" }), { exact: false })).toBeVisible();
    await expect(page.getByText(t("order.notify", { email }), { exact: false })).toBeVisible();
    const panel = page.getByRole("region", { name: t("payment.title", { operator: "MVola" }) });
    const keyValue = (label: string) => panel.getByText(label, { exact: true }).locator("xpath=following-sibling::dd[1]/span[1]");
    await expect(keyValue(t("payment.amount"))).toHaveText(price(totalAr, locale));
    merchantNumber = space(await keyValue(t("payment.number", { operator: "MVola" })).innerText());
    // Réseau MVola : 034 ou 038, écrit sous sa forme nationale.
    expect(merchantNumber).toMatch(/^03[48] \d\d \d\d\d \d\d$/);
    const step2 = await panel.getByText(pattern(t, "payment.step2", { order: "AL-[A-Z0-9]+" })).innerText();
    number = step2.match(/AL-[A-Z0-9]+/)![0];
    await expect(page.getByText(number, { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByText(price(totalAr, locale), { exact: true }).last()).toBeVisible();
    await checkScreen(client, "confirmation");
    await capture(page, `A-${locale}-${device}-confirmation`);

    await panel.getByLabel(t("payment.referenceLabel"), { exact: true }).fill(reference.toLowerCase());
    await panel.getByRole("button", { name: t("payment.referenceSubmit"), exact: true }).click();
    await expect(panel.getByText(t("notices.referenceSaved"), { exact: true })).toBeVisible();
    await expect(panel.getByText(pattern(t, "payment.declared", { reference, date: ".+" }))).toBeVisible();
    await expect(panel.getByRole("button", { name: t("payment.referenceUpdate"), exact: true })).toBeVisible();
    await checkScreen(client, "référence déclarée");
  });

  const vendorContext = await browser.newContext();
  const vendorPage = await vendorContext.newPage();
  const vendor: Session = { page: vendorPage, locale, device, who: "vendeur", errors: errorLog(vendorPage) };
  try {
    await test.step("le vendeur repère la commande « référence à vérifier »", async () => {
      const row = await vendorOpensOrder(vendor, t, number);
      await expect(row).toContainText(t("admin.orders.paymentDeclared"));
      await expect(row).toContainText(t("admin.orders.toPrint", { count: 1 }));
      await expect(row).toContainText(t("status.PENDING"));
      await expect(row).toContainText(space(price(totalAr, locale)));
      await checkScreen(vendor, "liste des commandes");
      await row.getByRole("link", { name: number, exact: true }).click();
      await vendorPage.waitForURL(new RegExp(`/${locale}/admin/orders/c\\w+$`));
    });

    await test.step("détail : article personnalisé et fichier d'impression", async () => {
      await expect(vendorPage.getByRole("heading", { level: 1 })).toHaveText(t("admin.order.title", { number }));
      await expect(vendorPage.locator("li[data-item]")).toHaveCount(2);
      const custom = vendorPage.locator("li[data-customized]");
      await expect(custom).toHaveCount(1);
      const template = t("admin.customization.templates.mug");
      const color = t(`customizer.colors.${mugColor}`);
      await expect(custom.getByRole("img", { name: t("admin.order.custom.preview", { template, color }), exact: true })).toBeVisible();
      await expect(custom.locator("[data-print-text]")).toHaveText(firstName);
      await expect(custom.getByText(template, { exact: true })).toBeVisible();
      await expect(custom.getByText(t("customizer.fonts.enseigne"), { exact: true })).toBeVisible();
      await expect(custom.getByText(price(mugUnitAr, locale), { exact: true })).toBeVisible();
      const download = custom.getByRole("link", { name: t("admin.order.custom.downloadPrint"), exact: true });
      const printed = await vendorPage.request.get((await download.getAttribute("href"))!);
      expect(printed.status()).toBe(200);
      expect(printed.headers()["content-type"]).toBe("image/png");
      // Signature PNG : c'est bien une image, pas une page d'erreur servie avec le bon type.
      expect((await printed.body()).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      await expect(vendorPage.getByText(reference, { exact: true })).toBeVisible();
      await expect(vendorPage.getByText(t("admin.order.declaredCheck"), { exact: true })).toBeVisible();
      await checkScreen(vendor, "détail de la commande");
      await capture(vendorPage, `A-${locale}-${device}-back-office`);
    });

    await test.step("le vendeur confirme le paiement, puis expédie", async () => {
      await vendorPage.getByRole("button", { name: t("admin.order.markPaid"), exact: true }).click();
      const dialog = vendorPage.getByRole("alertdialog").or(vendorPage.getByRole("dialog"));
      await expect(dialog.getByText(t("admin.order.confirmTitle"), { exact: true })).toBeVisible();
      await dialog.getByRole("button", { name: t("admin.order.markPaid"), exact: true }).click();
      await expect(vendorPage.getByText(t("admin.notices.paymentConfirmed"), { exact: true })).toBeVisible();
      await expect(vendorPage.getByLabel(t("admin.orderForm.status"), { exact: true })).toHaveValue("PAID");
      await expect(vendorPage.getByText(pattern(t, "admin.order.receivedMobile", { date: ".+" }))).toBeVisible();
      await checkScreen(vendor, "paiement confirmé");
      await vendorShips(vendor, t, tracking);
      await checkScreen(vendor, "commande expédiée");
    });

    await test.step("le numéro donné au client est celui des réglages", async () => {
      await (await adminNav(vendor, t)).getByRole("link", { name: t("admin.nav.settings"), exact: true }).click();
      await vendorPage.waitForURL(new RegExp(`/${locale}/admin/settings$`));
      // Champ facultatif : son nom accessible se termine par « facultatif » dans la langue de la page.
      await expect(vendorPage.getByLabel(new RegExp(`^${escape(t("admin.settings.number", { operator: "MVola" }))}`))).toHaveValue(merchantNumber);
      await checkScreen(vendor, "réglages");
    });
  } finally {
    await vendorContext.close();
  }

  await test.step("le client revient sur sa confirmation : paiement reçu, numéro de suivi", async () => {
    await page.goto(orderUrl);
    await expect(page.getByText(pattern(t, "payment.received", { date: ".+" }))).toBeVisible();
    await expect(page.getByRole("region", { name: t("payment.title", { operator: "MVola" }) })).toHaveCount(0);
    await expect(page.getByText(tracking, { exact: true })).toBeVisible();
    await checkScreen(client, "confirmation après expédition");
  });
}

// ── Parcours B : client avec compte, paiement à la livraison ─────────────────────────────────────────────────

/**
 * Un favori différent par langue et par appareil : aucun parcours ne trouve le cœur déjà rempli par un autre, même si
 * l'un d'eux s'arrête avant de le retirer. Produits mis en avant (première page du catalogue), vendus tels quels.
 */
const FAVORITE: Record<Device, Record<Locale, string>> = {
  ordinateur: { fr: "T-shirt Essentiel blanc", en: "Écouteurs Pulse", mg: "Bougie Veillée" },
  mobile: { fr: "Panier tressé Soa", en: "Canapé Alba en velours", mg: "Café en grains des Hautes Terres" },
};

export async function accountCashOnDelivery({ browser, page, locale, device }: { browser: Browser; page: Page; locale: Locale; device: Device }) {
  const t = translator(locale);
  const client: Session = { page, locale, device, who: "client", errors: errorLog(page) };
  const favorite = product(FAVORITE[device][locale], locale);
  const tracking = `6B${Date.now().toString().slice(-11)}`;
  let number = "";
  let totalAr = 0;

  await test.step("connexion depuis l'en-tête", async () => {
    await page.goto(`/${locale}`);
    await checkScreen(client, "accueil");
    await page.getByRole("banner").getByRole("link", { name: t("nav.signIn"), exact: true }).click();
    await page.waitForURL(new RegExp(`/${locale}/login$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("auth.loginTitle"));
    await checkScreen(client, "connexion");
    await signIn(client, t, CLIENT, "/account");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(pattern(t, "account.hello", { name: ".+" }));
    await checkScreen(client, "espace client");
  });

  await test.step("favori depuis le catalogue", async () => {
    await (await storeNav(client, t)).getByRole("link", { name: t("nav.all"), exact: true }).click();
    await page.waitForURL(new RegExp(`/${locale}/products$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("catalog.all"));
    await checkScreen(client, "catalogue");
    const heart = page.getByRole("button", { name: t("card.addWish", { name: favorite.name }), exact: true });
    // On attend la réponse de l'action : le cœur se remplit avant que la base ne soit écrite.
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.ok()), heart.click()]);
    await expect(page.getByRole("button", { name: t("card.removeWish", { name: favorite.name }), exact: true })).toHaveAttribute("aria-pressed", "true");
    if (device === "mobile") {
      // Sur téléphone, l'en-tête n'a pas de lien vers les favoris : on passe par l'espace client.
      await page.getByRole("banner").getByRole("link", { name: t("nav.account"), exact: true }).click();
      await page.waitForURL(new RegExp(`/${locale}/account$`));
      await page.getByRole("navigation", { name: t("account.nav") }).getByRole("link", { name: t("account.navWishlist"), exact: true }).click();
    } else await page.getByRole("banner").getByRole("link", { name: t("nav.wishlist"), exact: true }).click();
    await page.waitForURL(new RegExp(`/${locale}/account/wishlist$`));
    await expect(page.getByRole("heading", { level: 2, name: t("account.wishlistTitle"), exact: true })).toBeVisible();
    await checkScreen(client, "favoris");
  });

  await test.step("commande du favori, adresse enregistrée, paiement à la livraison", async () => {
    await page.getByRole("link", { name: favorite.name, exact: true }).click();
    await page.waitForURL(new RegExp(`/${locale}/products/${favorite.slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(favorite.name);
    await checkScreen(client, "fiche du favori");
    await page.getByRole("button", { name: t("product.add"), exact: true }).click();
    const drawer = page.getByRole("dialog", { name: t("cart.title") });
    await expect(drawer.getByRole("link", { name: favorite.name, exact: true })).toBeVisible();
    await drawer.getByRole("link", { name: t("cart.checkout"), exact: true }).click();
    await page.waitForURL(new RegExp(`/${locale}/checkout$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("checkout.title"));
    // L'adresse du compte est proposée d'office.
    await expect(page.getByLabel(t("checkout.email"), { exact: true })).toHaveValue(CLIENT.email);
    for (const key of ["address.fullName", "address.phone", "address.line1", "address.district", "address.city"]) await expect(page.getByLabel(t(key), { exact: true }), key).not.toHaveValue("");
    await page.getByRole("radio", { name: new RegExp(`^${escape(t("payment.cod"))}`) }).check();
    const totals = await checkoutTotals(page, t);
    totalAr = totals.totalAr;
    expect(totalAr, "total de la commande = article + livraison de la première zone").toBe(favorite.priceAr + totals.shippingAr);
    await checkScreen(client, "commande");
    await page.getByRole("button", { name: t("payment.submit"), exact: true }).click();
    await page.waitForURL(new RegExp(`/${locale}/order/c\\w+$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("order.thanks"));
    await expect(page.getByText(t("payment.confirmationCod"), { exact: false })).toBeVisible();
    await expect(page.getByRole("region", { name: /MVola|Orange Money|Airtel Money/ })).toHaveCount(0);
    number = (await page.getByText(/AL-[A-Z0-9]+/).first().innerText()).match(/AL-[A-Z0-9]+/)![0];
    await checkScreen(client, "confirmation");
  });

  await test.step("l'espace client montre la commande en attente", async () => {
    await page.getByRole("link", { name: t("order.track"), exact: true }).click();
    await page.waitForURL(new RegExp(`/${locale}/account$`));
    const row = page.getByRole("link", { name: new RegExp(number) });
    await expect(row).toContainText(t("status.PENDING"));
    await expect(row).toContainText(space(price(totalAr, locale)));
    await checkScreen(client, "mes commandes");
    await row.click();
    await page.waitForURL(new RegExp(`/${locale}/account/orders/c\\w+$`));
    await expect(page.getByRole("heading", { level: 2, name: t("order.heading", { number }) })).toBeVisible();
    await expect(page.getByText(t("payment.onDelivery", { amount: price(totalAr, locale) }), { exact: true })).toBeVisible();
    await checkScreen(client, "détail de la commande");
  });

  await test.step("le favori se retire depuis la liste", async () => {
    await page.getByRole("navigation", { name: t("account.nav") }).getByRole("link", { name: t("account.navWishlist"), exact: true }).click();
    await page.waitForURL(new RegExp(`/${locale}/account/wishlist$`));
    const heart = page.getByRole("button", { name: t("card.removeWish", { name: favorite.name }), exact: true });
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.ok()), heart.click()]);
    await page.reload();
    await expect(page.getByRole("link", { name: favorite.name, exact: true })).toHaveCount(0);
    await checkScreen(client, "favoris après retrait");
  });

  const vendorContext = await browser.newContext();
  const vendorPage = await vendorContext.newPage();
  const vendor: Session = { page: vendorPage, locale, device, who: "vendeur", errors: errorLog(vendorPage) };
  try {
    await test.step("le vendeur expédie la commande payable à la livraison", async () => {
      const row = await vendorOpensOrder(vendor, t, number);
      await expect(row).toContainText(t("payment.cod"));
      await expect(row).toContainText(t("status.PENDING"));
      await row.getByRole("link", { name: number, exact: true }).click();
      await vendorPage.waitForURL(new RegExp(`/${locale}/admin/orders/c\\w+$`));
      await expect(vendorPage.getByText(t("admin.order.onDelivery"), { exact: true })).toBeVisible();
      await expect(vendorPage.getByRole("button", { name: t("admin.order.markPaid") })).toHaveCount(0);
      await checkScreen(vendor, "détail de la commande");
      await vendorShips(vendor, t, tracking);
      await checkScreen(vendor, "commande expédiée");
    });
  } finally {
    await vendorContext.close();
  }

  await test.step("le client voit sa commande expédiée", async () => {
    await page.goto(`/${locale}/account`);
    const row = page.getByRole("link", { name: new RegExp(number) });
    await expect(row).toContainText(t("status.SHIPPED"));
    await checkScreen(client, "mes commandes après expédition");
    await row.click();
    await page.waitForURL(new RegExp(`/${locale}/account/orders/c\\w+$`));
    await expect(page.getByText(t("status.SHIPPED"), { exact: true })).toBeVisible();
    await expect(page.getByText(tracking, { exact: true })).toBeVisible();
    await checkScreen(client, "commande expédiée");
    await capture(page, `B-${locale}-${device}-espace-client`);
  });
}
