"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { submitReview } from "@/actions/shop";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";
import { cn } from "@/lib/utils";

export function ReviewForm({ productId, initial }: { productId: string; initial?: { rating: number; comment: string } }) {
  const t = useTranslations("product");
  const [state, action] = useActionState(submitReview, {});
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  return (
    <Form action={action} className="grid gap-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />
      <fieldset>
        <legend className="text-sm font-medium">{t("yourRating")}</legend>
        <div className="mt-2 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} aria-label={t("stars", { n })} aria-pressed={rating === n} className="rounded p-0.5">
              <Star className={cn("size-6 transition-colors", n <= (hover || rating) ? "fill-foreground text-foreground" : "text-foreground/30")} strokeWidth={1.5} aria-hidden />
            </button>
          ))}
        </div>
        {state.fieldErrors?.rating && <p className="mt-1.5 text-sm text-destructive">{state.fieldErrors.rating}</p>}
      </fieldset>
      <Field as="textarea" label={t("yourReview")} name="comment" defaultValue={initial?.comment} error={state.fieldErrors?.comment} placeholder={t("placeholder")} required />
      <FormAlert state={state} />
      <div>
        <SubmitButton>{initial ? t("update") : t("publish")}</SubmitButton>
      </div>
    </Form>
  );
}
