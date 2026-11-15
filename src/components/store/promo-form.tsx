"use client";

import { useActionState, useTransition } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { applyPromo, removePromo } from "@/actions/cart";
import { Form, SubmitButton } from "@/components/form";

export function PromoForm({ applied }: { applied: { code: string; label: string } | null }) {
  const t = useTranslations("cart");
  const [state, action] = useActionState(applyPromo, {});
  const [pending, start] = useTransition();

  if (applied)
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="tag bg-brand font-semibold text-brand-foreground">{applied.code}</strong>
          <span className="text-muted-foreground">{applied.label}</span>
        </span>
        <button type="button" disabled={pending} onClick={() => start(() => removePromo())} className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-muted" aria-label={t("promoRemove", { code: applied.code })}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );

  return (
    <Form action={action} className="grid gap-1.5">
      <label htmlFor="promo-code" className="text-sm font-medium">
        {t("promoLabel")}
      </label>
      <div className="flex gap-2">
        <input
          id="promo-code"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "promo-error" : undefined}
          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm uppercase outline-none placeholder:normal-case focus-visible:border-ring aria-invalid:border-destructive"
        />
        <SubmitButton variant="outline">{t("promoApply")}</SubmitButton>
      </div>
      {state.error && (
        <p id="promo-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </Form>
  );
}
