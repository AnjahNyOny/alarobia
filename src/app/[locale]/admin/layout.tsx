import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AdminSidebar } from "@/components/admin/sidebar";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: { default: t("label"), template: `%s — ${t("label")}` }, robots: { index: false, follow: false } };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [settings, toProcess, t] = await Promise.all([getSettings(), db.order.count({ where: { status: { in: ["PENDING", "PAID"] } } }), getTranslations("nav")]);
  return (
    // Seul endroit où les textes `admin` partent vers le navigateur : le layout racine les retire,
    // ce fournisseur-ci transmet tous les messages de la langue.
    <NextIntlClientProvider>
      <div className="min-h-dvh bg-background">
        {/* Même lien d'évitement que la boutique (en-tête de la boutique) : premier arrêt de tabulation, saute la barre latérale. */}
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
          {t("skip")}
        </a>
        <AdminSidebar toProcess={toProcess} storeName={settings.storeName} userName={user.name} />
        <main id="contenu" tabIndex={-1} className="outline-none lg:pl-60">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
