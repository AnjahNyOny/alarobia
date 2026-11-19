import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db";
import { createTestDatabase } from "@/test/database";
import { GET } from "@/app/api/cron/nettoyage/route";
import { cleanupCustomizations, staleFiles } from "../cleanup";

/*
 * Nettoyage quotidien des personnalisations jamais commandées, contre une vraie base (schéma temporaire) et un vrai
 * dossier d'envois (dossier temporaire, donc le stockage sur disque : SITE_ID n'est pas défini).
 */

const DAY = 864e5;
const name = (n: number) => `perso-00000000-0000-4000-8000-${String(n).padStart(12, "0")}.jpg`;

describe("staleFiles : nettoyage des images jamais commandées", () => {
  const now = new Date(100 * DAY);
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  it("supprime un fichier de personnalisation de plus de sept jours que rien ne référence", () => {
    expect(staleFiles([{ name: name(1), uploadedAt: ago(8) }], new Set(), now)).toEqual([name(1)]);
  });
  it("garde un fichier récent : son auteur est peut-être encore en train de commander", () => {
    expect(staleFiles([{ name: name(1), uploadedAt: ago(6) }], new Set(), now)).toEqual([]);
  });
  it("garde un fichier ancien encore référencé par une personnalisation ou une commande", () => {
    expect(staleFiles([{ name: name(1), uploadedAt: ago(90) }], new Set([name(1)]), now)).toEqual([]);
  });
  it("ne touche jamais aux autres fichiers du dossier, comme les photos de produits", () => {
    const files = [
      { name: "3f0c7a52-1b2c-4d3e-8f90-a1b2c3d4e5f6.jpg", uploadedAt: new Date(0) },
      { name: ".gitkeep", uploadedAt: new Date(0) },
      { name: "perso-notes.txt", uploadedAt: new Date(0) },
    ];
    expect(staleFiles(files, new Set(), now)).toEqual([]);
  });
});

// Le client de l'application (`db`) vise le schéma temporaire : la route et le nettoyage l'utilisent tels quels.
const test = vi.hoisted(() => ({ db: null as Db | null }));
vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db")>()),
  get db() {
    return test.db;
  },
}));

let database: ReturnType<typeof createTestDatabase>;
let db: Db;
let dir: string;
let productId: string;

beforeAll(async () => {
  database = createTestDatabase("nettoyage");
  db = test.db = database.db;
  const category = await db.category.create({ data: { name: "Cuisine", slug: "cuisine" } });
  productId = (await db.product.create({ data: { name: "Tasse", slug: "tasse", sku: "TASSE", description: "", priceCents: 1_200_000, stock: 10, categoryId: category.id } })).id;
}, 60_000);

afterAll(() => database?.drop());

const PRODUCT_PHOTO = "3f0c7a52-1b2c-4d3e-8f90-a1b2c3d4e5f6.jpg";

/**
 * Situation de départ, à J :
 * - 1, 2 : image et aperçu d'une personnalisation abandonnée depuis huit jours ;
 * - 3 : aperçu d'une personnalisation ancienne mais commandée ;
 * - 4, 5 : fichier d'impression et image d'une ligne de commande (copie figée, sans personnalisation en base) ;
 * - 6 : aperçu d'une personnalisation d'hier ;
 * - 7 : fichier ancien que rien ne référence (envoyé, jamais ajouté au panier) ; 8 : le même, envoyé hier ;
 * - une photo de produit ancienne.
 */
async function situation(now: Date) {
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.customization.deleteMany();
  await db.customization.create({ data: { productId, color: "laterite", image: name(1), preview: name(2), createdAt: ago(8) } });
  await db.customization.create({ data: { productId, color: "indigo", preview: name(3), createdAt: ago(30), orderedAt: ago(29) } });
  await db.customization.create({ data: { productId, color: "foret", preview: name(6), createdAt: ago(1) } });
  await db.order.create({
    data: {
      number: "AL-0001",
      email: "client@example.com",
      paymentMethod: "COD",
      shippingZone: "Antananarivo",
      subtotalCents: 1_200_000,
      shippingCents: 0,
      totalCents: 1_200_000,
      fullName: "Client",
      line1: "Lot II",
      city: "Antananarivo",
      phone: "0340000000",
      items: { create: { name: "Tasse", priceCents: 1_200_000, quantity: 1, printUrl: `/uploads/${name(4)}`, customization: JSON.stringify({ template: "mug", image: name(5) }) } },
    },
  });
  const files: [string, number][] = [[name(1), 8], [name(2), 8], [name(3), 30], [name(4), 60], [name(5), 60], [name(6), 1], [name(7), 9], [name(8), 1], [PRODUCT_PHOTO, 400]];
  for (const [file, days] of files) {
    await writeFile(path.join(dir, file), "image");
    await utimes(path.join(dir, file), ago(days), ago(days));
  }
}

const sorted = (names: string[]) => [...names].sort();
const ALL = sorted([name(1), name(2), name(3), name(4), name(5), name(6), name(7), name(8), PRODUCT_PHOTO]);

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "alarobia-nettoyage-"));
  vi.stubEnv("UPLOAD_DIR", path.relative(process.cwd(), dir));
  vi.stubEnv("SITE_ID", undefined);
  vi.stubEnv("NETLIFY_BLOBS_CONTEXT", undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("cleanupCustomizations", () => {
  it("à blanc : annonce la personnalisation abandonnée et ses fichiers, sans rien supprimer", async () => {
    const now = new Date();
    await situation(now);
    const result = await cleanupCustomizations({ dryRun: true, now });
    expect(result.abandoned).toBe(1);
    expect(sorted(result.files)).toEqual(sorted([name(1), name(2), name(7)]));
    expect(await db.customization.count()).toBe(3);
    expect(sorted(await readdir(dir))).toEqual(ALL);
  });

  it("supprime la personnalisation abandonnée et les fichiers que plus rien ne référence, rien d'autre", async () => {
    const now = new Date();
    await situation(now);
    const result = await cleanupCustomizations({ dryRun: false, now });
    expect(result.abandoned).toBe(1);
    expect(sorted(result.files)).toEqual(sorted([name(1), name(2), name(7)]));
    expect((await db.customization.findMany({ select: { preview: true } })).map((c) => c.preview).sort()).toEqual([name(3), name(6)]);
    expect(sorted(await readdir(dir))).toEqual(sorted([name(3), name(4), name(5), name(6), name(8), PRODUCT_PHOTO]));
  });
});

describe("GET /api/cron/nettoyage", () => {
  const SECRET = "secret-de-test-pour-le-nettoyage";
  const call = (query = "", authorization?: string) => GET(new Request(`http://localhost/api/cron/nettoyage${query}`, { headers: authorization ? { authorization } : {} }));

  it("503 quand CRON_SECRET n'est pas défini, avec un message qui le nomme", async () => {
    vi.stubEnv("CRON_SECRET", undefined);
    const res = await call("", `Bearer ${SECRET}`);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/CRON_SECRET/);
  });

  it("401 sans secret, ou avec un mauvais secret, et rien n'est supprimé", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    await situation(new Date());
    expect((await call()).status).toBe(401);
    expect((await call("", "Bearer mauvais-secret")).status).toBe(401);
    expect((await call("", SECRET)).status).toBe(401);
    expect(await db.customization.count()).toBe(3);
    expect(sorted(await readdir(dir))).toEqual(ALL);
  });

  it("essai à blanc avec ?dry-run=1 : annonce ce qui partirait, sans rien supprimer", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    await situation(new Date());
    const res = await call("?dry-run=1", `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ dryRun: true, abandoned: 1 });
    expect(sorted(body.files)).toEqual(sorted([name(1), name(2), name(7)]));
    expect(await db.customization.count()).toBe(3);
    expect(sorted(await readdir(dir))).toEqual(ALL);
  });

  it("avec le bon secret et sans essai à blanc : nettoie", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    await situation(new Date());
    const res = await call("", `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ dryRun: false, abandoned: 1 });
    expect(await db.customization.count()).toBe(2);
    expect(await readdir(dir)).not.toContain(name(7));
  });
});
