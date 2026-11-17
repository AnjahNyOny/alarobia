import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { storeMessages } from "@/i18n/messages";
import { isLocale } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import { openGraphBase, siteBase } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import "../globals.css";

// Police variable : graisse et largeur (axe wdth), pour des titres étroits et un texte courant normal.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"], display: "swap" });

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [{ storeName }, t] = await Promise.all([getSettings(), getTranslations({ locale })]);
  return {
    metadataBase: new URL(siteBase()),
    title: { default: `${storeName} — ${t("meta.title")}`, template: `%s — ${storeName}` },
    description: t("home.lead"),
    // Pas d'`alternates` ici : la page 404 et les pages privées en hériteraient. Chaque page indexable déclare les siens.
    // L'image de partage vient de ./opengraph-image.tsx ; X reprend celle de l'Open Graph.
    openGraph: openGraphBase(locale, storeName),
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  // Les textes du back-office restent sur le serveur : le layout de /admin les transmet lui-même.
  const [messages, t] = await Promise.all([getMessages().then(storeMessages), getTranslations("common")]);
  return (
    <html lang={locale} className={archivo.variable}>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        {/* Hors du fournisseur de messages : l'étiquette de la zone des notifications arrive traduite. */}
        <Toaster containerAriaLabel={t("notifications")} />
      </body>
    </html>
  );
}
