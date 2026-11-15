"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { declarePayment } from "@/actions/payment";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";

export function PaymentReferenceForm({ orderId, current }: { orderId: string; current: string | null }) {
  const t = useTranslations("payment");
  const [state, action] = useActionState(declarePayment.bind(null, orderId), {});
  return (
    <Form action={action} className="grid gap-3 sm:max-w-md">
      <Field label={t("referenceLabel")} name="reference" defaultValue={current ?? ""} key={current ?? "vide"} error={state.fieldErrors?.reference} required autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={40} />
      <FormAlert state={state} />
      <div>
        <SubmitButton variant={current ? "outline" : undefined}>{current ? t("referenceUpdate") : t("referenceSubmit")}</SubmitButton>
      </div>
    </Form>
  );
}
