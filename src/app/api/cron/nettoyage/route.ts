import { NextResponse } from "next/server";
import { cleanupCustomizations } from "@/lib/cleanup";
import { NO_STORE, refuseCron } from "@/lib/cron-auth";

/**
 * Nettoyage quotidien des personnalisations jamais commandées (`src/lib/cleanup.ts`). Appelé chaque jour par GitHub
 * Actions (`.github/workflows/nettoyage.yml`) avec `Authorization: Bearer <CRON_SECRET>`. `?dry-run=1` : essai à blanc,
 * qui dit ce qui partirait sans rien supprimer.
 *
 * Sans `CRON_SECRET`, la route refuse tout (503) et le dit (`src/lib/cron-auth.ts`) : un nettoyage qui ne tourne pas
 * doit se voir dans le flux de travail (point de vigilance 12), pas passer pour une simple erreur d'accès.
 */
export async function GET(req: Request) {
  const refused = refuseCron(req, "nettoyage");
  if (refused) return refused;

  const dryRun = new URL(req.url).searchParams.get("dry-run") === "1";
  const result = await cleanupCustomizations({ dryRun, now: new Date() });
  return NextResponse.json({ dryRun, ...result }, { headers: NO_STORE });
}
