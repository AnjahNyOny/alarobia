import type { ZodError } from "zod";

export type FormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export function toFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}

export function invalid(error: ZodError): FormState {
  return { error: "Certains champs sont à corriger.", fieldErrors: toFieldErrors(error) };
}

/** N'accepte que les chemins internes, pour éviter les redirections ouvertes. */
export function safeNext(next: unknown, fallback = "/compte") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
}
