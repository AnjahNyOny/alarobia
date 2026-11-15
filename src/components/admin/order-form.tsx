"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateOrder } from "@/actions/admin/orders";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";
import { ORDER_STATUSES, ORDER_STATUS_LABEL } from "@/lib/constants";

export function OrderForm({ id, status, trackingNumber, unpaid = false }: { id: string; status: string; trackingNumber: string | null; /** Mobile Money choisi, paiement pas encore confirmé. */ unpaid?: boolean }) {
  const [state, action] = useActionState(updateOrder.bind(null, id), {});
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);
  const closed = status === "CANCELLED" || status === "REFUNDED";
  return (
    <Form action={action} className="grid gap-4">
      <Field as="select" label="Statut" name="status" defaultValue={status} key={status} hint={closed ? "Commande clôturée : le stock a été remis en vente." : unpaid ? "Paiement Mobile Money pas encore confirmé : n'expédiez pas avant. Annuler remet les articles en stock." : "Annuler ou rembourser remet les articles en stock."}>
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s} disabled={closed && s !== "CANCELLED" && s !== "REFUNDED"}>
            {ORDER_STATUS_LABEL[s]}
          </option>
        ))}
      </Field>
      <Field label="Numéro de suivi" name="trackingNumber" defaultValue={trackingNumber ?? ""} optional hint="Visible par le client dans son espace." />
      {state.error && <FormAlert state={state} />}
      <SubmitButton className="w-full">Enregistrer</SubmitButton>
    </Form>
  );
}
