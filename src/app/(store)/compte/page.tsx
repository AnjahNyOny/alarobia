import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { OrderStatus } from "@/components/order-status";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export default async function AccountOrdersPage() {
  const user = await requireUser();
  const [orders, { currency }] = await Promise.all([db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { items: true } } } }), getSettings()]);

  if (orders.length === 0)
    return (
      <div className="grid justify-items-start gap-3 rounded-lg border border-dashed p-8">
        <h2 className="text-lg font-medium">Aucune commande pour l'instant</h2>
        <p className="text-muted-foreground">Vos commandes et leur suivi apparaîtront ici.</p>
        <Link href="/produits" className={buttonVariants({ size: "md" })}>
          Découvrir la boutique
        </Link>
      </div>
    );

  return (
    <>
      <h2 className="text-lg font-medium">Mes commandes</h2>
      <ul className="mt-4 divide-y border-y">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/compte/commandes/${o.id}`} className="group -mx-3 flex items-center gap-4 rounded-lg px-3 py-4 transition-colors hover:bg-muted/60">
              <div className="grid flex-1 gap-1 sm:grid-cols-[1.2fr_1fr_auto] sm:items-center sm:gap-4">
                <div>
                  <p className="font-medium">{o.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(o.createdAt)} · {o._count.items} article{o._count.items > 1 ? "s" : ""}
                  </p>
                </div>
                <div>
                  <OrderStatus status={o.status} />
                </div>
                <p className="font-medium tabular-nums sm:text-right">{formatPrice(o.totalCents, currency)}</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
