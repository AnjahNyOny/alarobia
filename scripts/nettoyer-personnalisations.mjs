// Supprime les personnalisations jamais commandées après sept jours, et leurs fichiers.
//
//   node scripts/nettoyer-personnalisations.mjs --dry-run   # montre ce qui serait supprimé
//   node scripts/nettoyer-personnalisations.mjs             # supprime
//
// À lancer régulièrement (une fois par jour suffit). Ne touche qu'aux fichiers « perso-… » du
// dossier des envois : jamais aux photos de produits, jamais à ce qu'une commande référence.
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DAY = 864e5;
export const MAX_AGE_DAYS = 7;
const CUSTOM_FILE = /^perso-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/**
 * Fichiers à supprimer : fichiers de personnalisation de plus de sept jours que plus rien ne référence.
 * @param {{ name: string, mtimeMs: number }[]} files contenu du dossier des envois
 * @param {Set<string>} referenced noms encore utilisés par une personnalisation ou une commande
 * @param {number} now
 */
export function staleFiles(files, referenced, now) {
  return files.filter((f) => CUSTOM_FILE.test(f.name) && now - f.mtimeMs > MAX_AGE_DAYS * DAY && !referenced.has(f.name)).map((f) => f.name);
}

const baseName = (url) => (typeof url === "string" ? url.split("/").pop() : null);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const dir = path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
  const now = Date.now();
  try {
    const where = { orderedAt: null, createdAt: { lt: new Date(now - MAX_AGE_DAYS * DAY) } };
    const abandoned = await db.customization.count({ where });
    if (!dryRun) await db.customization.deleteMany({ where });

    // Tout ce qui reste utile : personnalisations récentes ou commandées, et copies figées dans les commandes.
    const kept = await db.customization.findMany({ where: dryRun ? { NOT: where } : {}, select: { image: true, preview: true, print: true } });
    const items = await db.orderItem.findMany({ where: { customization: { not: null } }, select: { imageUrl: true, printUrl: true, customization: true } });
    const referenced = new Set();
    for (const c of kept) for (const name of [c.image, c.preview, c.print]) if (name) referenced.add(name);
    for (const item of items) {
      for (const url of [item.imageUrl, item.printUrl]) if (baseName(url)) referenced.add(baseName(url));
      try {
        const image = JSON.parse(item.customization).image;
        if (typeof image === "string") referenced.add(image);
      } catch {
        // copie illisible : rien à protéger de plus
      }
    }

    const names = await readdir(dir).catch(() => []);
    const files = await Promise.all(names.map(async (name) => ({ name, mtimeMs: (await stat(path.join(dir, name))).mtimeMs })));
    const stale = staleFiles(files, referenced, now);
    if (!dryRun) for (const name of stale) await unlink(path.join(dir, name));

    console.log(`${dryRun ? "À supprimer" : "Supprimé"} : ${abandoned} personnalisation(s) jamais commandée(s) depuis plus de ${MAX_AGE_DAYS} jours, ${stale.length} fichier(s).`);
    if (dryRun) for (const name of stale) console.log(`  ${name}`);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
