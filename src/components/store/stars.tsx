import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} role="img" aria-label={`Note : ${value.toFixed(1).replace(".", ",")} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("size-3.5", i <= Math.round(value) ? "fill-foreground text-foreground" : "fill-transparent text-foreground/25")}
        />
      ))}
    </span>
  );
}
