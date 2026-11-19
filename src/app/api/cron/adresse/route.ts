import { NextResponse } from "next/server";
import { NO_STORE, refuseCron } from "@/lib/cron-auth";
import { clientIp } from "@/lib/rate-limit";

/**
 * Diagnostic de l'adresse du client, pour le contrôle en ligne (PLAN.md 7.5, étape 7 ; `e2e/production.spec.ts`) :
 * vérifier sur Netlify qu'un client ne peut pas imposer `x-nf-client-connection-ip`, l'en-tête que les limites de débit
 * lisent d'abord (`clientIp`, `src/lib/rate-limit.ts`). Le test l'appelle avec de fausses adresses dans ses en-têtes et
 * regarde laquelle le serveur retient.
 *
 * Protégée comme le nettoyage (`Authorization: Bearer <CRON_SECRET>`, `src/lib/cron-auth.ts`). Elle ne renvoie que ce que
 * le serveur a reçu pour la requête de l'appelant lui-même : l'adresse retenue et les trois en-têtes bruts, aucun autre
 * en-tête, aucune variable d'environnement. Elle peut être retirée une fois le contrôle fait.
 */
export async function GET(req: Request) {
  const refused = refuseCron(req, "diagnostic");
  if (refused) return refused;
  const { headers } = req;
  return NextResponse.json(
    {
      clientIp: clientIp(headers),
      nfClientConnectionIp: headers.get("x-nf-client-connection-ip"),
      forwardedFor: headers.get("x-forwarded-for"),
      realIp: headers.get("x-real-ip"),
    },
    { headers: NO_STORE },
  );
}
