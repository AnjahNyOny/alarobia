import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewsletterTokenAction } from "@/components/store/newsletter-token";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("newsletter");
  return { title: t("unsubscribeMetaTitle"), robots: { index: false, follow: false } };
}

/**
 * Lien de désinscription de chaque lettre (PLAN.md 7.13 et 7.14). Point de vigilance 5 : l'ouvrir ne retire rien (un
 * antivirus de messagerie suit les liens) ; seul le bouton le fait. La page ne lit pas la base : la réponse est la même
 * que le jeton soit valable, déjà utilisé ou inconnu, et ne dit rien de qui est inscrit.
 */
export default async function UnsubscribeNewsletterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("newsletter");
  const texts = {
    title: t("unsubscribeTitle"),
    text: t("unsubscribeText"),
    button: t("unsubscribeButton"),
    doneTitle: t("unsubscribedTitle"),
    doneText: t("unsubscribedText"),
    invalidTitle: t("invalidTitle"),
    invalidText: t("invalidText"),
  };
  return (
    <div className="container-page pt-10 pb-12 md:pt-16">
      <div className="max-w-xl">
        <NewsletterTokenAction kind="unsubscribe" token={token} texts={texts}>
          <Link href="/" className={buttonVariants({ size: "md", variant: "outline" })}>
            {t("home")}
          </Link>
        </NewsletterTokenAction>
      </div>
    </div>
  );
}
