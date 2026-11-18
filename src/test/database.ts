import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createDb } from "@/lib/db";

/*
 * Bases des tests unitaires : un schéma PostgreSQL neuf dans la base de test, créé depuis prisma/schema.prisma
 * et supprimé à la fin. Chaque fichier de test a le sien : ils tournent en parallèle sans se voir, et ne touchent
 * ni à la base de développement ni au schéma `public` des tests navigateur.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://mac@localhost:5432/alarobia_test";

export const ROOT = path.resolve(import.meta.dirname, "../..");

/** Environnement d'une commande Prisma qui vise `url` (les deux variables du schéma). */
export const prismaEnv = (url: string) => ({ ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url });

/** Adresse d'un schéma qui n'existe pas encore, nommé `<prefix>_<aléatoire>`. */
export function scratchSchema(prefix: string): { schema: string; url: string } {
  if (!/^[a-z][a-z0-9_]*$/.test(prefix)) throw new Error(`Préfixe de schéma refusé : ${prefix}`);
  const schema = `${prefix}_${randomBytes(6).toString("hex")}`;
  const url = new URL(TEST_DATABASE_URL);
  url.searchParams.set("schema", schema);
  return { schema, url: url.href };
}

/** Supprime le schéma et tout ce qu'il contient. */
export async function dropSchema(schema: string) {
  const admin = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await admin.$disconnect();
  }
}

/** Schéma neuf, rempli par `prisma db push`, et un client qui s'y connecte. `drop()` le supprime. */
export function createTestDatabase(prefix: string) {
  const { schema, url } = scratchSchema(prefix);
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], { cwd: ROOT, env: prismaEnv(url), stdio: "pipe" });
  const db = createDb(url);
  return {
    db,
    schema,
    url,
    async drop() {
      await db.$disconnect();
      await dropSchema(schema);
    },
  };
}
