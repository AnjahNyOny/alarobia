import { PrismaClient } from "@prisma/client";
import type { ITXClientDenyList } from "@prisma/client/runtime/library";
import { nulSafe } from "./nul";

/** Le client de l'application : une seule fabrique, pour que les tests utilisent exactement le même. */
export function createDb(datasourceUrl?: string) {
  return new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined).$extends(nulSafe);
}

export type Db = ReturnType<typeof createDb>;
/** Le client reçu dans `db.$transaction((tx) => …)`. */
export type Tx = Omit<Db, ITXClientDenyList>;

const globalForPrisma = globalThis as unknown as { prisma?: Db };

export const db = globalForPrisma.prisma ?? createDb();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
