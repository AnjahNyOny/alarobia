"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ImageUploader({ initial }: { initial: string[] }) {
  const [images, setImages] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const MAX = 8;

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).slice(0, MAX - images.length);
    if (list.length === 0) return;
    setUploading(true);
    for (const file of list) {
      const body = new FormData();
      body.set("file", file);
      try {
        const res = await fetch("/api/admin/upload", { method: "POST", body });
        const json = await res.json();
        if (!res.ok) toast.error(`${file.name} : ${json.error ?? "envoi impossible"}`);
        else setImages((prev) => [...prev, json.url]);
      } catch {
        toast.error(`${file.name} : envoi impossible. Vérifiez votre connexion.`);
      }
    }
    setUploading(false);
  }

  const move = (i: number, dir: -1 | 1) =>
    setImages((prev) => {
      const next = [...prev];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });

  return (
    <div>
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      {images.length > 0 && (
        <ul className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((src, i) => (
            <li key={src} className="group relative aspect-[4/5] overflow-hidden rounded-lg border bg-muted">
              <Image src={src} alt={`Photo ${i + 1}`} fill sizes="160px" className="object-cover" />
              {i === 0 && <span className="absolute top-1.5 left-1.5 rounded bg-background/90 px-1.5 py-0.5 text-[0.6875rem] font-medium">Principale</span>}
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                <div className="flex gap-1">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Déplacer la photo ${i + 1} vers la gauche`} className="grid size-7 place-items-center rounded-md bg-background/90 hover:bg-background disabled:opacity-40">
                    <ArrowLeft className="size-3.5" aria-hidden />
                  </button>
                  <button type="button" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label={`Déplacer la photo ${i + 1} vers la droite`} className="grid size-7 place-items-center rounded-md bg-background/90 hover:bg-background disabled:opacity-40">
                    <ArrowRight className="size-3.5" aria-hidden />
                  </button>
                </div>
                <button type="button" onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} aria-label={`Retirer la photo ${i + 1}`} className="grid size-7 place-items-center rounded-md bg-background/90 text-destructive hover:bg-background">
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {images.length < MAX && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            upload(e.dataTransfer.files);
          }}
          disabled={uploading}
          className={cn("flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-7 text-sm transition-colors hover:bg-muted/60", dragging && "border-brand bg-brand/5")}
        >
          {uploading ? <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden /> : <ImagePlus className="size-5 text-muted-foreground" strokeWidth={1.6} aria-hidden />}
          <span className="font-medium">{uploading ? "Envoi en cours…" : "Ajouter des photos"}</span>
          <span className="text-[0.8125rem] text-muted-foreground">Glissez-les ici ou cliquez. JPG, PNG, WebP ou AVIF, 5 Mo max. Format portrait 4:5 conseillé.</span>
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => e.target.files && upload(e.target.files).then(() => (e.target.value = ""))} />
    </div>
  );
}
