/**
 * Lignes du panier telles qu'elles sont écrites dans le cookie : identifiant du produit, quantité et,
 * pour un article personnalisé, identifiant de la personnalisation. Jamais de prix : ils sont relus en base.
 * Fonctions pures ; la lecture et l'écriture du cookie sont dans `cart.ts`.
 */

export type CartEntry = { id: string; q: number; c?: string };

export const MAX_QTY = 10;
/** Le cookie est limité à 4 Ko : trente lignes personnalisées y tiennent. */
export const MAX_LINES = 30;

// Identifiants générés par Prisma (cuid) : lettres minuscules et chiffres.
const ID = /^[a-z0-9]{8,40}$/;

/** Clé d'une ligne : deux personnalisations différentes du même produit font deux lignes. */
export function lineKey(entry: { id: string; c?: string; q?: number }) {
  return entry.c ? `${entry.id}:${entry.c}` : entry.id;
}

export function parseCartEntries(raw: string | undefined): CartEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const entries: CartEntry[] = [];
  for (const e of parsed) {
    if (!e || typeof e.id !== "string" || !ID.test(e.id) || !Number.isInteger(e.q) || e.q <= 0) continue;
    if (e.c !== undefined && (typeof e.c !== "string" || !ID.test(e.c))) continue;
    entries.push({ id: e.id, q: Math.min(e.q, MAX_QTY), ...(e.c && { c: e.c }) });
  }
  return entries.slice(0, MAX_LINES);
}

/** Quantité d'un produit dans le panier, toutes lignes confondues : c'est elle qu'on compare au stock. */
export function quantityOf(entries: CartEntry[], productId: string) {
  return entries.reduce((sum, e) => (e.id === productId ? sum + e.q : sum), 0);
}

/**
 * Ajoute une quantité à la ligne visée, dans la limite du stock (partagé entre les lignes du produit),
 * de la quantité maximale par ligne et du nombre de lignes. `added` dit combien ont réellement été ajoutés.
 */
export function addEntry(entries: CartEntry[], target: Pick<CartEntry, "id" | "c">, quantity: number, stock: number): { entries: CartEntry[]; added: number } {
  const key = lineKey(target);
  const existing = entries.find((e) => lineKey(e) === key);
  if (!existing && entries.length >= MAX_LINES) return { entries, added: 0 };
  const added = Math.max(0, Math.min(quantity, stock - quantityOf(entries, target.id), MAX_QTY - (existing?.q ?? 0)));
  if (added === 0) return { entries, added: 0 };
  return {
    entries: existing ? entries.map((e) => (e === existing ? { ...e, q: e.q + added } : e)) : [...entries, { id: target.id, q: added, ...(target.c && { c: target.c }) }],
    added,
  };
}

/** Fixe la quantité d'une ligne ; zéro ou moins la retire. */
export function setEntryQuantity(entries: CartEntry[], key: string, quantity: number): CartEntry[] {
  if (quantity <= 0) return entries.filter((e) => lineKey(e) !== key);
  return entries.map((e) => (lineKey(e) === key ? { ...e, q: Math.min(Math.floor(quantity), MAX_QTY) } : e));
}
