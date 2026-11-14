"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) return <div className="aspect-[4/5] rounded-lg bg-muted" />;
  return (
    <div className="grid gap-3 md:grid-cols-[72px_1fr]">
      {images.length > 1 && (
        <ul className="order-last flex gap-2.5 md:order-first md:flex-col">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Afficher la photo ${i + 1} sur ${images.length}`}
                aria-current={i === index ? "true" : undefined}
                className={cn("relative block aspect-[4/5] w-16 overflow-hidden rounded-md bg-muted ring-offset-2 ring-offset-background transition md:w-full", i === index ? "ring-1 ring-foreground" : "opacity-70 hover:opacity-100")}
              >
                <Image src={src} alt="" fill sizes="72px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={cn("relative aspect-[4/5] overflow-hidden rounded-lg bg-muted", images.length === 1 && "md:col-span-2")}>
        <Image key={images[index]} src={images[index]} alt={`${name}, photo ${index + 1}`} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      </div>
    </div>
  );
}
