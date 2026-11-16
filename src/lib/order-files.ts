/**
 * Fichiers d'un article personnalisé, téléchargés par le vendeur depuis le back-office
 * (`src/app/api/admin/orders/[id]/items/[itemId]/[file]/route.ts`). Fonctions pures : le nom
 * du fichier vient toujours de la base, contrôlé ici ; rien de la requête n'atteint le disque.
 */

import { CUSTOM_FILE, readOrderDesign } from "./customization";

export const ITEM_FILES = ["print", "image"] as const;
export type ItemFile = (typeof ITEM_FILES)[number];

/** Nom du fichier à servir pour cet article, ou null s'il n'en a pas (couleur seule, article ordinaire) ou si la base contient autre chose qu'un nom généré. */
export function itemFile(item: { printUrl: string | null; customization: string | null }, kind: ItemFile): string | null {
  const name = kind === "print" ? item.printUrl?.match(/^\/uploads\/([^/]+)$/)?.[1] : readOrderDesign(item.customization)?.design.image;
  return name && CUSTOM_FILE.test(name) ? name : null;
}

const SUFFIX: Record<ItemFile, string> = { print: "impression", image: "image" };

/**
 * Nom proposé au téléchargement : « AL-2611-0042-1-impression.png ». Seuls lettres, chiffres, tirets
 * et le point de l'extension y figurent : il part tel quel dans l'en-tête Content-Disposition.
 */
export function downloadName(orderNumber: string, position: number, kind: ItemFile, extension: string) {
  const number =
    orderNumber
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "commande";
  const rank = Math.max(1, Math.trunc(position) || 1);
  const ext = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${number}-${rank}-${SUFFIX[kind]}.${ext}`;
}
