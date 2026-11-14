import { isLocale, type Locale } from "./routing";

/** "/mg/admin/orders" → { locale: "mg", path: "/admin/orders" } */
export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (!isLocale(first)) return { locale: null, path: pathname };
  const path = "/" + rest.join("/");
  return { locale: first, path: path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path };
}

/** Zone protégée à laquelle appartient un chemin (sans préfixe de langue). */
export function protectionFor(path: string): "admin" | "account" | null {
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if (path === "/account" || path.startsWith("/account/")) return "account";
  return null;
}
