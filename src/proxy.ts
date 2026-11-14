import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Premier filtre seulement : chaque page et chaque action revérifie la session côté serveur.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("session")?.value;
  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      role = String(payload.role ?? "CUSTOMER");
    } catch {
      role = null;
    }
  }
  if (!role) {
    const url = new URL("/connexion", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/compte/:path*"] };
