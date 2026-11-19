import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { BlobsServer } from "@netlify/blobs/server";
import { createDedupeFetch } from "next/dist/server/lib/dedupe-fetch";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteUploads, listUploads, readUpload, saveUpload, uploadExists } from "../storage";

/*
 * Netlify Blobs pour de vrai : le vrai client (`@netlify/blobs`, sans `vi.mock`) contre l'émulateur officiel de son
 * API (`@netlify/blobs/server`, celui de `netlify dev`), qui répond 404 pour une clé absente comme l'API en ligne.
 *
 * Dans une route Next.js, `globalThis.fetch` est celui de Next : `patchFetch` l'enveloppe dans `createDedupeFetch`
 * (next/dist/server/lib/patch-fetch.js), qui rend pour tout GET une copie dont le corps est une branche d'un `tee()`
 * (clone-response.js). Le client de Netlify Blobs prend `globalThis.fetch` à chaque `getStore`. Ce test installe donc le
 * vrai `createDedupeFetch` de Next, comme le fait le serveur, pour que le client voie les mêmes réponses qu'en ligne.
 *
 * Défaut reproduit (19/11/2026, en ligne : 502 au bout de 30 s pour `/uploads/<nom absent>`) : pour un 404, le client
 * jette le corps (`discardBody` : `res.body.cancel()`), et l'annulation d'une seule branche d'un `tee()` n'aboutit
 * qu'une fois l'autre branche annulée aussi, ce qu'elle n'est jamais : la lecture reste suspendue.
 */

const TOKEN = "jeton-de-test";
const SITE_ID = "1d01c0c0-4554-4747-93b8-34ce3448ab95";
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0xff, 0x00, 0x80]);
const PERSO = (n: number) => `perso-00000000-0000-4000-8000-${String(n).padStart(12, "0")}.png`;
/** Bien au-delà d'un aller-retour local (quelques ms), bien en deçà du délai de Vitest : une attente sans fin échoue ici. */
const PROMPT = 2_000;

/** La promesse, ou une erreur si elle n'a pas abouti à temps (au lieu d'un test qui attend sans fin). */
function prompt<T>(promise: Promise<T>, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} : pas de réponse après ${PROMPT} ms`)), PROMPT);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

/** Contexte que Netlify donne à ses fonctions : accès par le réseau de Netlify (`edgeURL`), lecture forte comprise. */
function blobsContext(url: string) {
  return Buffer.from(JSON.stringify({ siteID: SITE_ID, token: TOKEN, edgeURL: url, uncachedEdgeURL: url })).toString("base64");
}

const realFetch = globalThis.fetch;
let dir: string;
let emulator: BlobsServer;
let emulatorUrl: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "alarobia-blobs-"));
  emulator = new BlobsServer({ directory: dir, token: TOKEN });
  ({ address: emulatorUrl } = await emulator.start());
});

afterAll(async () => {
  await emulator.stop();
  await rm(dir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.stubEnv("SITE_ID", SITE_ID);
  vi.stubEnv("NETLIFY_BLOBS_CONTEXT", blobsContext(emulatorUrl));
  vi.stubEnv("DEPLOY_CONTEXT", "production");
  // Comme le serveur Next.js (patchFetch) : le `fetch` global déduplique les GET et rend des corps issus d'un `tee()`.
  globalThis.fetch = createDedupeFetch(realFetch);
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.unstubAllEnvs();
});

describe("Netlify Blobs, vrai client, fetch de Next.js", () => {
  it("relit un fichier enregistré, octet pour octet, avec son type", async () => {
    await prompt(saveUpload(PERSO(1), PNG, "image/png"), "enregistrement");
    expect(await prompt(readUpload(PERSO(1)), "lecture")).toEqual({ bytes: PNG, contentType: "image/png" });
  });

  it("fichier absent : null tout de suite, sans attendre", async () => {
    expect(await prompt(readUpload(PERSO(404)), "lecture d'un fichier absent")).toBeNull();
  });

  it("dit tout de suite si un fichier existe ou non", async () => {
    await prompt(saveUpload(PERSO(2), PNG, "image/png"), "enregistrement");
    expect(await prompt(uploadExists(PERSO(2)), "fichier présent")).toBe(true);
    expect(await prompt(uploadExists(PERSO(405)), "fichier absent")).toBe(false);
  });

  it("liste un préfixe sans fichier, et supprime des fichiers déjà absents, sans attendre", async () => {
    expect(await prompt(listUploads("aucun-"), "liste vide")).toEqual([]);
    await prompt(deleteUploads([PERSO(406), PERSO(407)]), "suppression de fichiers absents");
  });

  it("liste puis supprime des fichiers présents", async () => {
    await prompt(saveUpload(PERSO(3), PNG, "image/png"), "enregistrement");
    expect((await prompt(listUploads(PERSO(3)), "liste")).map(({ name }) => name)).toEqual([PERSO(3)]);
    await prompt(deleteUploads([PERSO(3)]), "suppression");
    expect(await prompt(readUpload(PERSO(3)), "relecture")).toBeNull();
  });
});

describe("Netlify Blobs en panne, vrai client, fetch de Next.js (point de vigilance 12)", () => {
  let broken: Server;

  beforeAll(async () => {
    // Le magasin répond 500 à tout : le client réessaie (5 fois, 1 ms d'écart quand NODE_ENV=test), puis abandonne.
    broken = createServer((_, res) => res.writeHead(500, { "content-type": "text/plain" }).end("panne"));
    await new Promise<void>((resolve) => broken.listen(0, "127.0.0.1", resolve));
  });

  afterAll(() => new Promise<void>((resolve) => broken.close(() => resolve())));

  beforeEach(() => {
    vi.stubEnv("NETLIFY_BLOBS_CONTEXT", blobsContext(`http://127.0.0.1:${(broken.address() as AddressInfo).port}`));
  });

  it("une lecture échoue vite, avec une erreur qui nomme le magasin", async () => {
    await expect(prompt(readUpload(PERSO(1)), "lecture, magasin en panne")).rejects.toThrow(/Netlify Blobs injoignable \(magasin « uploads »/);
  });

  it("vérification, liste et suppression échouent vite aussi, avec la même erreur", async () => {
    await expect(prompt(uploadExists(PERSO(1)), "vérification, magasin en panne")).rejects.toThrow(/Netlify Blobs injoignable/);
    await expect(prompt(listUploads("perso-"), "liste, magasin en panne")).rejects.toThrow(/Netlify Blobs injoignable/);
    await expect(prompt(deleteUploads([PERSO(1)]), "suppression, magasin en panne")).rejects.toThrow(/Netlify Blobs injoignable/);
  });
});
