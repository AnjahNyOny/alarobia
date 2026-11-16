import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { deleteReview, setReviewStatus } from "@/actions/admin/misc";
import { ConfirmAction, ToggleAction } from "@/components/admin/actions";
import { Card, EmptyState, PageHeader, Tabs } from "@/components/admin/ui";
import { Stars } from "@/components/store/stars";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reviews");
  return { title: t("metaTitle") };
}

async function toggle(id: string, published: boolean) {
  "use server";
  await setReviewStatus(id, published ? "PUBLISHED" : "HIDDEN");
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status: requested } = await searchParams;
  const status = requested === "HIDDEN" || requested === "PUBLISHED" ? requested : undefined;
  const [reviews, counts, t, tc, locale] = await Promise.all([
    db.review.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 60, include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } } }),
    db.review.groupBy({ by: ["status"], _count: true }),
    getTranslations("admin.reviews"),
    getTranslations("admin.common"),
    getLocale(),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Tabs
        current={status ?? ""}
        tabs={[
          { value: "", label: tc("all"), href: "/admin/reviews", count: countOf("PUBLISHED") + countOf("HIDDEN") },
          { value: "PUBLISHED", label: t("tabPublished"), href: "/admin/reviews?status=PUBLISHED", count: countOf("PUBLISHED") },
          { value: "HIDDEN", label: t("tabHidden"), href: "/admin/reviews?status=HIDDEN", count: countOf("HIDDEN") },
        ]}
      />
      <Card flush className="mt-4">
        {reviews.length === 0 ? (
          <EmptyState title={t("emptyTitle")} text={t("emptyText")} />
        ) : (
          <ul className="divide-y">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-x-6 gap-y-3 px-5 py-4">
                <div className="min-w-0 flex-1 basis-80">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Stars value={r.rating} />
                    <span className="font-medium">{r.user.name}</span>
                    <span className="text-muted-foreground">{t("on")} <Link href={`/products/${r.product.slug}`} className="underline underline-offset-4 hover:text-foreground">{r.product.name}</Link></span>
                    <span className="text-xs text-muted-foreground">{formatDate(r.createdAt, locale, "medium")}</span>
                  </div>
                  <p className={`mt-2 text-sm leading-relaxed ${r.status === "HIDDEN" ? "text-muted-foreground" : ""}`}>{r.comment}</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ToggleAction checked={r.status === "PUBLISHED"} action={toggle.bind(null, r.id)} label={t("publish", { name: r.user.name })} />
                    {r.status === "PUBLISHED" ? t("published") : t("hidden")}
                  </label>
                  <ConfirmAction action={deleteReview.bind(null, r.id)} title={t("confirmTitle")} description={t("confirmDescription")}>
                    <Trash2 aria-hidden /><span className="sr-only">{t("delete", { name: r.user.name })}</span>
                  </ConfirmAction>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
