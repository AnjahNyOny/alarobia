import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanupCustomizations } from "@/lib/cleanup";

/**
 * Nettoyage quotidien des personnalisations jamais commandées (`src/lib/cleanup.ts`). Appelé chaque jour par GitHub
 * Actions (`.github/workflows/nettoyage.yml`) avec `Authorization: Bearer <CRON_SECRET>`. `?dry-run=1` : essai à blanc,
 * qui dit ce qui partirait sans rien supprimer.
 *
 * Sans `CRON_SECRET`, la route refuse tout (503) et le dit : un nettoyage qui ne tourne pas doit se voir dans le flux
 * de travail (point de vigilance 12), pas passer pour une simple erreur d'accès.
 */

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Comparaison en temps constant : la durée de la réponse ne dit rien du secret. Les empreintes ont toujours la même longueur. */
const digest = (value: string) => createHash("sha256").update(value).digest();
const sameSecret = (given: string | null, expected: string) => timingSafeEqual(digest(given ?? ""), digest(expected));

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET n'est pas défini sur le serveur : nettoyage impossible." }, { status: 503, headers: NO_STORE });
  if (!sameSecret(req.headers.get("authorization"), `Bearer ${secret}`)) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers: NO_STORE });

  const dryRun = new URL(req.url).searchParams.get("dry-run") === "1";
  const result = await cleanupCustomizations({ dryRun, now: new Date() });
  return NextResponse.json({ dryRun, ...result }, { headers: NO_STORE });
}
