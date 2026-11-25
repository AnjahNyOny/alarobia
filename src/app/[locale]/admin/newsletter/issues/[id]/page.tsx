import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { IssueForm, IssueSender, TestSendButton } from "@/components/admin/newsletter";
import { Card, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { SHOP_NAME } from "@/lib/mail/layout";
import { letterPreview } from "@/lib/mail/newsletter-mails";
import { vendorAddress } from "@/lib/mail/order-mails";
import { translateMail } from "@/lib/mail/translate";
import { issueProgress } from "@/lib/newsletter-send";
import { siteBase } from "@/lib/seo";
import { madagascarTime } from "@/lib/shipping";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.newsletter");
  return { title: t("issueMetaTitle") };
}

/**
 * Une lettre (PLAN.md 7.14) : aperçu de l'e-mail tel qu'il partira, modification tant que rien n'est parti, essai au
 * vendeur, puis envoi aux inscrits confirmés, par lots, avec sa progression.
 */
export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [issue, progress, t, locale] = await Promise.all([db.newsletterIssue.findUnique({ where: { id } }), issueProgress(db, id), getTranslations("admin.newsletter"), getLocale()]);
  if (!issue) notFound();

  const vendor = vendorAddress(process.env.SMTP_USER);
  // Aperçu en français, adressé au vendeur, sans jeton réel : le HTML exact de l'envoi, pied compris.
  const preview = letterPreview(issue, { translate: translateMail, base: siteBase(), vendor });
  const editable = !issue.sentAt && progress.attempted === 0;
  const date = (d: Date) => formatDate(madagascarTime(d), locale, "medium");

  return (
    <>
      <PageHeader title={issue.subject} description={t("createdOn", { date: formatDateTime(issue.createdAt, locale) })} back={{ href: "/admin/newsletter", label: t("title") }} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 content-start gap-4">
          <Card title={t("previewTitle")} description={t("previewDescription")} flush>
            {/* L'e-mail posé sur la table : en-tête de messagerie, puis le message lui-même dans un cadre isolé. */}
            <div className="border-t bg-muted/50 p-3 sm:p-5">
              <div className="mx-auto max-w-[600px] overflow-hidden rounded-md border bg-background shadow-[0_1px_0_var(--border)]">
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-b px-4 py-3 text-sm">
                  <dt className="text-muted-foreground">{t("previewFrom")}</dt>
                  <dd className="min-w-0 truncate">{SHOP_NAME}</dd>
                  <dt className="text-muted-foreground">{t("previewSubject")}</dt>
                  <dd className="min-w-0 font-medium break-words">{issue.subject}</dd>
                </dl>
                {/* sandbox vide : ni script, ni formulaire, ni navigation. Le HTML est déjà échappé (layout.ts). */}
                <iframe title={t("previewFrame", { subject: issue.subject })} sandbox="" srcDoc={preview.html} className="block h-[38rem] w-full bg-white" />
              </div>
            </div>
          </Card>
          {editable && (
            <Card title={t("editTitle")} description={t("editDescription")}>
              <IssueForm issue={{ id: issue.id, subject: issue.subject, body: issue.body }} />
            </Card>
          )}
        </div>
        <div className="grid min-w-0 content-start gap-4">
          <Card title={t("sendTitle")}>
            {issue.sentAt ? (
              <p id="lettre-envoyee" className="text-sm">
                {t("sentSummary", { date: date(issue.sentAt), delivered: progress.delivered })}
              </p>
            ) : (
              <div className="grid gap-5">
                <TestSendButton issueId={issue.id} hint={t("testHint", { email: vendor, prefix: t("testPrefix") })} />
                <div className="border-t pt-5">
                  <IssueSender issueId={issue.id} subject={issue.subject} initial={progress} />
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
