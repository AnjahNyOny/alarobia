import { readUpload } from "@/lib/storage";

/** Un an : le nom d'un envoi est généré une fois pour toutes, son contenu ne change jamais. */
const FOREVER = "public, max-age=31536000, immutable";

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[\w-]+\.(jpg|png|webp|avif)$/.test(name)) return new Response("Introuvable", { status: 404 });
  const file = await readUpload(name);
  if (!file) return new Response("Introuvable", { status: 404 });
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
