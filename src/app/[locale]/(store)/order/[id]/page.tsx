import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { OrderView } from "@/components/store/order-view";
import { buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { PaymentPanel } from "@/components/store/payment-panel";
import { isMobileMoney, OPERATOR_NAME, paymentState, type MobileMoney } from "@/lib/payment";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Commande confirmée", robots: { index: false } };

export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, settings, user] = await Promise.all([db.order.findUnique({ where: { id }, include: { items: true } }), getSettings(), getUser()]);
  // Une commande rattachée à un compte n'est visible que par ce compte ; une commande invitée, par son lien non devinable.
  if (!order || (order.userId && order.userId !== user?.id && user?.role !== "ADMIN")) notFound();
  const t = await getTranslations("payment");
  const awaiting = paymentState(order) === "awaiting";

  return (
    <div className="container-page pt-10 md:pt-16">
      <div className="max-w-2xl">
        <span className="grid size-11 place-items-center rounded-full bg-success text-white">
          <Check className="size-5" aria-hidden />
        </span>
        <h1 className="display mt-6 text-4xl md:text-5xl">Merci, votre commande est enregistrée.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Commande <span className="font-medium text-foreground">{order.number}</span>. {awaiting ? t("confirmationMobile", { operator: OPERATOR_NAME[order.paymentMethod as MobileMoney] }) : isMobileMoney(order.paymentMethod) ? "" : t("confirmationCod")} Nous vous préviendrons à l'adresse {order.email} dès l'expédition du colis.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/products" className={buttonVariants({ size: "md" })}>
            Continuer mes achats
          </Link>
          {user && (
            <Link href="/account" className={buttonVariants({ size: "md", variant: "outline" })}>
              Suivre mes commandes
            </Link>
          )}
        </div>
      </div>
      {isMobileMoney(order.paymentMethod) && (
        <div className="mt-10 max-w-2xl">
          <PaymentPanel order={order} settings={settings} />
        </div>
      )}
      <div className="mt-12 border-t pt-10">
        <OrderView order={order} currency={settings.currency} />
      </div>
    </div>
  );
}
