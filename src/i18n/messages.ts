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
