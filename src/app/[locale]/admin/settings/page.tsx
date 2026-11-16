import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsForm } from "@/components/admin/small-forms";
import { Card, PageHeader } from "@/components/admin/ui";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings");
  return { title: t("metaTitle") };
}

export default async function SettingsPage() {
  const [settings, t] = await Promise.all([getSettings(), getTranslations("admin.settings")]);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <SettingsForm settings={settings} />
      </Card>
    </>
  );
}
