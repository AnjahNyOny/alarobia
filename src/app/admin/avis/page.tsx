import type { Metadata } from "next";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deleteReview, setReviewStatus } from "@/actions/admin/misc";
import { ConfirmAction, ToggleAction } from "@/components/admin/actions";
import { Card, EmptyState, PageHeader, Tabs } from "@/components/admin/ui";
import { Stars } from "@/components/store/stars";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Avis" };

async function toggle(id: string, published: boolean) {
  "use server";
  await setReviewStatus(id, published ? "PUBLISHED" : "HIDDEN");
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut } = await searchParams;
  const status = statut === "HIDDEN" || statut === "PUBLISHED" ? statut : undefined;
  const [reviews, counts] = await Promise.all([
    db.review.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 60, include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } } }),
    db.review.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return (
    <>
      <PageHeader title="Avis clients" description="Masquez un avis inapproprié sans le supprimer : il disparaît de la fiche et de la note moyenne." />
      <Tabs
        current={status ?? ""}
        tabs={[
          { value: "", label: "Tous", href: "/admin/avis", count: countOf("PUBLISHED") + countOf("HIDDEN") },
          { value: "PUBLISHED", label: "Publiés", href: "/admin/avis?statut=PUBLISHED", count: countOf("PUBLISHED") },
          { value: "HIDDEN", label: "Masqués", href: "/admin/avis?statut=HIDDEN", count: countOf("HIDDEN") },
        ]}
      />
      <Card flush className="mt-4">
        {reviews.length === 0 ? (
          <EmptyState title="Aucun avis" text="Les avis laissés par vos clients apparaîtront ici." />
        ) : (
          <ul className="divide-y">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-x-6 gap-y-3 px-5 py-4">
                <div className="min-w-0 flex-1 basis-80">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Stars value={r.rating} />
                    <span className="font-medium">{r.user.name}</span>
                    <span className="text-muted-foreground">sur <Link href={`/produits/${r.product.slug}`} className="underline underline-offset-4 hover:text-foreground">{r.product.name}</Link></span>
                    <span className="text-xs text-muted-foreground">{formatDate(r.createdAt, { dateStyle: "medium" })}</span>
                  </div>
                  <p className={`mt-2 text-sm leading-relaxed ${r.status === "HIDDEN" ? "text-muted-foreground" : ""}`}>{r.comment}</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ToggleAction checked={r.status === "PUBLISHED"} action={toggle.bind(null, r.id)} label={`Publier l'avis de ${r.user.name}`} />
                    {r.status === "PUBLISHED" ? "Publié" : "Masqué"}
                  </label>
                  <ConfirmAction action={deleteReview.bind(null, r.id)} title="Supprimer cet avis ?" description="Cette action est définitive. Pour le retirer temporairement, masquez-le plutôt.">
                    <Trash2 aria-hidden /><span className="sr-only">Supprimer l'avis de {r.user.name}</span>
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
