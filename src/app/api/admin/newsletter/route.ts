import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { newsletterCsv, newsletterCsvName } from "@/lib/newsletter-csv";

/**
 * Export CSV des inscrits à la lettre d'information, pour le vendeur (lien « Télécharger (CSV) » de /admin/newsletter).
 * Hors des pages traduites, donc hors du proxy : la session est vérifiée ici. Sans session administrateur, 404 sans
 * redirection, comme les fichiers de commande, pour ne rien révéler.
 */

const NO_STORE = "private, no-store";

export async function GET() {
  const user = await getUser();
  if (user?.role !== "ADMIN") return new Response("Introuvable", { status: 404, headers: { "Cache-Control": NO_STORE } });

  const subscribers = await db.newsletterSubscriber.findMany({ orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { email: true, createdAt: true } });
  return new Response(newsletterCsv(subscribers), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${newsletterCsvName(new Date())}"`,
      "Cache-Control": NO_STORE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
