import { db } from "@/lib/db";
import { unsubscribe } from "@/lib/newsletter";

/**
 * Désinscription en un clic depuis la messagerie (RFC 8058) : chaque lettre (PLAN.md 7.14) portera les en-têtes
 * `List-Unsubscribe: <…/api/newsletter/unsubscribe?token=…>` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
 * et Gmail enverra ici un POST quand la personne clique sur « Se désabonner ».
 *
 * Seul POST est servi : un GET (aperçu, antivirus qui suit les liens) reçoit 405 de Next et ne retire rien. Réponse 200
 * dans tous les cas, jeton connu ou non : rien ne révèle qui était inscrit, et une messagerie qui renvoie la requête ne
 * voit pas d'erreur. Hors des pages traduites, donc hors du proxy : aucune session n'est demandée, le jeton suffit.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  await unsubscribe(db, token);
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
