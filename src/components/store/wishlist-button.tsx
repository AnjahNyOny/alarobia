"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { toggleWishlist } from "@/actions/shop";
import { cn } from "@/lib/utils";

export function WishlistButton({ productId, active, name, variant = "card" }: { productId: string; active: boolean; name: string; variant?: "card" | "page" }) {
  const t = useTranslations("card");
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? t("removeWish", { name }) : t("addWish", { name })}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          const res = await toggleWishlist(productId);
          if (res.error) toast.error(res.error);
        })
      }
      className={cn(
        "grid place-items-center transition-colors",
        variant === "card" ? "absolute top-2 right-2 z-10 size-9 rounded-full bg-background text-foreground hover:bg-muted" : "size-12 shrink-0 rounded-md border border-input bg-card hover:bg-muted"
      )}
    >
      <Heart className={cn("size-[1.125rem]", optimistic && "fill-brand text-brand")} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
