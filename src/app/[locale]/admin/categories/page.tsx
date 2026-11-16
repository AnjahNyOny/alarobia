import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteCategory } from "@/actions/admin/products";
import { ConfirmAction } from "@/components/admin/actions";
import { CategoryForm } from "@/components/admin/small-forms";
import { Card, EmptyState, PageHeader, td, th } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { CATEGORY_FIELDS, untranslatedFields } from "@/lib/localize";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.categories");
  return { title: t("metaTitle") };
}

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const [categories, t, tc] = await Promise.all([
    db.category.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { products: true } }, translations: true } }),
    getTranslations("admin.categories"),
    getTranslations("admin.common"),
  ]);
  // Langues où un champ rempli en français n'est pas traduit (même règle que la liste des produits).
  const toTranslate = (c: (typeof categories)[number]) => (["en", "mg"] as const).filter((l) => untranslatedFields(c, c.translations.find((tr) => tr.locale === l), CATEGORY_FIELDS).length > 0);
  const editing = categories.find((c) => c.id === edit);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-4 *:min-w-0 lg:grid-cols-[1fr_340px]">
        <Card flush>
          {categories.length === 0 ? (
            <EmptyState title={t("emptyTitle")} text={t("emptyText")} />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className={th}>{t("colName")}</th>
                    <th className={cn(th, "text-right")}>{t("colProducts")}</th>
                    <th className={cn(th, "text-right")}>{t("colPosition")}</th>
                    <th className={cn(th, "w-0")}><span className="sr-only">{tc("actions")}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {categories.map((c) => (
                    <tr key={c.id} className={cn("hover:bg-muted/40", c.id === editing?.id && "bg-muted/60")}>
                      <td className={td}>
                        <p className="font-medium">{c.name}</p>
                        <p className="max-w-md truncate text-xs text-muted-foreground">{c.description || t("noDescription")}</p>
                        {toTranslate(c).length > 0 && <p className="text-xs text-warning">{tc("toTranslate", { languages: toTranslate(c).join(", ") })}</p>}
                      </td>
                      <td className={cn(td, "text-right tabular-nums")}>{c._count.products}</td>
                      <td className={cn(td, "text-right text-muted-foreground tabular-nums")}>{c.position}</td>
                      <td className={td}>
                        <div className="flex justify-end gap-1">
                          <Link href={`/admin/categories?edit=${c.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={t("edit", { name: c.name })}><Pencil aria-hidden /></Link>
                          <ConfirmAction action={deleteCategory.bind(null, c.id)} title={t("confirmTitle", { name: c.name })} description={t("confirmDescription")}>
                            <Trash2 aria-hidden /><span className="sr-only">{t("delete", { name: c.name })}</span>
                          </ConfirmAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title={editing ? t("editTitle", { name: editing.name }) : t("newTitle")} className="h-fit">
          <CategoryForm category={editing} />
        </Card>
      </div>
    </>
  );
}
