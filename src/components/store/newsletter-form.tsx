"use client";

import { useActionState } from "react";
import { subscribeNewsletter } from "@/actions/shop";
import { Form, SubmitButton } from "@/components/form";

export function NewsletterForm() {
  const [state, action] = useActionState(subscribeNewsletter, {});
  if (state.ok)
    return (
      <p role="status" className="text-sm">
        {state.message}
      </p>
    );
  return (
    <Form action={action} className="grid gap-2">
      <div className="flex gap-2">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vous@exemple.fr"
          aria-label="Votre e-mail pour la lettre d&apos;information"
          aria-invalid={state.error ? true : undefined}
          className="h-10 min-w-0 flex-1 rounded-lg border border-background/25 bg-transparent px-3 text-sm text-background outline-none placeholder:text-background/50 focus-visible:border-background"
        />
        <SubmitButton variant="secondary">S'inscrire</SubmitButton>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-background">
          {state.error}
        </p>
      )}
    </Form>
  );
}
