import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteUploads, listUploads, readUpload, saveUpload, uploadExists } from "../storage";

/*
 * Stockage des fichiers envoyés : le disque en local et dans les tests, Netlify Blobs sur Netlify.
 * Le disque est testé pour de vrai, dans un dossier temporaire. Netlify Blobs est remplacé par un magasin en mémoire
 * qui se comporte comme la bibliothèque (types de lecture, métadonnées passées en JSON) : on vérifie ce que le code
 * lui demande, et ce qu'il rend de ses réponses.
 */

const { getStore } = vi.hoisted(() => ({ getStore: vi.fn() }));
vi.mock("@netlify/blobs", () => ({ getStore }));

type Metadata = Record<string, unknown>;

/** Magasin Netlify Blobs en mémoire, avec la même interface que `Store` pour ce que le code utilise. */
function memoryStore() {
  const blobs = new Map<string, { data: ArrayBuffer; metadata: Metadata }>();
  const toBuffer = async (data: ArrayBuffer | Blob | string) => (typeof data === "string" ? new TextEncoder().encode(data).buffer : data instanceof Blob ? data.arrayBuffer() : data.slice(0));
  return {
    blobs,
    async set(key: string, data: ArrayBuffer | Blob | string, options?: { metadata?: Metadata }) {
      // Les métadonnées voyagent en JSON dans un en-tête : une date n'en revient que sous forme de texte.
      blobs.set(key, { data: await toBuffer(data), metadata: JSON.parse(JSON.stringify(options?.metadata ?? {})) });
      return { modified: true };
    },
    async getWithMetadata(key: string, options?: { type?: string }) {
      const entry = blobs.get(key);
      if (!entry) return null;
      // Sans `type`, la bibliothèque rend du texte : une image y serait abîmée.
      const data = options?.type === "arrayBuffer" ? entry.data.slice(0) : new TextDecoder().decode(entry.data);
      return { data, etag: `"${key}"`, metadata: entry.metadata };
    },
    async getMetadata(key: string) {
      const entry = blobs.get(key);
      return entry ? { etag: `"${key}"`, metadata: entry.metadata } : null;
    },
    async list(options?: { prefix?: string }) {
      const keys = [...blobs.keys()].filter((key) => key.startsWith(options?.prefix ?? ""));
      return { blobs: keys.map((key) => ({ key, etag: `"${key}"` })), directories: [] };
    },
    async delete(key: string) {
      blobs.delete(key);
    },
  };
}

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0xff, 0x00, 0x80]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xfe, 0x01]);
const PERSO = (n: number, ext = "png") => `perso-00000000-0000-4000-8000-${String(n).padStart(12, "0")}.${ext}`;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "alarobia-envois-"));
  // Le dossier des envois se lit par rapport au dossier du projet (`upload-dir.ts`).
  vi.stubEnv("UPLOAD_DIR", path.relative(process.cwd(), dir));
  vi.stubEnv("SITE_ID", undefined);
  vi.stubEnv("NETLIFY_BLOBS_CONTEXT", undefined);
  vi.stubEnv("DEPLOY_CONTEXT", undefined);
  getStore.mockReset();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  await rm(dir, { recursive: true, force: true });
});

describe("hors de Netlify : le disque", () => {
  it("enregistre un fichier puis le relit, avec le type que donne son extension", async () => {
    await saveUpload("photo.png", PNG, "image/png");
    expect(await readUpload("photo.png")).toEqual({ bytes: PNG, contentType: "image/png" });
    await saveUpload("photo.avif", JPG, "image/avif");
    expect((await readUpload("photo.avif"))?.contentType).toBe("image/avif");
    expect(getStore).not.toHaveBeenCalled();
  });

  it("crée le dossier des envois s'il n'existe pas encore", async () => {
    vi.stubEnv("UPLOAD_DIR", path.relative(process.cwd(), path.join(dir, "neuf")));
    await saveUpload("photo.jpg", JPG, "image/jpeg");
    expect(await readdir(path.join(dir, "neuf"))).toEqual(["photo.jpg"]);
  });

  it("rend null pour un fichier absent, sans erreur", async () => {
    expect(await readUpload("absent.png")).toBeNull();
  });

  it("dit si un fichier existe", async () => {
    await saveUpload(PERSO(1), PNG, "image/png");
    expect(await uploadExists(PERSO(1))).toBe(true);
    expect(await uploadExists(PERSO(2))).toBe(false);
  });

  it("liste les fichiers d'un préfixe avec leur date d'envoi", async () => {
    const old = new Date("2026-11-01T08:00:00Z");
    await saveUpload(PERSO(1), PNG, "image/png");
    await utimes(path.join(dir, PERSO(1)), old, old);
    await saveUpload("3f0c7a52-1b2c-4d3e-8f90-a1b2c3d4e5f6.jpg", JPG, "image/jpeg");
    await writeFile(path.join(dir, ".gitkeep"), "");
    expect(await listUploads("perso-")).toEqual([{ name: PERSO(1), uploadedAt: old }]);
  });

  it("liste un dossier qui n'existe pas encore comme vide", async () => {
    vi.stubEnv("UPLOAD_DIR", path.relative(process.cwd(), path.join(dir, "absent")));
    expect(await listUploads("perso-")).toEqual([]);
  });

  it("supprime les fichiers demandés, ignore ceux qui n'existent plus, garde les autres", async () => {
    await saveUpload(PERSO(1), PNG, "image/png");
    await saveUpload(PERSO(2), PNG, "image/png");
    await deleteUploads([PERSO(1), PERSO(3)]);
    expect(await readdir(dir)).toEqual([PERSO(2)]);
  });
});

describe("sur Netlify : Netlify Blobs", () => {
  let store: ReturnType<typeof memoryStore>;
  const NOW = new Date("2026-11-18T09:30:00Z");

  beforeEach(() => {
    // SITE_ID : posé par Netlify dans toute fonction, à l'exécution. DEPLOY_CONTEXT : figée à la compilation
    // (next.config.ts, src/lib/deploy-context.ts) ; « production » sauf dans les tests qui disent le contraire.
    vi.stubEnv("SITE_ID", "1d01c0c0-4554-4747-93b8-34ce3448ab95");
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    store = memoryStore();
    getStore.mockReturnValue(store);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  it("enregistre dans le magasin « uploads », en cohérence forte, avec le type et la date d'envoi", async () => {
    await saveUpload("photo.png", PNG, "image/png");
    expect(getStore).toHaveBeenCalledWith({ name: "uploads", consistency: "strong", fetch: expect.any(Function) });
    const saved = store.blobs.get("photo.png");
    expect(new Uint8Array(saved!.data)).toEqual(PNG);
    expect(saved!.metadata).toEqual({ contentType: "image/png", uploadedAt: NOW.toISOString() });
    // Rien sur le disque des fonctions, qui ne dure pas.
    expect(await readdir(dir)).toEqual([]);
  });

  it("relit le fichier en binaire, avec le type enregistré", async () => {
    await saveUpload("photo.webp", JPG, "image/webp");
    expect(await readUpload("photo.webp")).toEqual({ bytes: JPG, contentType: "image/webp" });
    expect(await readUpload("absent.png")).toBeNull();
  });

  it("dit si un fichier existe, sans le télécharger", async () => {
    await saveUpload(PERSO(1), PNG, "image/png");
    const read = vi.spyOn(store, "getWithMetadata");
    expect(await uploadExists(PERSO(1))).toBe(true);
    expect(await uploadExists(PERSO(2))).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it("liste les fichiers d'un préfixe avec la date d'envoi lue dans leurs métadonnées", async () => {
    await saveUpload(PERSO(1), PNG, "image/png");
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
    await saveUpload(PERSO(2), PNG, "image/png");
    await saveUpload("3f0c7a52-1b2c-4d3e-8f90-a1b2c3d4e5f6.jpg", JPG, "image/jpeg");
    const list = vi.spyOn(store, "list");
    expect(await listUploads("perso-")).toEqual([
      { name: PERSO(1), uploadedAt: NOW },
      { name: PERSO(2), uploadedAt: new Date("2026-11-18T10:00:00Z") },
    ]);
    expect(list).toHaveBeenCalledWith({ prefix: "perso-" });
  });

  it("supprime les fichiers demandés et garde les autres", async () => {
    await saveUpload(PERSO(1), PNG, "image/png");
    await saveUpload(PERSO(2), PNG, "image/png");
    await deleteUploads([PERSO(1), PERSO(3)]);
    expect([...store.blobs.keys()]).toEqual([PERSO(2)]);
  });

  it("hors production (branche, aperçu, contexte inconnu) : tout passe par le magasin « uploads-preview »", async () => {
    for (const context of ["branch-deploy", "deploy-preview", "unknown"]) {
      vi.stubEnv("DEPLOY_CONTEXT", context);
      getStore.mockClear();
      await saveUpload("photo.png", PNG, "image/png");
      expect(await readUpload("photo.png")).not.toBeNull();
      expect(await uploadExists("photo.png")).toBe(true);
      await listUploads("perso-");
      await deleteUploads(["photo.png"]);
      expect(getStore.mock.calls.map(([options]) => options), context).toEqual(Array(5).fill({ name: "uploads-preview", consistency: "strong", fetch: expect.any(Function) }));
    }
  });

  it("valeur figée absente sur Netlify : « uploads-preview », jamais le magasin de la production", async () => {
    vi.stubEnv("DEPLOY_CONTEXT", undefined);
    await saveUpload("photo.png", PNG, "image/png");
    expect(getStore).toHaveBeenCalledWith({ name: "uploads-preview", consistency: "strong", fetch: expect.any(Function) });
  });

  it("le contexte de Netlify Blobs suffit à le choisir, même sans SITE_ID", async () => {
    vi.stubEnv("SITE_ID", undefined);
    vi.stubEnv("NETLIFY_BLOBS_CONTEXT", "eyJzaXRlSUQiOiJzaXRlIn0=");
    await saveUpload("photo.png", PNG, "image/png");
    expect(store.blobs.has("photo.png")).toBe(true);
    expect(await readdir(dir)).toEqual([]);
  });
});

describe("sur Netlify, magasin injoignable (point de vigilance 12)", () => {
  beforeEach(() => {
    vi.stubEnv("SITE_ID", "1d01c0c0-4554-4747-93b8-34ce3448ab95");
    vi.stubEnv("DEPLOY_CONTEXT", "production");
  });

  it("contexte absent : erreur qui nomme ce qui manque, et jamais d'écriture sur le disque", async () => {
    // Message réel de @netlify/blobs (MissingBlobsEnvironmentError) quand la fonction n'a pas reçu son contexte.
    getStore.mockImplementation(() => {
      throw Object.assign(new Error("The environment has not been configured to use Netlify Blobs. To use it manually, supply the following properties when creating a store: siteID, token"), { name: "MissingBlobsEnvironmentError" });
    });
    await expect(saveUpload("photo.png", PNG, "image/png")).rejects.toThrow(/Netlify Blobs.*NETLIFY_BLOBS_CONTEXT/);
    await expect(readUpload("photo.png")).rejects.toThrow(/Netlify Blobs/);
    await expect(uploadExists("photo.png")).rejects.toThrow(/Netlify Blobs/);
    expect(await readdir(dir)).toEqual([]);
  });

  it("magasin qui ne répond pas : erreur qui nomme le magasin, et jamais d'écriture sur le disque", async () => {
    const store = memoryStore();
    store.set = () => Promise.reject(new Error("fetch failed"));
    getStore.mockReturnValue(store);
    await expect(saveUpload("photo.png", PNG, "image/png")).rejects.toThrow(/Netlify Blobs.*« uploads ».*fetch failed/);
    expect(await readdir(dir)).toEqual([]);
  });
});
