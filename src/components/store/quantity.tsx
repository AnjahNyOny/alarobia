"use client";

import { useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { setCartQuantity } from "@/actions/cart";
import { cn } from "@/lib/utils";

export function Stepper({
  value,
  max,
  onChange,
  disabled,
  size = "md",
  label,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  label: string;
}) {
  const btn = cn(
    "grid place-items-center text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-35",
    size === "sm" ? "size-8" : "size-12"
  );
  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center rounded-lg border border-input bg-card", disabled && "opacity-60")}>
      <button type="button" className={cn(btn, "rounded-l-lg")} onClick={() => onChange(value - 1)} disabled={disabled || value <= 1} aria-label="Diminuer la quantité">
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span aria-live="polite" className={cn("text-center text-sm font-medium tabular-nums", size === "sm" ? "w-7" : "w-9")}>
        {value}
      </span>
      <button type="button" className={cn(btn, "rounded-r-lg")} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Augmenter la quantité">
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

export function CartLineControls({ productId, quantity, max, name }: { productId: string; quantity: number; max: number; name: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <Stepper size="sm" value={quantity} max={max} disabled={pending} label={`Quantité pour ${name}`} onChange={(q) => start(() => setCartQuantity(productId, q))} />
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => setCartQuantity(productId, 0))}
        className="text-[0.8125rem] text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Retirer<span className="sr-only"> {name}</span>
      </button>
    </div>
  );
}
