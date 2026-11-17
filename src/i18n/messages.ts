export type Messages = { [key: string]: string | Messages };

/** Fusionne une traduction sur le socle français ; une valeur vide ou absente garde le français. */
export function mergeMessages(base: Messages, override: Messages | undefined): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override ?? {})) {
    const baseValue = base[key];
    if (typeof value === "string") {
      if (value.trim() !== "" && typeof baseValue !== "object") out[key] = value;
    } else if (typeof baseValue === "object") {
      out[key] = mergeMessages(baseValue, value);
    }
  }
  return out;
}

/** Liste à plat des clés ("cart.empty.title") avec leurs variables ICU, pour comparer les fichiers. */
export function flattenMessages(messages: Messages, prefix = ""): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = [...new Set([...value.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1]))].sort();
    else Object.assign(out, flattenMessages(value, path));
  }
  return out;
}

/**
 * Espaces de messages lus dans le navigateur par les composants de la boutique. Seuls ceux-là partent avec chaque page
 * (dans la charge RSC du HTML) ; les textes des pages rendues par le serveur seul (aide, mentions, à propos, erreurs
 * des actions…) restent sur le serveur. Un composant client qui lit un nouvel espace doit l'ajouter ici :
 * `src/i18n/__tests__/client-messages.test.ts` le vérifie en suivant les imports de chaque composant client.
 */
export const CLIENT_NAMESPACES: readonly string[] = [
  "common",
  "nav",
  "cart",
  "card",
  "footer",
  "catalog",
  "product",
  "customizer",
  "home.demo",
  "address",
  "delivery",
  "payment",
  "checkout",
  "auth",
  "account",
  "pages",
];

/** Garde de `messages` les espaces listés ; `home.demo` garde ce sous-espace seulement. */
export function clientMessages(messages: Messages, namespaces: readonly string[] = CLIENT_NAMESPACES): Messages {
  const out: Messages = {};
  for (const path of namespaces) {
    const keys = path.split(".");
    let source: Messages | string | undefined = messages;
    let target = out;
    keys.forEach((key, i) => {
      source = typeof source === "object" ? source[key] : undefined;
      if (source === undefined) return;
      if (i === keys.length - 1) target[key] = source;
      else target = (target[key] ??= {}) as Messages;
    });
  }
  return out;
}
