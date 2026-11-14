import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "./navigation";

/** Redirection côté serveur vers un chemin interne, dans la langue de la requête. */
export async function redirectTo(href: string): Promise<never> {
  return redirect({ href, locale: await getLocale() });
}
