import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Contrôle du secret partagé des routes `/api/cron/…`, appelées avec `Authorization: Bearer <CRON_SECRET>` (nettoyage
 * quotidien par GitHub Actions, diagnostic de l'adresse du client).
 *
 * Sans `CRON_SECRET`, la route refuse tout (503) et le dit, avant même de regarder le secret reçu : un nettoyage qui ne
 * tourne pas doit se voir dans le flux de travail (point de vigilance 12), pas passer pour une simple erreur d'accès.
 */

/** Réponses jamais gardées en cache, ni par le navigateur ni par le réseau de l'hébergeur. */
export const NO_STORE = { "Cache-Control": "private, no-store" };

/** Comparaison en temps constant : la durée de la réponse ne dit rien du secret. Les empreintes ont toujours la même longueur. */
const digest = (value: string) => createHash("sha256").update(value).digest();
const sameSecret = (given: string | null, expected: string) => timingSafeEqual(digest(given ?? ""), digest(expected));

/**
 * La réponse de refus (503 sans `CRON_SECRET`, 401 avec un secret absent ou faux), ou `null` si la requête porte le bon
 * secret. `operation` nomme ce qui ne peut pas se faire dans le message du 503 (« nettoyage »).
 */
export function refuseCron(req: Request, operation: string): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: `CRON_SECRET n'est pas défini sur le serveur : ${operation} impossible.` }, { status: 503, headers: NO_STORE });
  if (!sameSecret(req.headers.get("authorization"), `Bearer ${secret}`)) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers: NO_STORE });
  return null;
}
