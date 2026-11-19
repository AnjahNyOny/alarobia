import { readUpload } from "@/lib/storage";

/** Un an : le nom d'un envoi est généré une fois pour toutes, son contenu ne change jamais. */
const FOREVER = "public, max-age=31536000, immutable";

/**
 * Absent : 5 s sur le réseau de Netlify, pour qu'un robot qui redemande la même adresse ne relance pas la fonction à
 * chaque fois. Pas plus : une absence peut devenir une présence. Aujourd'hui aucune demande légitime ne précède
 * l'enregistrement (l'adresse n'est donnée au navigateur qu'une fois le fichier écrit, en cohérence forte :
 * `api/customizer/upload`, `api/admin/upload`), mais 5 s bornent le dommage si cela change. Le navigateur, lui, ne
 * garde rien et redemande toujours.
 */
const notFound = () =>
  new Response("Introuvable", {
    status: 404,
    headers: { "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "public, max-age=5", "X-Content-Type-Options": "nosniff" },
  });

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[\w-]+\.(jpg|png|webp|avif)$/.test(name)) return notFound();
  const file = await readUpload(name);
  if (!file) return notFound();
  return new Response(file.bytes, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": FOREVER,
      // Sur Netlify, le réseau garde la réponse : les demandes suivantes ne relancent ni la fonction ni la lecture du magasin.
      "Netlify-CDN-Cache-Control": FOREVER,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
