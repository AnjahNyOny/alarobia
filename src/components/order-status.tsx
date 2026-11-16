import { useTranslations } from "next-intl";
import { ORDER_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const tone: Record<string, string> = {
  PENDING: "bg-warning/12 text-warning",
  // Fond à 10 % : à 12 %, le bleu chart-3 tombe à 4,43:1 (sous le seuil AA de 4,5:1).
  PAID: "bg-chart-3/10 text-chart-3",
  SHIPPED: "bg-brand/12 text-brand",
  DELIVERED: "bg-success/12 text-success",
  CANCELLED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

export function OrderStatus({ status }: { status: string }) {
  const t = useTranslations("status");
  const known = (ORDER_STATUSES as readonly string[]).includes(status);
  return <StatusBadge label={known ? t(status as (typeof ORDER_STATUSES)[number]) : status} className={tone[status] ?? tone.CANCELLED} />;
}
