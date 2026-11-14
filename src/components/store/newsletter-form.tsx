"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { subscribeNewsletter } from "@/actions/shop";
import { Form, SubmitButton } from "@/components/form";

export function NewsletterForm() {
  const t = useTranslations("footer");
  const [state, action] = useActionState(subscribeNewsletter, {});
  if (state.ok)
    return (
      <p role="status" className="text-sm">
        {state.message}
      </p>
    );
  return (
    <Form action={action} className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="rakoto@exemple.mg"
          aria-label={t("newsletterLabel")}
          aria-invalid={state.error ? true : undefined}
          className="h-10 min-w-0 flex-1 basis-40 rounded-md border border-primary-foreground/35 bg-transparent px-3 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/55 focus-visible:border-primary-foreground"
        />
        <SubmitButton variant="secondary">{t("subscribe")}</SubmitButton>
      </div>
      {state.error && (
        <p role="alert" className="text-sm">
          {state.error}
        </p>
      )}
    </Form>
  );
}
