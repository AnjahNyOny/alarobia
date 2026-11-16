"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateOrder } from "@/actions/admin/orders";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";
import { ORDER_STATUSES } from "@/lib/constants";

export function OrderForm({ id, status, trackingNumber, unpaid = false }: { id: string; status: string; trackingNumber: string | null; /** Mobile Money choisi, paiement pas encore confirmé. */ unpaid?: boolean }) {
  const [state, action] = useActionState(updateOrder.bind(null, id), {});
  const t = useTranslations("admin.orderForm");
  const ta = useTranslations("admin");
  const statusName = useTranslations("status");
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);
  const closed = status === "CANCELLED" || status === "REFUNDED";
  return (
    <Form action={action} className="grid gap-4">
      <Field as="select" label={t("status")} name="status" defaultValue={status} key={status} hint={closed ? t("hintClosed") : unpaid ? t("hintUnpaid") : t("hint")}>
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s} disabled={closed && s !== "CANCELLED" && s !== "REFUNDED"}>
            {statusName(s)}
          </option>
        ))}
      </Field>
      <Field label={t("tracking")} name="trackingNumber" defaultValue={trackingNumber ?? ""} optional={ta("optional")} hint={t("trackingHint")} />
      {state.error && <FormAlert state={state} />}
      <SubmitButton className="w-full">{t("save")}</SubmitButton>
    </Form>
  );
}
