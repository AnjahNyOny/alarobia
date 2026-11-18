import type { Metadata } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { clientMessages } from "@/i18n/messages";
import { isLocale } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import { openGraphBase, siteBase } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import "../globals.css";

// Police variable : graisse et largeur (axe wdth), pour des titres étroits et un texte courant normal.
// Archivo de Google Fonts (sous-ensemble latin), réduite aux graisses 400 à 800 et aux largeurs 68 à 100 % que le site
// emploie : 57 ko au lieu de 88 (`scripts/police-archivo.py`, qui dit comment la refaire). Mêmes caractères que la
// version servie par next/font/google.
const archivo = localFont({
  src: "../fonts/archivo-latin.woff2",
  variable: "--font-archivo",
  weight: "400 800",
  style: "normal",
  display: "swap",
  // Police de remplacement pendant le chargement : Arial aux proportions d'Archivo, avec les valeurs exactes que
  // next/font/google employait (globals.css), pour que la page s'affiche et se décale comme avant ; puis Roboto aux
  // mêmes proportions pour Android, qui n'a pas Arial.
  adjustFontFallback: false,
  fallback: ["Archivo Fallback", "Archivo Fallback Roboto"],
  declarations: [
    { prop: "font-stretch", value: "68% 100%" },
    { prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
  ],
});

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
  // Seuls les textes lus par les composants client partent vers le navigateur (CLIENT_NAMESPACES) ; ceux du
  // back-office restent sur le serveur, le layout de /admin les transmet lui-même.
  const [messages, t] = await Promise.all([getMessages().then((all) => clientMessages(all)), getTranslations("common")]);
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
