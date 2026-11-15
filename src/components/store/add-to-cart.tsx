"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { addToCart } from "@/actions/cart";
import { Button } from "@/components/ui/button";
import { useCartUI } from "./cart-context";
import { Stepper } from "./quantity";

export function AddToCart({ productId, stock, children }: { productId: string; stock: number; children?: React.ReactNode }) {
  const t = useTranslations("product");
  const [quantity, setQuantity] = useState(1);
  const [pending, start] = useTransition();
  const { setOpen } = useCartUI();
  const max = Math.min(stock, 10);

  if (stock === 0)
    return (
      <div className="flex gap-3">
        <Button size="xl" disabled className="flex-1">
          {t("soldOut")}
        </Button>
        {children}
      </div>
    );

  return (
    // À 320 px, le sélecteur de quantité, le bouton et le favori ne tiennent pas sur une ligne : le bouton passe dessous.
    <div className="flex flex-wrap gap-3">
      <Stepper value={quantity} max={max} onChange={setQuantity} disabled={pending} label={t("quantity")} />
      <Button
        size="xl"
        className="flex-1"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await addToCart(productId, quantity);
            if (res.error) toast.error(res.error);
            else setOpen(true);
          })
        }
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("add")}
      </Button>
      {children}
    </div>
  );
}
