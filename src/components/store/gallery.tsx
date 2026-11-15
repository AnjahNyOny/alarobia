"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Photo carrée sur fond pierre, comme les cartes du catalogue ; les vignettes passent dessous. */
export function Gallery({ images, name }: { images: string[]; name: string }) {
  const t = useTranslations("product");
  const [index, setIndex] = useState(0);
  if (images.length === 0) return <div className="aspect-square rounded-sm bg-stone" />;
  return (
    <div className="grid gap-3">
      <div className="relative aspect-square overflow-hidden rounded-sm bg-stone">
        <Image key={images[index]} src={images[index]} alt={t("photoAlt", { name, n: index + 1 })} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      </div>
      {images.length > 1 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={t("photo", { n: i + 1, total: images.length })}
                aria-current={i === index ? "true" : undefined}
                className={cn("relative block size-16 overflow-hidden rounded-sm bg-stone sm:size-20", i === index ? "outline-2 outline-offset-2 outline-foreground" : "opacity-70 hover:opacity-100")}
              >
                <Image src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
