import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_NAMESPACES, clientMessages } from "../messages";
import fr from "../../../messages/fr.json";

const SRC = resolve(__dirname, "../..");
// Le back-office transmet lui-même tous les messages à ses composants (src/app/[locale]/admin/layout.tsx).
const ADMIN = [join(SRC, "components/admin"), join(SRC, "app/[locale]/admin")];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Fichier local importé par `from`, ou `null` pour un paquet ou un import de type seul. */
function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

/**
 * Espaces de messages lus dans le navigateur : ceux des `useTranslations` de chaque composant client et de tout
 * ce qu'il importe (un composant sans « use client » importé par un composant client s'exécute aussi dans le navigateur).
 */
function namespacesUsedInBrowser() {
  const files = sources(SRC).filter((f) => !ADMIN.some((dir) => f.startsWith(dir)));
  const roots = files.filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
  const seen = new Set<string>();
  const used = new Map<string, Set<string>>();
  const visit = (file: string) => {
    if (seen.has(file) || ADMIN.some((dir) => file.startsWith(dir))) return;
    seen.add(file);
    const code = readFileSync(file, "utf8");
    for (const [, namespace] of code.matchAll(/useTranslations\(\s*(?:["']([^"']*)["'])?\s*\)/g)) {
      const key = namespace ?? "(tous les messages)";
      used.set(key, (used.get(key) ?? new Set()).add(relative(SRC, file)));
    }
    if (/useMessages\(/.test(code)) used.set("(tous les messages)", (used.get("(tous les messages)") ?? new Set()).add(relative(SRC, file)));
    for (const [, typeOnly, spec] of code.matchAll(/^import\s+(type\s+)?[^"']*?from\s+["']([^"']+)["']/gm)) {
      const target = typeOnly ? null : resolveImport(file, spec);
      if (target) visit(target);
    }
  };
  roots.forEach(visit);
  return used;
}

const covers = (namespace: string) => CLIENT_NAMESPACES.some((n) => namespace === n || namespace.startsWith(`${n}.`));

describe("clientMessages", () => {
  it("ne garde que les espaces listés, y compris un sous-espace", () => {
    const messages = { cart: { title: "Panier" }, help: { title: "Aide" }, home: { lead: "Bonjour", demo: { label: "Prénom" } } };
    const picked = clientMessages(messages, ["cart", "home.demo"]);
    expect(picked).toEqual({ cart: { title: "Panier" }, home: { demo: { label: "Prénom" } } });
  });

  it("n'envoie jamais les textes du back-office ni ceux des pages servies par le serveur seul", () => {
    const sent = Object.keys(clientMessages(fr));
    expect(sent).not.toContain("admin");
    expect(sent).not.toContain("help");
    expect(sent).not.toContain("legal");
  });
});

describe("messages envoyés au navigateur (CLIENT_NAMESPACES)", () => {
  const used = namespacesUsedInBrowser();

  it("couvrent tous les espaces lus par un composant client ou par ce qu'il importe", () => {
    const missing = [...used].filter(([namespace]) => !covers(namespace)).map(([namespace, files]) => `${namespace} (${[...files].join(", ")})`);
    expect(missing).toEqual([]);
  });

  it("ne contiennent que des espaces réellement lus dans le navigateur et présents dans fr.json", () => {
    const unused = CLIENT_NAMESPACES.filter((n) => ![...used.keys()].some((u) => u === n || u.startsWith(`${n}.`)));
    const absent = CLIENT_NAMESPACES.filter((n) => n.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], fr) === undefined);
    expect({ unused, absent }).toEqual({ unused: [], absent: [] });
  });
});
