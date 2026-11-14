"use client";

import { useActionState, useTransition } from "react";
import { Tag, X } from "lucide-react";
import { applyPromo, removePromo } from "@/actions/cart";
import { Form, SubmitButton } from "@/components/form";

export function PromoForm({ applied }: { applied: { code: string; label: string } | null }) {
  const [state, action] = useActionState(applyPromo, {});
  const [pending, start] = useTransition();

  if (applied)
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-brand/40 bg-brand/5 px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2">
          <Tag className="size-4 text-brand" aria-hidden />
          <span>
            <strong className="font-medium">{applied.code}</strong> <span className="text-muted-foreground">({applied.label})</span>
          </span>
        </span>
        <button type="button" disabled={pending} onClick={() => start(() => removePromo())} className="grid size-7 place-items-center rounded-md hover:bg-brand/10" aria-label={`Retirer le code ${applied.code}`}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );

  return (
    <Form action={action} className="grid gap-1.5">
      <label htmlFor="promo-code" className="text-sm font-medium">
        Code promo
      </label>
      <div className="flex gap-2">
        <input
          id="promo-code"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "promo-error" : undefined}
          className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm uppercase outline-none placeholder:normal-case focus-visible:border-ring aria-invalid:border-destructive"
        />
        <SubmitButton variant="outline">Appliquer</SubmitButton>
      </div>
      {state.error && (
        <p id="promo-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </Form>
  );
}
