import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { deletePromo, togglePromo } from "@/actions/admin/misc";
import { ConfirmAction, ToggleAction } from "@/components/admin/actions";
import { PromoForm } from "@/components/admin/small-forms";
import { Card, EmptyState, PageHeader, td, th } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Codes promo" };

export default async function PromosPage() {
  const [promos, { currency }] = await Promise.all([db.promoCode.findMany({ orderBy: { createdAt: "desc" } }), getSettings()]);
  const now = new Date();
  return (
    <>
      <PageHeader title="Codes promo" description="Réductions que vos clients saisissent dans leur panier." />
      <div className="grid gap-4 *:min-w-0 lg:grid-cols-[1fr_340px]">
        <Card flush>
          {promos.length === 0 ? (
            <EmptyState title="Aucun code promo" text="Créez un code pour une opération commerciale ou un geste envers un client." />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className={th}>Code</th>
                    <th className={th}>Réduction</th>
                    <th className={th}>Utilisations</th>
                    <th className={th}>Expiration</th>
                    <th className={th}>Actif</th>
                    <th className={cn(th, "w-0")}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {promos.map((p) => {
                    const expired = !!p.expiresAt && p.expiresAt < now;
                    return (
                      <tr key={p.id} className="hover:bg-muted/40">
                        <td className={td}>
                          <span className="font-mono text-[0.8125rem] font-medium">{p.code}</span>
                          {p.minSubtotalCents > 0 && <p className="text-xs text-muted-foreground">dès {formatPrice(p.minSubtotalCents, currency)} d'achat</p>}
                        </td>
                        <td className={cn(td, "tabular-nums")}>{p.type === "PERCENT" ? `${p.value} %` : formatPrice(p.value, currency)}</td>
                        <td className={cn(td, "tabular-nums")}>{p.usedCount}{p.maxUses != null && <span className="text-muted-foreground"> / {p.maxUses}</span>}</td>
                        <td className={cn(td, expired ? "text-destructive" : "text-muted-foreground")}>{p.expiresAt ? `${expired ? "Expiré le " : ""}${formatDate(p.expiresAt, "fr", "medium")}` : "Sans limite"}</td>
                        <td className={td}><ToggleAction checked={p.active} action={togglePromo.bind(null, p.id)} label={`Activer le code ${p.code}`} /></td>
                        <td className={td}>
                          <ConfirmAction action={deletePromo.bind(null, p.id)} title={`Supprimer le code ${p.code} ?`} description="Les clients ne pourront plus l'utiliser. Les commandes passées conservent leur réduction.">
                            <Trash2 aria-hidden /><span className="sr-only">Supprimer {p.code}</span>
                          </ConfirmAction>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Nouveau code" className="h-fit">
          <PromoForm currency={currency} />
        </Card>
      </div>
    </>
  );
}
