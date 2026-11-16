import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { storeMessages } from "@/i18n/messages";
import { isLocale } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import { getSettings } from "@/lib/settings";
import "../globals.css";

// Police variable : graisse et largeur (axe wdth), pour des titres étroits et un texte courant normal.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"], display: "swap" });

const OG_LOCALE: Record<string, string> = { fr: "fr_FR", en: "en_US", mg: "mg_MG" };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [{ storeName }, t] = await Promise.all([getSettings(), getTranslations({ locale })]);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: `${storeName} — ${t("meta.title")}`, template: `%s — ${storeName}` },
    description: t("home.lead"),
    openGraph: { type: "website", locale: OG_LOCALE[locale], siteName: storeName },
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
