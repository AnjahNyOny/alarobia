import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteCategory } from "@/actions/admin/products";
import { ConfirmAction } from "@/components/admin/actions";
import { CategoryForm } from "@/components/admin/small-forms";
import { Card, EmptyState, PageHeader, td, th } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Catégories" };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const categories = await db.category.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { products: true } } } });
  const editing = categories.find((c) => c.id === edit);
  return (
    <>
      <PageHeader title="Catégories" description="Elles structurent le menu et les filtres de la boutique." />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card flush>
          {categories.length === 0 ? (
            <EmptyState title="Aucune catégorie" text="Créez une première catégorie pour y ranger vos produits." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className={th}>Nom</th>
                    <th className={cn(th, "text-right")}>Produits</th>
                    <th className={cn(th, "text-right")}>Position</th>
                    <th className={cn(th, "w-0")}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {categories.map((c) => (
                    <tr key={c.id} className={cn("hover:bg-muted/40", c.id === editing?.id && "bg-muted/60")}>
                      <td className={td}>
                        <p className="font-medium">{c.name}</p>
                        <p className="max-w-md truncate text-xs text-muted-foreground">{c.description || "Sans description"}</p>
                      </td>
                      <td className={cn(td, "text-right tabular-nums")}>{c._count.products}</td>
                      <td className={cn(td, "text-right text-muted-foreground tabular-nums")}>{c.position}</td>
                      <td className={td}>
                        <div className="flex justify-end gap-1">
                          <Link href={`/admin/categories?edit=${c.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={`Modifier ${c.name}`}><Pencil aria-hidden /></Link>
                          <ConfirmAction action={deleteCategory.bind(null, c.id)} title={`Supprimer « ${c.name} » ?`} description="Une catégorie qui contient encore des produits ne peut pas être supprimée.">
                            <Trash2 aria-hidden /><span className="sr-only">Supprimer {c.name}</span>
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
        <Card title={editing ? `Modifier « ${editing.name} »` : "Nouvelle catégorie"} className="h-fit">
          <CategoryForm category={editing} />
        </Card>
      </div>
    </>
  );
}
