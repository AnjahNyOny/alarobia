import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewsletterTokenAction } from "@/components/store/newsletter-token";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { subscriptionState } from "@/lib/newsletter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("newsletter");
  return { title: t("confirmMetaTitle"), robots: { index: false, follow: false } };
}

/**
 * Lien de l'e-mail de confirmation de la lettre (PLAN.md 7.13). L'ouvrir ne fait que lire : la confirmation part du
 * bouton (action serveur). Adresse déjà confirmée : la page le dit, sans bouton. Jeton inconnu (adresse retirée, lien
 * tronqué) : la page dit que le lien n'est plus valable et renvoie au formulaire du bas de page.
 */
export default async function ConfirmNewsletterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [state, t] = await Promise.all([subscriptionState(db, token), getTranslations("newsletter")]);
  const texts = {
    title: t("confirmTitle"),
    text: t("confirmText"),
    button: t("confirmButton"),
    doneTitle: t("confirmedTitle"),
    doneText: t("confirmedText"),
    invalidTitle: t("invalidTitle"),
    invalidText: t("invalidText"),
  };
  return (
    <div className="container-page pt-10 pb-12 md:pt-16">
      <div className="max-w-xl">
        <NewsletterTokenAction kind="confirm" token={token} texts={texts} settled={state === "confirmed" ? "done" : state === "unknown" ? "invalid" : null}>
          <Link href="/" className={buttonVariants({ size: "md", variant: "outline" })}>
            {t("home")}
          </Link>
        </NewsletterTokenAction>
      </div>
    </div>
  );
}
