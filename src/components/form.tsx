"use client";

import { createContext, useContext, useEffect, useId, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  as?: "input" | "textarea" | "select";
  children?: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

const control =
  "w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:opacity-60";

/** Champ de formulaire complet : libellé visible, aide, erreur reliée par aria-describedby. */
export function Field({ label, name, error, hint, optional, className, as = "input", children, ...props }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const shared = { id, name, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy };
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted-foreground">facultatif</span>}
      </label>
      {as === "textarea" ? (
        <textarea {...shared} {...props} className={cn(control, "min-h-24 py-2.5 leading-relaxed")} />
      ) : as === "select" ? (
        <select {...shared} {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)} className="field-select">
          {children}
        </select>
      ) : (
        <input {...shared} {...props} className={cn(control, "h-10")} />
      )}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[0.8125rem] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const PendingContext = createContext(false);

const DRAFT_SKIP = new Set(["password", "file", "hidden", "submit"]);

/**
 * Formulaire relié à une action serveur. Contrairement à <form action>, il ne vide pas les champs
 * après l'envoi : en cas d'erreur de validation, la saisie de l'utilisateur est conservée.
 * L'attribut action reste en place pour fonctionner avant le chargement du JavaScript.
 *
 * `draftKey` garde en plus la saisie dans l'onglet (sessionStorage) : elle survit à un changement
 * de langue ou à un rechargement. Les mots de passe ne sont jamais enregistrés.
 */
export function Form({
  action,
  children,
  draftKey,
  ref,
  ...props
}: Omit<React.ComponentProps<"form">, "action" | "onSubmit"> & { action: (formData: FormData) => void; draftKey?: string }) {
  const [pending, start] = useTransition();
  const inner = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = inner.current;
    if (!draftKey || !form) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? "{}") as Record<string, string>;
      for (const [name, value] of Object.entries(saved)) {
        const field = form.elements.namedItem(name);
        if (field instanceof RadioNodeList) continue; // les choix exclusifs sont pilotés par React
        if (field instanceof HTMLSelectElement) field.value = value;
        // Une valeur déjà modifiée (ou préremplie différemment par le serveur après une erreur) n'est pas écrasée.
        else if ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) && !DRAFT_SKIP.has(field.type) && field.value === field.defaultValue) field.value = value;
      }
    } catch {
      // stockage indisponible (navigation privée) : on s'en passe
    }
  }, [draftKey]);

  const saveDraft = () => {
    const form = inner.current;
    if (!draftKey || !form) return;
    const draft: Record<string, string> = {};
    for (const field of Array.from(form.elements)) {
      if ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) && field.name && !DRAFT_SKIP.has(field.type) && field.type !== "radio" && field.type !== "checkbox") draft[field.name] = field.value;
    }
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {}
  };

  return (
    <form
      {...props}
      ref={(node) => {
        inner.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      action={action}
      onInput={saveDraft}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(() => action(data));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

export function SubmitButton({
  children,
  className,
  size = "md",
  variant,
}: {
  children: React.ReactNode;
  className?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const status = useFormStatus();
  const pending = useContext(PendingContext) || status.pending;
  return (
    <Button type="submit" size={size} variant={variant} disabled={pending} className={className}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

export function FormAlert({ state }: { state: { error?: string; ok?: boolean; message?: string } }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
        {state.error}
      </p>
    );
  if (state.ok && state.message)
    return (
      <p role="status" className="rounded-lg border border-success/25 bg-success/5 px-3 py-2.5 text-sm text-success">
        {state.message}
      </p>
    );
  return null;
}
