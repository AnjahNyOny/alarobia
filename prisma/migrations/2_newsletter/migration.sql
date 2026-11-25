-- Lettre d'information : double confirmation et désinscription par jeton (PLAN.md 7.13).
-- Généré par `prisma migrate diff`, puis complété à la main : le jeton ne peut pas être ajouté NOT NULL d'un coup sur
-- une table déjà remplie. Il est d'abord ajouté vide, rempli, puis rendu obligatoire.

-- AlterTable
ALTER TABLE "NewsletterSubscriber" ADD COLUMN     "confirmSentAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "token" TEXT;

-- Jeton des inscrits existants : 64 caractères hexadécimaux, comme randomBytes(32).toString("hex") (src/lib/newsletter.ts).
-- gen_random_uuid() est intégré à PostgreSQL depuis la version 13 : aucune extension à installer.
UPDATE "NewsletterSubscriber"
SET "token" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE "token" IS NULL;

-- Les inscrits d'avant la confirmation par e-mail sont les essais du propriétaire : considérés comme confirmés.
UPDATE "NewsletterSubscriber" SET "confirmedAt" = "createdAt" WHERE "confirmedAt" IS NULL;

ALTER TABLE "NewsletterSubscriber" ALTER COLUMN "token" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_token_key" ON "NewsletterSubscriber"("token");
