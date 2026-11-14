import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import { getSettings } from "@/lib/settings";
import "../globals.css";

// Police variable : graisse et largeur (axe wdth), pour des titres étroits et un texte courant normal.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { storeName } = await getSettings();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: `${storeName} — Objets, mode et maison`, template: `%s — ${storeName}` },
    description: "Mobilier, mode, accessoires et objets du quotidien, choisis pour durer. Livraison soignée et retours sous 30 jours.",
    openGraph: { type: "website", locale: "fr_FR", siteName: storeName },
  };
}

export default async function RootLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} className={archivo.variable}>
      <body className="antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
