import { useLocale, useTranslations } from "next-intl";
import { formatDate, formatPrice } from "@/lib/format";
import { isMobileMoney, merchantNumber, OPERATOR_NAME, paymentState, type MerchantNumbers } from "@/lib/payment";
import { CopyButton } from "./copy-button";
import { PaymentReferenceForm } from "./payment-reference-form";

type PanelOrder = { id: string; number: string; status: string; paymentMethod: string; paymentReference: string | null; paymentDeclaredAt: Date | null; paidAt: Date | null; totalCents: number };

/** Une donnée à recopier sans faute : en grand, avec son bouton de copie. */
function KeyValue({ label, value, copy }: { label: string; value: string; copy: string }) {
  return (
    // dl > div > dt + dd, rien d'autre : le bouton de copie va dans le dd, à côté de la valeur.
    <div className="border-t border-highlight-foreground/20 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <dt className="text-[0.8125rem]">{label}</dt>
      <dd className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <span className="display text-3xl whitespace-nowrap tabular-nums sm:text-4xl">{value}</span>
        <CopyButton value={copy} label={label} />
      </dd>
    </div>
  );
}

/**
 * Où en est le paiement d'une commande, et ce que le client doit faire.
 * Mobile Money : montant et numéro à créditer, puis saisie de la référence de transaction.
 * Les trois étapes sont numérotées parce qu'elles se suivent réellement.
 */
export function PaymentPanel({ order, settings }: { order: PanelOrder; settings: MerchantNumbers & { currency: string; mobileMoneyName: string } }) {
  const t = useTranslations("payment");
  const locale = useLocale();
  const state = paymentState(order);
  const amount = formatPrice(order.totalCents, settings.currency, locale);
  if (state === "void") return null;

  if (!isMobileMoney(order.paymentMethod))
    return <p className="rounded-sm border px-4 py-3.5">{state === "received" ? t("receivedNoDate") : t("onDelivery", { amount })}</p>;

  const operator = OPERATOR_NAME[order.paymentMethod];
  if (state === "received")
    return <p className="rounded-sm border px-4 py-3.5">{order.paidAt ? t("received", { date: formatDate(order.paidAt, locale, "long") }) : t("receivedNoDate")}</p>;

  const number = merchantNumber(order.paymentMethod, settings);
  return (
    <section aria-labelledby="paiement-titre" className="rounded-sm border-2 border-foreground">
      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <h2 id="paiement-titre" className="display-sm text-2xl">
          {t("title", { operator })}
        </h2>
        <p className="mt-1 text-muted-foreground">{t("awaitingLead")}</p>
      </div>
      <ol className="mt-4 grid gap-5 px-4 pb-5 sm:px-6 sm:pb-6 [counter-reset:etape]">
        <li className="grid gap-3 [counter-increment:etape]">
          <p className="font-medium before:mr-1.5 before:content-[counter(etape)'.']">{t("step1", { operator })}</p>
          <dl className="rounded-sm bg-highlight px-4 py-3.5 text-highlight-foreground">
            <KeyValue label={t("amount")} value={amount} copy={String(Math.round(order.totalCents / 100))} />
            <KeyValue label={t("number", { operator })} value={number} copy={number.replace(/\s/g, "")} />
          </dl>
          {settings.mobileMoneyName && <p className="text-sm text-muted-foreground">{t("holder", { name: settings.mobileMoneyName })}</p>}
        </li>
        <li className="[counter-increment:etape]">
          <p className="font-medium before:mr-1.5 before:content-[counter(etape)'.']">{t("step2", { order: order.number })}</p>
        </li>
        <li className="grid gap-3 [counter-increment:etape]">
          <p className="font-medium before:mr-1.5 before:content-[counter(etape)'.']">{t("step3")}</p>
          {state === "declared" && order.paymentReference && (
            <p role="status" className="rounded-sm bg-muted px-3.5 py-3 text-sm">
              {t("declared", { reference: order.paymentReference, date: formatDate(order.paymentDeclaredAt ?? new Date(), locale, "long") })}
            </p>
          )}
          <PaymentReferenceForm orderId={order.id} current={order.paymentReference} />
        </li>
      </ol>
    </section>
  );
}
