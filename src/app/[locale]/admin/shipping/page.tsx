import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteZone } from "@/actions/admin/shipping";
import { ConfirmAction } from "@/components/admin/actions";
import { ZoneForm } from "@/components/admin/small-forms";
import { Card, EmptyState, PageHeader, td, th } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Livraison" };

export default async function ShippingPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const [zones, settings] = await Promise.all([db.shippingZone.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }), getSettings()]);
  const editing = zones.find((z) => z.id === edit);
  const { currency, freeShippingThresholdCents: threshold } = settings;
  return (
    <>
      <PageHeader
        title="Livraison"
        description={`Le client choisit sa zone à la commande. ${threshold > 0 ? `La livraison est offerte dès ${formatPrice(threshold, currency)} d'achat, quelle que soit la zone` : "La livraison n'est jamais offerte"} (seuil modifiable dans les réglages).`}
      />
      <div className="grid gap-4 *:min-w-0 lg:grid-cols-[1fr_340px]">
        <Card flush>
          {zones.length === 0 ? (
            <EmptyState title="Aucune zone de livraison" text="Sans zone, personne ne peut commander. Créez-en une : un nom, un tarif et un délai suffisent." />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className={th}>Zone</th>
                    <th className={th}>Délai</th>
                    <th className={cn(th, "text-right")}>Tarif</th>
                    <th className={th}>État</th>
                    <th className={cn(th, "w-0")}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {zones.map((z, i) => (
                    <tr key={z.id} className={cn("hover:bg-muted/40", z.id === editing?.id && "bg-muted/60")}>
                      <td className={td}>
                        <p className="font-medium">{z.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {z.nameEn && z.nameMg ? `${z.nameEn}, ${z.nameMg}` : "Traduction incomplète : le nom français s'affiche à la place"}
                          {i === zones.findIndex((x) => x.active) && " (zone d'exemple sur l'accueil)"}
                        </p>
                      </td>
                      <td className={cn(td, "whitespace-nowrap tabular-nums")}>{z.minDays === z.maxDays ? `${z.maxDays} j` : `${z.minDays} à ${z.maxDays} j`}</td>
                      <td className={cn(td, "text-right whitespace-nowrap tabular-nums")}>{z.priceCents === 0 ? "Gratuite" : formatPrice(z.priceCents, currency)}</td>
                      <td className={cn(td, z.active ? "" : "text-muted-foreground")}>{z.active ? "Ouverte" : "Fermée"}</td>
                      <td className={td}>
                        <div className="flex justify-end gap-1">
                          <Link href={`/admin/shipping?edit=${z.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={`Modifier ${z.name}`}><Pencil aria-hidden /></Link>
                          <ConfirmAction action={deleteZone.bind(null, z.id)} title={`Supprimer « ${z.name} » ?`} description="Les commandes déjà passées gardent le nom de la zone. Pour suspendre la livraison sans supprimer, fermez plutôt la zone.">
                            <Trash2 aria-hidden /><span className="sr-only">Supprimer {z.name}</span>
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
        <Card title={editing ? `Modifier « ${editing.name} »` : "Nouvelle zone"} className="h-fit">
          <ZoneForm zone={editing} currency={currency} nextPosition={zones.length} />
        </Card>
      </div>
    </>
  );
}
