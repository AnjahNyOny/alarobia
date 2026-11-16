import { readFile } from "node:fs/promises";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { downloadName, ITEM_FILES, itemFile } from "@/lib/order-files";
import { uploadPath } from "@/lib/upload-dir";

/**
 * Téléchargement, par le vendeur, d'un fichier d'un article personnalisé : `print` (fichier d'impression)
 * ou `image` (image d'origine envoyée par le client). Le fichier est celui que la base désigne pour cet
 * article de cette commande ; aucun chemin ne vient de la requête. Sans session administrateur, ou pour
 * tout ce qui n'existe pas, la réponse est la même : 404, sans redirection, pour ne rien révéler.
 */

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const notFound = () => new Response("Introuvable", { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_: Request, { params }: { params: Promise<{ id: string; itemId: string; file: string }> }) {
  const user = await getUser();
  if (user?.role !== "ADMIN") return notFound();

  const { id, itemId, file } = await params;
  const kind = ITEM_FILES.find((k) => k === file);
  if (!kind) return notFound();

  // Les articles dans l'ordre de la page de commande : le rang donné au fichier est celui que le vendeur voit.
  const order = await db.order.findUnique({ where: { id }, select: { number: true, items: { select: { id: true, printUrl: true, customization: true }, orderBy: { id: "asc" } } } });
  const position = order?.items.findIndex((item) => item.id === itemId) ?? -1;
  if (!order || position < 0) return notFound();

  const name = itemFile(order.items[position], kind);
  if (!name) return notFound();
  const extension = name.slice(name.lastIndexOf(".") + 1);

  let bytes: Buffer;
  try {
    bytes = await readFile(uploadPath(name));
  } catch {
    return notFound();
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": TYPES[extension] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${downloadName(order.number, position + 1, kind, extension)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
