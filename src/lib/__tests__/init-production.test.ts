import { execFileSync, spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { categories, products, settings as catalogSettings, shippingZones } from "../../../prisma/catalog.mjs";
import { onlyOnline } from "../../../prisma/write-catalog.mjs";
import { createDb, type Db } from "../db";
import { dropSchema, prismaEnv, ROOT, scratchSchema } from "@/test/database";

/*
 * prisma/init-production.mjs remplit une seule fois la base de production, vide : réglages, zones, rayons, produits
 * et compte administrateur, sans aucune donnée de démonstration (ni client, ni avis, ni commande, ni code promo).
 * Les produits arrivent en brouillon, sauf la tasse personnalisable, en ligne pour le contrôle de la mise en ligne
 * (envoi d'une image sur sa fiche) : décision du propriétaire, 19/11/2026.
 * Lancé ici comme le propriétaire le lancera, en processus à part, contre un schéma temporaire de la base de test.
 */
const { schema, url } = scratchSchema("initprod");
let db: Db | undefined;

const ADMIN_EMAIL = "Vendeur@Alarobia.mg";
const ADMIN_PASSWORD = "douze-signes!";

/** Environnement du script : la base temporaire, sans aucune variable héritée qui viserait une autre base ou un autre compte. */
function scriptEnv(vars: Record<string, string>) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "ADMIN_EMAIL", "ADMIN_PASSWORD"]) delete env[name];
  return { ...env, ...vars };
}

const run = (vars: Record<string, string>) =>
  spawnSync(process.execPath, ["prisma/init-production.mjs"], { cwd: ROOT, env: scriptEnv(vars), encoding: "utf8", timeout: 60_000 });

const withBase = (vars: Record<string, string>) => run({ DATABASE_URL: url, DATABASE_URL_UNPOOLED: url, ...vars });

async function counts() {
  const d = db!;
  const [users, admins, products, categories, zones, reviews, orders, promoCodes, subscribers, addresses, wishlist, customizations, settings] = await Promise.all([
    d.user.count(),
    d.user.count({ where: { role: "ADMIN" } }),
    d.product.count(),
    d.category.count(),
    d.shippingZone.count(),
    d.review.count(),
    d.order.count(),
    d.promoCode.count(),
    d.newsletterSubscriber.count(),
    d.address.count(),
    d.wishlistItem.count(),
    d.customization.count(),
    d.storeSettings.count(),
  ]);
  return { users, admins, products, categories, zones, reviews, orders, promoCodes, subscribers, addresses, wishlist, customizations, settings };
}

const EMPTY = { users: 0, admins: 0, products: 0, categories: 0, zones: 0, reviews: 0, orders: 0, promoCodes: 0, subscribers: 0, addresses: 0, wishlist: 0, customizations: 0, settings: 0 };

beforeAll(() => {
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], { cwd: ROOT, env: prismaEnv(url), stdio: "pipe" });
  db = createDb(url);
}, 60_000);

// Le schéma part même si un test échoue, ou si sa création a échoué à mi-chemin.
afterAll(async () => {
  await db?.$disconnect();
  await dropSchema(schema);
});

describe("init-production.mjs : refus avant toute écriture", () => {
  it("refuse sans ADMIN_EMAIL", async () => {
    const out = withBase({ ADMIN_PASSWORD });
    expect(out.status, out.stderr).toBe(1);
    expect(out.stderr).toMatch(/ADMIN_EMAIL/);
    expect(await counts()).toEqual(EMPTY);
  });

  it("refuse une adresse ADMIN_EMAIL invalide", async () => {
    const out = withBase({ ADMIN_EMAIL: "vendeur-alarobia.mg", ADMIN_PASSWORD });
    expect(out.status, out.stderr).toBe(1);
    expect(out.stderr).toMatch(/ADMIN_EMAIL/);
    expect(await counts()).toEqual(EMPTY);
  });

  it("refuse sans ADMIN_PASSWORD", async () => {
    const out = withBase({ ADMIN_EMAIL });
    expect(out.status, out.stderr).toBe(1);
    expect(out.stderr).toMatch(/ADMIN_PASSWORD/);
    expect(await counts()).toEqual(EMPTY);
  });

  it("refuse un mot de passe de 11 caractères", async () => {
    const out = withBase({ ADMIN_EMAIL, ADMIN_PASSWORD: "onze-signes" });
    expect(out.status, out.stderr).toBe(1);
    expect(out.stderr).toMatch(/ADMIN_PASSWORD.*12 caractères/);
    expect(await counts()).toEqual(EMPTY);
  });

  it("refuse sans DATABASE_URL, au lieu de se rabattre sur la base du fichier .env (développement)", async () => {
    const out = run({ ADMIN_EMAIL, ADMIN_PASSWORD });
    expect(out.status, out.stderr).toBe(1);
    expect(out.stderr).toMatch(/DATABASE_URL/);
  });

  it("refuse une base qui contient déjà une commande", async () => {
    const order = await db!.order.create({
      data: { number: "AL-0001", email: "a@b.mg", paymentMethod: "COD", shippingZone: "Antananarivo ville", subtotalCents: 0, shippingCents: 0, totalCents: 0, fullName: "A", line1: "Lot 1", city: "Antananarivo", phone: "034 12 345 67" },
    });
    try {
      const out = withBase({ ADMIN_EMAIL, ADMIN_PASSWORD });
      expect(out.status, out.stderr).toBe(1);
      expect(out.stderr).toMatch(/pas vide/);
      expect(await counts()).toEqual({ ...EMPTY, orders: 1 });
    } finally {
      await db!.order.delete({ where: { id: order.id } });
    }
  });
});

describe("init-production.mjs : première exécution sur une base vide", () => {
  it("crée les réglages, les zones, les rayons, les produits et le compte administrateur, rien d'autre", async () => {
    // Comme en vrai : le site est en ligne avant le script, et sa première page affichée a créé la ligne de réglages par
    // défaut (getSettings, src/lib/settings.ts). Le 19/11/2026, ce doublon faisait échouer le script sur la base Neon.
    await db!.storeSettings.create({ data: { id: 1 } });
    const out = withBase({ ADMIN_EMAIL, ADMIN_PASSWORD });
    expect(out.status, `${out.stdout}${out.stderr}`).toBe(0);
    expect(await counts()).toEqual({
      ...EMPTY,
      users: 1,
      admins: 1,
      products: 27,
      categories: 6,
      zones: shippingZones.length,
      settings: 1,
    });
    expect(products).toHaveLength(27);
    expect(categories).toHaveLength(6);
  });

  it("ouvre le compte administrateur avec l'adresse en minuscules (comme à la connexion) et le mot de passe donné", async () => {
    const admin = await db!.user.findUniqueOrThrow({ where: { email: "vendeur@alarobia.mg" } });
    expect(admin.role).toBe("ADMIN");
    expect(await bcrypt.compare(ADMIN_PASSWORD, admin.passwordHash)).toBe(true);
  });

  it("laisse les numéros Mobile Money vides (paiement à la livraison seulement) et prend ADMIN_EMAIL comme adresse de contact", async () => {
    const settings = await db!.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(settings).toMatchObject({ mvolaNumber: "", orangeMoneyNumber: "", airtelMoneyNumber: "", contactEmail: "vendeur@alarobia.mg", currency: "MGA" });
    // Les valeurs par défaut de la ligne laissée par la première visite sont remplacées par celles du catalogue.
    expect(settings).toMatchObject({ announcement: catalogSettings.announcement, freeShippingThresholdCents: catalogSettings.freeShippingThresholdCents, mobileMoneyName: catalogSettings.mobileMoneyName });
  });

  it("met en ligne la seule tasse personnalisable, avec ses réglages, et laisse les 26 autres produits en brouillon", async () => {
    const online = await db!.product.findMany({ where: { status: "ACTIVE" } });
    expect(online.map((p) => p.slug)).toEqual(["tasse-en-gres-vato"]);
    expect(online[0]).toMatchObject({ customTemplate: "mug", customImage: true, customTextMax: 20, customSurchargeCents: 300_000 });
    expect(await db!.product.count({ where: { status: "DRAFT" } })).toBe(26);
  });

  it("écrit le catalogue complet : traductions, photos et réglages de personnalisation", async () => {
    expect(await db!.productTranslation.count()).toBe(products.length * 2);
    expect(await db!.categoryTranslation.count()).toBe(categories.length * 2);
    expect(await db!.productImage.count()).toBe(products.reduce((n, p) => n + p.images.length, 0));
    const custom = await db!.product.findMany({ where: { customTemplate: { not: "" } }, select: { customTemplate: true } });
    expect(custom.map((p) => p.customTemplate).sort()).toEqual(products.flatMap((p) => (p.custom ? [p.custom.template] : [])).sort());
  });

  it("refuse une seconde exécution, sans rien changer à la base", async () => {
    const before = await counts();
    const hash = (await db!.user.findUniqueOrThrow({ where: { email: "vendeur@alarobia.mg" } })).passwordHash;
    const out = withBase({ ADMIN_EMAIL: "autre@alarobia.mg", ADMIN_PASSWORD: "un-autre-mot-de-passe" });
    expect(out.status, out.stderr).toBe(1);
    expect(out.stderr).toMatch(/pas vide/);
    expect(await counts()).toEqual(before);
    expect((await db!.user.findUniqueOrThrow({ where: { email: "vendeur@alarobia.mg" } })).passwordHash).toBe(hash);
  });
});

describe("onlyOnline : choix du statut des produits de départ", () => {
  it("met en ligne le produit désigné par son adresse, et lui seul", () => {
    const status = onlyOnline("tasse-en-gres-vato");
    expect(status("tasse-en-gres-vato")).toBe("ACTIVE");
    expect(status("gourde-isotherme-foret")).toBe("DRAFT");
  });

  it("échoue en nommant l'adresse quand aucun produit du catalogue ne la porte, au lieu de tout mettre en brouillon", () => {
    expect(() => onlyOnline("tasse-disparue")).toThrow(/tasse-disparue/);
  });
});
