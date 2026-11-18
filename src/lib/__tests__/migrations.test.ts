import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { dropSchema, prismaEnv, ROOT, scratchSchema } from "@/test/database";

/*
 * La production applique prisma/migrations (`prisma migrate deploy`), le développement et les tests appliquent
 * le schéma directement (`prisma db push`). Ce test garde les deux d'accord : un champ ajouté au schéma sans sa
 * migration passerait partout en local et manquerait en production.
 * Prisma rejoue les migrations dans une base fantôme : un schéma temporaire de la base de test.
 */
const shadow = scratchSchema("shadow");

afterAll(() => dropSchema(shadow.schema));

describe("migrations", () => {
  it("décrivent exactement prisma/schema.prisma", () => {
    const diff = spawnSync(
      "npx",
      ["prisma", "migrate", "diff", "--from-migrations", "prisma/migrations", "--to-schema-datamodel", "prisma/schema.prisma", "--shadow-database-url", shadow.url, "--exit-code"],
      // Prisma range le modèle dans le schéma nommé par DATABASE_URL : il doit être celui où les migrations sont rejouées,
      // sinon toutes les tables paraissent ajoutées d'un côté et retirées de l'autre.
      { cwd: ROOT, env: prismaEnv(shadow.url), encoding: "utf8" },
    );
    // 0 : rien à migrer ; 2 : le schéma a changé sans migration (le détail est dans la sortie) ; 1 : erreur.
    expect(diff.status, `${diff.stdout}${diff.stderr}\nLe SQL manquant : la même commande avec --script, à écrire dans prisma/migrations/<date>_<nom>/migration.sql`).toBe(0);
  }, 60_000);
});
