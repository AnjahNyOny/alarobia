/**
 * Limitation de débit, en mémoire et sur fenêtre glissante. Sur Netlify, chaque instance de fonction tient ses
 * propres compteurs : les limites y sont plus lâches. Décidé pour la mise en ligne (PLAN.md, « Ce que la phase 7A ne
 * fait pas ») ; à remplacer par un stockage partagé si des abus apparaissent.
 *
 * Les opérateurs mobiles malgaches font sortir beaucoup de clients par la même adresse : les limites
 * par adresse sont larges, et on compte les échecs plutôt que les appels quand c'est possible.
 * Une clé `null` (adresse inconnue) n'est jamais limitée : tous les visiteurs partageraient sinon
 * le même compteur, et un seul pourrait bloquer tout le monde.
 */

export type RateLimiter = {
  /** Vérifie et compte en une fois : `false` si la limite est atteinte (rien n'est compté alors). */
  (key: string | null): boolean;
  /** Millisecondes avant qu'une nouvelle tentative soit permise ; 0 si la clé est libre. Ne compte rien. */
  retryIn(key: string | null): number;
  /** Compte une tentative sans rien vérifier. Renvoie de quoi l'annuler (tentative qui, finalement, ne compte pas). */
  record(key: string | null): () => void;
  /** Nombre de clés gardées en mémoire. */
  size(): number;
};

export function createRateLimiter({ limit, windowMs, now = Date.now }: { limit: number; windowMs: number; now?: () => number }): RateLimiter {
  const hits = new Map<string, number[]>();
  const recent = (key: string) => {
    const since = now() - windowMs;
    // Les clés qui n'ont plus rien envoyé dans la fenêtre sont oubliées : la table ne grossit pas sans fin.
    for (const [k, times] of hits) if (times[times.length - 1] <= since) hits.delete(k);
    return (hits.get(key) ?? []).filter((t) => t > since);
  };
  const retryIn = (key: string | null) => {
    if (key === null) return 0;
    const times = recent(key);
    // Il faut que la tentative la plus ancienne parmi les `limit` dernières sorte de la fenêtre.
    return times.length < limit ? 0 : times[times.length - limit] + windowMs - now();
  };
  const record = (key: string | null) => {
    if (key === null) return () => {};
    const stamp = now();
    hits.set(key, [...recent(key), stamp]);
    return () => {
      const times = hits.get(key);
      const i = times?.lastIndexOf(stamp) ?? -1;
      if (times && i >= 0) times.splice(i, 1);
      if (times?.length === 0) hits.delete(key);
    };
  };
  const allow = (key: string | null) => {
    if (retryIn(key) > 0) return false;
    record(key);
    return true;
  };
  return Object.assign(allow, { retryIn, record, size: () => hits.size });
}

/** Minutes à annoncer au visiteur : arrondies au-dessus, une au moins. */
export function retryMinutes(ms: number) {
  return Math.max(1, Math.ceil(ms / 60_000));
}

type Check = readonly [RateLimiter, string | null];

/** Attente la plus longue parmi les clés ; 0 si toutes sont libres. */
export function retryInAll(checks: readonly Check[]) {
  return Math.max(0, ...checks.map(([limiter, key]) => limiter.retryIn(key)));
}

/**
 * Tentative limitée. `counts` dit si son résultat compte : un échec (mot de passe faux, code inconnu) ou,
 * selon le cas, une création réussie (compte, commande). Si une clé a atteint sa limite, `attempt` n'est pas
 * appelée du tout : pas de calcul coûteux, et la réponse ne dit rien de la justesse de la saisie.
 * La place est prise avant la tentative et rendue ensuite si elle ne compte pas : des tentatives envoyées
 * en rafale ne passent pas toutes la vérification avant que la première soit comptée.
 */
export async function withRateLimit<T>(checks: readonly Check[], attempt: () => Promise<T>, counts: (value: T) => boolean): Promise<{ limited: true; minutes: number } | { limited: false; value: T }> {
  const wait = retryInAll(checks);
  if (wait > 0) return { limited: true, minutes: retryMinutes(wait) };
  const undo = checks.map(([limiter, key]) => limiter.record(key));
  const release = () => undo.forEach((u) => u());
  let value: T;
  try {
    value = await attempt();
  } catch (e) {
    release();
    throw e;
  }
  if (!counts(value)) release();
  return { limited: false, value };
}

/**
 * Adresse du visiteur. `null` si elle est inconnue.
 * - Sur Netlify : `x-nf-client-connection-ip`, posé par Netlify. C'est le seul en-tête que Netlify dit garder vers les
 *   fonctions pour l'adresse du client (https://answers.netlify.com/t/upcoming-change-stripping-exposed-netlify-headers-from-function-and-proxy-requests/52665).
 *   Vérifié en ligne (PLAN.md 7.5, contrôle de mise en ligne) : un `x-nf-client-connection-ip` envoyé par le client est
 *   écrasé par Netlify, qui y met la vraie adresse ; un `x-forwarded-for` envoyé par le client est gardé (Netlify ajoute
 *   la vraie adresse à la suite), d'où l'ordre de lecture.
 * - Ailleurs (local, tests navigateur) : la première adresse de x-forwarded-for, puis x-real-ip. Sans proxy de confiance
 *   devant le serveur, un client peut les forger et contourner les limites par adresse.
 */
export function clientIp(headers: Headers): string | null {
  return (
    headers.get("x-nf-client-connection-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip")?.trim() ||
    null
  );
}
