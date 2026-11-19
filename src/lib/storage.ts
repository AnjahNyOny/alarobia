import "server-only";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { getStore, type Store } from "@netlify/blobs";
import { IMAGE_MIME } from "./upload";
import { uploadDir, uploadPath } from "./upload-dir";

/**
 * Fichiers envoyés : photos de produits, images des clients, aperçus et fichiers d'impression des personnalisations.
 * Seul ce module y touche.
 *
 * Sur Netlify, ils vont dans Netlify Blobs (magasin « uploads ») : les fonctions n'ont pas de disque durable, un fichier
 * écrit sur le leur disparaîtrait sans bruit. Partout ailleurs (développement, tests), sur le disque, dans le dossier des
 * envois (`upload-dir.ts`). Sur Netlify, jamais de repli sur le disque : si le magasin ne répond pas, l'erreur le dit et
 * nomme ce qui manque (point de vigilance 12).
 *
 * Les noms sont toujours générés ou vérifiés par l'appelant, jamais fournis tels quels par un visiteur.
 */

/**
 * Le code tourne-t-il sur Netlify ? Deux signes, l'un ou l'autre suffit :
 * - `SITE_ID`, que Netlify pose dans toute fonction à l'exécution (avec `URL` et `SITE_NAME`, les trois seules variables
 *   garanties : https://docs.netlify.com/build/functions/environment-variables/). Il reste là même si le contexte de
 *   Netlify Blobs manque, ce qui permet d'échouer au lieu d'écrire sur le disque. `NETLIFY`, lui, n'est garanti qu'à la
 *   compilation (https://docs.netlify.com/build/configure-builds/environment-variables/).
 * - le contexte de Netlify Blobs lui-même : `NETLIFY_BLOBS_CONTEXT` ou `globalThis.netlifyBlobsContext`, que Netlify
 *   remplit dans ses fonctions et que `getStore` lit (README de @netlify/blobs, « Environment-based configuration » ;
 *   `getEnvironmentContext` dans son code).
 */
function onNetlify() {
  return Boolean(process.env.SITE_ID || process.env.NETLIFY_BLOBS_CONTEXT || globalThis.netlifyBlobsContext);
}

// ── Netlify Blobs ─────────────────────────────────────────────────────────────────────────────────────────────────

const STORE = "uploads";
/** Requêtes envoyées en même temps au magasin, pour lister les dates ou supprimer en nombre. */
const BATCH = 20;

/** Ce que Netlify Blobs garde avec chaque fichier. Les métadonnées voyagent en JSON : la date est un texte ISO. */
type Metadata = { contentType: string; uploadedAt: string };

function unavailable(operation: string, error: unknown) {
  const reason = error instanceof Error ? error.message : String(error);
  // `MissingBlobsEnvironmentError` : la fonction n'a pas reçu le contexte que Netlify lui fournit d'habitude.
  const missing = error instanceof Error && error.name === "MissingBlobsEnvironmentError" ? " Il manque le contexte de Netlify Blobs (NETLIFY_BLOBS_CONTEXT), que Netlify fournit à ses fonctions." : "";
  return new Error(`Netlify Blobs injoignable (magasin « ${STORE} », ${operation}) : ${reason}.${missing} Rien n'a été écrit sur le disque de la fonction, qui ne dure pas.`, { cause: error });
}

/** Ouvre le magasin et y fait `run` ; toute panne devient une erreur qui dit laquelle. */
async function inStore<T>(operation: string, run: (store: Store) => Promise<T>): Promise<T> {
  try {
    return await run(getStore({ name: STORE, consistency: "strong" }));
  } catch (error) {
    throw unavailable(operation, error);
  }
}

/** `run` sur chaque élément, `BATCH` à la fois. */
async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += BATCH) results.push(...(await Promise.all(items.slice(i, i + BATCH).map(run))));
  return results;
}

const blobs = {
  save: (name: string, bytes: Uint8Array, contentType: string) =>
    inStore(`enregistrement de ${name}`, async (store) => {
      const metadata: Metadata = { contentType, uploadedAt: new Date().toISOString() };
      await store.set(name, bytes.slice().buffer, { metadata });
    }),

  read: (name: string) =>
    inStore(`lecture de ${name}`, async (store) => {
      const entry = await store.getWithMetadata(name, { type: "arrayBuffer" });
      if (!entry) return null;
      const { contentType } = entry.metadata;
      return { bytes: new Uint8Array(entry.data), contentType: typeof contentType === "string" ? contentType : typeOf(name) };
    }),

  // Les métadonnées seules : rien n'est téléchargé.
  exists: (name: string) => inStore(`vérification de ${name}`, async (store) => (await store.getMetadata(name)) !== null),

  list: (prefix: string) =>
    inStore(`liste « ${prefix} »`, async (store) => {
      const { blobs: found } = await store.list({ prefix });
      const dated = await inBatches(found, async ({ key }) => ({ name: key, uploadedAt: new Date(String((await store.getMetadata(key))?.metadata.uploadedAt)) }));
      // Un fichier supprimé entre-temps, ou sans date lisible, n'est pas listé : le nettoyage ne le touchera pas.
      return dated.filter((file) => !Number.isNaN(file.uploadedAt.getTime()));
    }),

  delete: (names: string[]) =>
    inStore(`suppression de ${names.length} fichier(s)`, async (store) => {
      await inBatches(names, (name) => store.delete(name));
    }),
};

// ── Disque ──────────────────────────────────────────────────────────────────────────────────────────────────────

const typeOf = (name: string) => (IMAGE_MIME as Record<string, string | undefined>)[name.slice(name.lastIndexOf(".") + 1)] ?? "application/octet-stream";
const absent = (error: unknown) => ["ENOENT", "ENOTDIR", "EISDIR"].includes((error as NodeJS.ErrnoException)?.code ?? "");

const disk = {
  // Le type n'est pas enregistré : l'extension, donnée par le serveur d'après le contenu, le dit déjà.
  async save(name: string, bytes: Uint8Array) {
    await mkdir(uploadDir(), { recursive: true });
    await writeFile(uploadPath(name), bytes);
  },

  async read(name: string) {
    try {
      const file = await readFile(uploadPath(name));
      return { bytes: new Uint8Array(file.buffer, file.byteOffset, file.byteLength), contentType: typeOf(name) };
    } catch (error) {
      if (absent(error)) return null;
      throw error;
    }
  },

  async exists(name: string) {
    try {
      return (await stat(uploadPath(name))).isFile();
    } catch (error) {
      if (absent(error)) return false;
      throw error;
    }
  },

  async list(prefix: string) {
    let names: string[];
    try {
      names = await readdir(uploadDir());
    } catch (error) {
      if (absent(error)) return [];
      throw error;
    }
    const files = await Promise.all(
      names.filter((name) => name.startsWith(prefix) && !name.startsWith(".")).map(async (name) => ({ name, info: await stat(uploadPath(name)) })),
    );
    return files.filter(({ info }) => info.isFile()).map(({ name, info }) => ({ name, uploadedAt: info.mtime }));
  },

  async delete(names: string[]) {
    for (const name of names) {
      try {
        await unlink(uploadPath(name));
      } catch (error) {
        if (!absent(error)) throw error;
      }
    }
  },
};

// ── Interface ───────────────────────────────────────────────────────────────────────────────────────────────────

export async function saveUpload(name: string, bytes: Uint8Array, contentType: string): Promise<void> {
  return onNetlify() ? blobs.save(name, bytes, contentType) : disk.save(name, bytes);
}

/** Le fichier et son type, ou `null` s'il n'existe pas. */
export async function readUpload(name: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string } | null> {
  return onNetlify() ? blobs.read(name) : disk.read(name);
}

export async function uploadExists(name: string): Promise<boolean> {
  return onNetlify() ? blobs.exists(name) : disk.exists(name);
}

/** Fichiers dont le nom commence par `prefix`, avec leur date d'envoi (date de modification sur le disque). */
export async function listUploads(prefix: string): Promise<{ name: string; uploadedAt: Date }[]> {
  return onNetlify() ? blobs.list(prefix) : disk.list(prefix);
}

/** Supprime ces fichiers ; ceux qui n'existent déjà plus sont ignorés. */
export async function deleteUploads(names: string[]): Promise<void> {
  return onNetlify() ? blobs.delete(names) : disk.delete(names);
}
