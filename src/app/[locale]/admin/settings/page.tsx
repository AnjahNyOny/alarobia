import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/small-forms";
import { Card, PageHeader } from "@/components/admin/ui";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Réglages" };

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Réglages" description="Identité de la boutique, devise et frais de livraison." />
      <Card>
        <SettingsForm settings={settings} />
      </Card>
    </>
  );
}
