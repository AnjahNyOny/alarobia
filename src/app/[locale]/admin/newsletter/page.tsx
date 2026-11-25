import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { Download } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { removeNewsletterSubscriber } from "@/actions/admin/newsletter";
import { ConfirmAction } from "@/components/admin/actions";
import { Card, EmptyState, PageHeader, Pagination, SearchForm, td, th } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { madagascarTime } from "@/lib/shipping";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.newsletter");
  return { title: t("metaTitle") };
}
const PER_PAGE = 50;

/**
 * Adresses laissées dans le pied de page de la boutique, confirmées ou non (PLAN.md 7.13 : seules les adresses
 * confirmées par le lien de l'e-mail recevront la lettre). Le vendeur exporte la liste (CSV) et retire l'adresse d'une
 * personne qui lui demande de se désinscrire.
 */
export default async function NewsletterPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1") || 1);
  const where: Prisma.NewsletterSubscriberWhereInput = q ? { email: { contains: q, mode: "insensitive" } } : {};
  const [subscribers, total, all, t, tc, locale] = await Promise.all([
    db.newsletterSubscriber.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db.newsletterSubscriber.count({ where }),
    db.newsletterSubscriber.count(),
    getTranslations("admin.newsletter"),
    getTranslations("admin.common"),
    getLocale(),
  ]);
  return (
    <>
      <PageHeader title={t("title")} description={t("description", { count: all })}>
        {all > 0 && (
          // Simple lien : la route est hors des pages traduites, le Link de next-intl y ajouterait la langue.
          <a href="/api/admin/newsletter" download className={buttonVariants({ variant: "outline", size: "md" })}>
            <Download aria-hidden />
            {t("download")}
          </a>
        )}
      </PageHeader>
      <Card flush>
        {all > 0 && (
          <div className="p-3">
            <SearchForm action="/admin/newsletter" placeholder={t("searchPlaceholder")} defaultValue={q} />
          </div>
        )}
        {subscribers.length === 0 ? (
          <div className={cn(all > 0 && "border-t")}>
            <EmptyState title={t("emptyTitle")} text={q ? t("emptyFiltered") : t("emptyText")} />
          </div>
        ) : (
          <>
            {/* Sur téléphone, la date passe sous l'adresse, et la confirmation aussi tant que l'écran est étroit : le bouton
                « Retirer » reste visible sans faire défiler le tableau. */}
            <table className="w-full table-fixed">
              <thead className="border-y bg-muted/40">
                <tr>
                  <th className={th}>{t("colEmail")}</th>
                  <th className={cn(th, "hidden w-52 sm:table-cell")}>{t("colSubscribed")}</th>
                  <th className={cn(th, "hidden w-36 md:table-cell")}>{t("colConfirmed")}</th>
                  <th className={cn(th, "w-24 pl-0 text-right sm:w-28")}>
                    <span className="sr-only">{tc("actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subscribers.map((s) => {
                  const date = formatDateTime(s.createdAt, locale);
                  const confirmed = s.confirmedAt && formatDate(madagascarTime(s.confirmedAt), locale, "medium");
                  // Une adresse trop longue pour la ligne se coupe d'abord après « @ », pas au milieu du domaine.
                  const at = s.email.lastIndexOf("@");
                  return (
                    <tr key={s.id} className="hover:bg-muted/40">
                      <td className={td}>
                        <p className="font-medium break-words">
                          {at > 0 ? (
                            <>
                              {s.email.slice(0, at + 1)}
                              <wbr />
                              {s.email.slice(at + 1)}
                            </>
                          ) : (
                            s.email
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums sm:hidden">{date}</p>
                        <p className="text-xs text-muted-foreground tabular-nums md:hidden">{confirmed ? t("confirmedOn", { date: confirmed }) : t("notConfirmed")}</p>
                      </td>
                      <td className={cn(td, "hidden text-muted-foreground tabular-nums sm:table-cell")}>{date}</td>
                      <td className={cn(td, "hidden text-muted-foreground tabular-nums md:table-cell")}>{confirmed ?? t("confirmedNo")}</td>
                      <td className={cn(td, "pl-0 text-right")}>
                        <ConfirmAction action={removeNewsletterSubscriber.bind(null, s.id)} title={t("confirmTitle", { email: s.email })} description={t("confirmDescription")} confirmLabel={t("remove")}>
                          {t("remove")}
                          <span className="sr-only"> {s.email}</span>
                        </ConfirmAction>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t">
              <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} total={total} href={(n) => `/admin/newsletter?${new URLSearchParams({ ...(q && { q }), ...(n > 1 && { page: String(n) }) })}`} />
            </div>
          </>
        )}
      </Card>
    </>
  );
}
