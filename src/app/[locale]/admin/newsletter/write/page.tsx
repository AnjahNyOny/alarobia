import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { IssueForm } from "@/components/admin/newsletter";
import { Card, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.newsletter");
  return { title: t("writeTitle") };
}

/** Rédaction d'une lettre (PLAN.md 7.14) : objet et texte. L'aperçu, l'essai et l'envoi sont sur la page de la lettre enregistrée. */
export default async function WriteIssuePage() {
  await requireAdmin();
  const t = await getTranslations("admin.newsletter");
  return (
    <>
      <PageHeader title={t("writeTitle")} description={t("writeDescription")} back={{ href: "/admin/newsletter", label: t("title") }} />
      <Card className="max-w-3xl">
        <IssueForm />
      </Card>
    </>
  );
}
