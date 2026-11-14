import { ORDER_STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

const tone: Record<string, string> = {
  PENDING: "bg-warning/12 text-warning",
  PAID: "bg-chart-3/12 text-chart-3",
  SHIPPED: "bg-brand/12 text-brand",
  DELIVERED: "bg-success/12 text-success",
  CANCELLED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

export function OrderStatus({ status }: { status: string }) {
  return <StatusBadge label={ORDER_STATUS_LABEL[status] ?? status} className={tone[status] ?? tone.CANCELLED} />;
}
