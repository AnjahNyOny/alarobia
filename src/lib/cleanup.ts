import "server-only";
import { CUSTOM_FILE } from "./customization";
import { db } from "./db";
import { deleteUploads, listUploads } from "./storage";

/**
 * Nettoyage des personnalisations jamais commandées : la ligne en base et ses fichiers partent après sept jours.
 * Lancé chaque jour par `GET /api/cron/nettoyage` (flux de travail GitHub `.github/workflows/nettoyage.yml`).
 * Ne touche qu'aux fichiers « perso-… » : jamais aux photos de produits, jamais à ce qu'une commande référence.
 * Le point d'envoi des visiteurs est public : sans ce nettoyage, le stockage se remplit.
 */

const DAY = 864e5;
export const MAX_AGE_DAYS = 7;

/** Fichiers à supprimer : fichiers de personnalisation de plus de sept jours que plus rien ne référence. */
export function staleFiles(files: { name: string; uploadedAt: Date }[], referenced: Set<string>, now: Date): string[] {
  const limit = now.getTime() - MAX_AGE_DAYS * DAY;
  return files.filter((f) => CUSTOM_FILE.test(f.name) && f.uploadedAt.getTime() < limit && !referenced.has(f.name)).map((f) => f.name);
}

const baseName = (url: string | null) => url?.split("/").pop() || null;

/**
 * Supprime (ou, à blanc, compte) les personnalisations jamais commandées depuis plus de sept jours, puis les fichiers de
 * personnalisation que plus rien ne référence. Rend le nombre de personnalisations et les noms des fichiers concernés.
 */
export async function cleanupCustomizations({ dryRun, now }: { dryRun: boolean; now: Date }): Promise<{ abandoned: number; files: string[] }> {
  const where = { orderedAt: null, createdAt: { lt: new Date(now.getTime() - MAX_AGE_DAYS * DAY) } };
  const abandoned = dryRun ? await db.customization.count({ where }) : (await db.customization.deleteMany({ where })).count;

  // Tout ce qui reste utile : personnalisations récentes ou commandées, et copies figées dans les commandes.
  const kept = await db.customization.findMany({ where: dryRun ? { NOT: where } : {}, select: { image: true, preview: true, print: true } });
  const items = await db.orderItem.findMany({ where: { customization: { not: null } }, select: { imageUrl: true, printUrl: true, customization: true } });
  const referenced = new Set<string>();
  for (const c of kept) for (const file of [c.image, c.preview, c.print]) if (file) referenced.add(file);
  for (const item of items) {
    for (const url of [item.imageUrl, item.printUrl]) {
      const file = baseName(url);
      if (file) referenced.add(file);
    }
    try {
      const { image } = JSON.parse(item.customization ?? "{}");
      if (typeof image === "string") referenced.add(image);
    } catch {
      // copie illisible : rien à protéger de plus
    }
  }

  const files = staleFiles(await listUploads("perso-"), referenced, now);
  if (!dryRun) await deleteUploads(files);
  return { abandoned, files };
}
