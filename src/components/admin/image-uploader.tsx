"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { reduceImage } from "@/components/customizer/send-image";
import { MAX_UPLOAD_BYTES } from "@/lib/upload";
import { cn } from "@/lib/utils";

/** Codes renvoyés par /api/admin/upload, traduits dans `admin.photos.errors`. */
const UPLOAD_ERRORS = ["forbidden", "missing", "type", "tooLarge"] as const;
type UploadErrorCode = (typeof UPLOAD_ERRORS)[number];
const isUploadError = (code: unknown): code is UploadErrorCode => (UPLOAD_ERRORS as readonly unknown[]).includes(code);

export function ImageUploader({ initial }: { initial: string[] }) {
  const t = useTranslations("admin.photos");
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
      try {
        // Photo réduite à 2048 px dans le navigateur, comme l'image d'un client : une photo de téléphone de 8 Mo passe sous la limite d'envoi.
        // Ce que le navigateur ne sait pas réduire (AVIF, HEIC hors Safari, fichier qui n'est pas une image) part tel quel s'il tient
        // dans la limite, et le serveur tranche ; au-delà, l'hébergeur le refuserait sans explication, on s'arrête ici.
        const reduced = await reduceImage(file);
        if (!reduced.ok && file.size > MAX_UPLOAD_BYTES) {
          // Un HEIC que le navigateur ne lit pas (hors Safari) serait refusé pour son format même allégé : c'est ce qu'il faut dire.
          toast.error(t("failed", { file: file.name, error: t(reduced.error === "heic" ? "errors.type" : "errors.tooLarge") }));
          continue;
        }
        const body = new FormData();
        body.set("file", reduced.ok ? reduced.blob : file, file.name);
        const res = await fetch("/api/admin/upload", { method: "POST", body });
        const json = await res.json();
        if (!res.ok) toast.error(t("failed", { file: file.name, error: isUploadError(json.code) ? t(`errors.${json.code}`) : t("errors.unknown") }));
        else setImages((prev) => [...prev, json.url]);
      } catch {
        toast.error(t("offline", { file: file.name }));
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
              <Image src={src} alt={t("photo", { n: i + 1 })} fill sizes="160px" className="object-cover" />
              {i === 0 && <span className="absolute top-1.5 left-1.5 rounded bg-background/90 px-1.5 py-0.5 text-[0.6875rem] font-medium">{t("main")}</span>}
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                <div className="flex gap-1">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("moveLeft", { n: i + 1 })} className="grid size-7 place-items-center rounded-md bg-background/90 hover:bg-background disabled:opacity-40">
                    <ArrowLeft className="size-3.5" aria-hidden />
                  </button>
                  <button type="button" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label={t("moveRight", { n: i + 1 })} className="grid size-7 place-items-center rounded-md bg-background/90 hover:bg-background disabled:opacity-40">
                    <ArrowRight className="size-3.5" aria-hidden />
                  </button>
                </div>
                <button type="button" onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} aria-label={t("remove", { n: i + 1 })} className="grid size-7 place-items-center rounded-md bg-background/90 text-destructive hover:bg-background">
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
          <span className="font-medium">{uploading ? t("uploading") : t("add")}</span>
          <span className="text-[0.8125rem] text-muted-foreground">{t("hint")}</span>
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => e.target.files && upload(e.target.files).then(() => (e.target.value = ""))} />
    </div>
  );
}
