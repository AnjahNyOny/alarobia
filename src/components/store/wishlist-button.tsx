"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleWishlist } from "@/actions/shop";
import { cn } from "@/lib/utils";

export function WishlistButton({ productId, active, name, variant = "card" }: { productId: string; active: boolean; name: string; variant?: "card" | "page" }) {
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? `Retirer ${name} des favoris` : `Ajouter ${name} aux favoris`}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          const res = await toggleWishlist(productId);
          if (res.error) toast.error(res.error);
        })
      }
      className={cn(
        "grid place-items-center transition-colors",
        variant === "card"
          ? "absolute top-2.5 right-2.5 z-10 size-9 rounded-full bg-background/90 text-foreground opacity-100 hover:bg-background md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:aria-pressed:opacity-100"
          : "size-12 shrink-0 rounded-lg border border-input bg-card hover:bg-muted"
      )}
    >
      <Heart className={cn("size-[1.125rem]", optimistic && "fill-sale text-sale")} strokeWidth={1.6} aria-hidden />
    </button>
  );
}
