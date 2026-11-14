import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { jwtVerify } from "jose";
import { protectionFor, splitLocale } from "@/i18n/paths";
import { routing } from "@/i18n/routing";

const handleLocale = createMiddleware(routing);

async function roleOf(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    return String(payload.role ?? "CUSTOMER");
  } catch {
    return null;
  }
}

// Premier filtre seulement : chaque page et chaque action revérifie la session côté serveur.
export async function proxy(req: NextRequest) {
  const { locale, path } = splitLocale(req.nextUrl.pathname);
  const zone = locale ? protectionFor(path) : null;
  if (locale && zone) {
    const role = await roleOf(req);
    if (!role) {
      const url = new URL(`/${locale}/login`, req.url);
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
    if (zone === "admin" && role !== "ADMIN") return NextResponse.redirect(new URL(`/${locale}`, req.url));
  }
  // Sans préfixe de langue, next-intl redirige vers la langue du visiteur ; la protection s'applique au passage suivant.
  return handleLocale(req);
}

export const config = { matcher: ["/((?!api|uploads|_next|_vercel|.*\\..*).*)"] };
