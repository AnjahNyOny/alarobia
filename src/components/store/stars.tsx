import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function Stars({ value, className }: { value: number; className?: string }) {
  const t = useTranslations("card");
  return (
    <span className={cn("inline-flex gap-0.5", className)} role="img" aria-label={t("rating", { value: value.toFixed(1).replace(".", ",") })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={cn("size-3.5", i <= Math.round(value) ? "fill-foreground text-foreground" : "fill-transparent text-foreground/30")} />
      ))}
    </span>
  );
}
