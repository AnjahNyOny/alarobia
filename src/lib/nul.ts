import { Prisma } from "@prisma/client";

/**
 * PostgreSQL refuse le caractère nul dans un texte (erreur 22021), là où SQLite l'acceptait : une seule chaîne
 * du client qui en contient un donnait une erreur 500. Copie profonde qui le retire de toutes les chaînes, dans
 * les objets simples et les tableaux. Date, Uint8Array / Buffer, Decimal, null et nombres sont rendus tels quels.
 */
export function stripNul<T>(value: T): T {
  if (typeof value === "string") return value.replaceAll("\u0000", "") as T;
  if (Array.isArray(value)) return value.map(stripNul) as T;
  if (value !== null && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripNul(v)])) as T;
  }
  return value;
}

/** Extension Prisma : un seul point de contrôle pour les arguments de toutes les requêtes. */
export const nulSafe = Prisma.defineExtension({
  name: "nul-safe",
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        return query(stripNul(args));
      },
    },
  },
});
