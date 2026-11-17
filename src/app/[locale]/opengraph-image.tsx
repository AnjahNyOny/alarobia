import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { defaultLocale, isLocale } from "@/i18n/routing";
import { getSettings } from "@/lib/settings";

/**
 * Image de partage (Facebook, WhatsApp, X) des pages qui n'ont pas de photo propre.
 * La fiche produit la remplace par sa première photo.
 *
 * Polices : Archivo (SIL Open Font License 1.1, assets/fonts/OFL.txt), versionnée dans le dépôt pour que l'image
 * ne dépende pas d'internet. satori ne lit ni le woff2 ni les polices variables : deux instances fixes ont été
 * tirées de « Archivo[wdth,wght].ttf » (google/fonts) avec fontTools, réduites aux alphabets latins
 * (U+0020-017F et ponctuation) : 800 en largeur 68 comme la classe `display` du site, 500 en largeur normale.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Le nom de la boutique se règle dans le back-office : l'image le relit à chaque demande.
export const dynamic = "force-dynamic";

const INK = "#1f2547";
const BRAND = "#b4401f";

const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Archivo-ExtraBold-Narrow.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Archivo-Medium.ttf")),
]);

async function texts(raw: string) {
  const locale = isLocale(raw) ? raw : defaultLocale;
  const [{ storeName }, t] = await Promise.all([getSettings(), getTranslations({ locale, namespace: "meta" })]);
  return { storeName, tagline: t("title") };
}

export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  const { storeName, tagline } = await texts(params.locale);
  return [{ id: "partage", size, contentType, alt: `${storeName} — ${tagline}` }];
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, [display, text]] = await Promise.all([params, fonts]);
  const { storeName, tagline } = await texts(locale);
  // Un nom plus long que « alarobia » rétrécit pour tenir dans sa colonne.
  const nameSize = Math.max(76, Math.min(176, Math.floor(1400 / Math.max(storeName.length, 8))));

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", color: INK, position: "relative" }}>
        {/* L'étiquette de prix du logo, en grand, qui entre dans le cadre par la droite. */}
        <svg width="650" height="400" viewBox="0 0 52 32" style={{ position: "absolute", right: -64, top: 115 }}>
          <path d="M12.5 1h35A3.5 3.5 0 0 1 51 4.500v23a3.500 3.500 0 0 1-3.500 3.500h-35a3.500 3.500 0 0 1-2.600-1.160L1.400 18.340a3.500 3.500 0 0 1 0-4.680L9.900 2.160A3.500 3.500 0 0 1 12.500 1Z" fill={BRAND} />
          <circle cx="10.200" cy="16" r="2.700" fill="#ffffff" />
          <path d="M17.300 24 22.100 8h4.400l4.800 16h-3.700l-.900-3.300h-5l-.900 3.300Zm5.200-6.200h3.400l-1.700-6.300Z" fill="#ffffff" />
          <path d="M33.200 24V12.200h3.300v1.700c.700-1.300 1.900-2 3.500-2 .400 0 .800.050 1.100.150v3.250a5 5 0 0 0-1.400-.200c-1.900 0-3 1.100-3 3.100V24Z" fill="#ffffff" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 560, marginLeft: 76 }}>
          <div style={{ fontFamily: "Archivo Display", fontSize: nameSize, lineHeight: 0.9, letterSpacing: "-0.01em" }}>{storeName.toLowerCase()}</div>
          {/* Espace insécable après un mot d'une ou deux lettres : « à » ne reste pas seul en bout de ligne. */}
          <div style={{ fontFamily: "Archivo", fontSize: 42, lineHeight: 1.2, marginTop: 30 }}>{tagline.replace(/(^|\s)(\S{1,2}) /gu, "$1$2\u00a0")}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo Display", data: display, weight: 800, style: "normal" },
        { name: "Archivo", data: text, weight: 500, style: "normal" },
      ],
      // Les robots des réseaux sociaux la redemandent souvent : une journée de cache suffit.
      headers: { "Cache-Control": "public, max-age=86400" },
    }
  );
}
