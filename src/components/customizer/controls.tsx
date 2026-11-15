"use client";

import { useId, useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { addCustomized } from "@/actions/customizer";
import { AddToCart } from "@/components/store/add-to-cart";
import { useCartUI } from "@/components/store/cart-context";
import { Stepper } from "@/components/store/quantity";
import { Button } from "@/components/ui/button";
import { cleanText, COLOR_KEYS, COLORS, FONTS, inkFor, inkReadable, isPrinted, textLength, type ColorKey, type Design } from "@/lib/customization";
import { MAX_UPLOAD_BYTES } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useCustomizer } from "./customizer-context";
import { fontStyle } from "./fonts";
import { sendBlob, sendImage, type SendError } from "./send-image";
import { canvasBlob, ensureFont, loadImage, paintFlat, paintZone } from "./texture";

/**
 * Colonne de droite de la fiche d'un produit personnalisable. Onglet « Photos » : l'achat habituel et une
 * invitation à personnaliser. Onglet « Personnaliser » : les réglages, tous de vrais champs de formulaire.
 */
const STONE = "#f3f2ee"; // fond des vignettes, comme les photos du catalogue

function Swatches({ legend, name, colors, value, onChange, small }: { legend: string; name: string; colors: readonly ColorKey[]; value: ColorKey; onChange: (color: ColorKey) => void; small?: boolean }) {
  const t = useTranslations("customizer");
  return (
    <fieldset className="min-w-0">
      <legend className="display-sm text-lg">
        {legend} <span className="font-sans text-base font-normal text-muted-foreground [font-stretch:100%]">{t(`colors.${value}`)}</span>
      </legend>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        {colors.map((color) => (
          <label key={color} className="relative">
            <input type="radio" name={name} value={color} checked={value === color} onChange={() => onChange(color)} className="peer sr-only" />
            <span
              className={cn(
                "block rounded-full border border-foreground/25 peer-checked:outline-3 peer-checked:outline-offset-3 peer-checked:outline-foreground peer-focus-visible:ring-4 peer-focus-visible:ring-ring/40",
                small ? "size-9" : "size-12",
              )}
              style={{ background: COLORS[color] }}
            />
            <span className="sr-only">{t(`colors.${color}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input id={id} type="range" min={0} max={100} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full min-w-0 accent-brand" />
    </div>
  );
}

export function BuyBox({ productId, stock, surcharge, total, children }: { productId: string; stock: number; surcharge: string; total: string; children?: React.ReactNode }) {
  const { options, mode, setMode, design, change } = useCustomizer()!;
  const t = useTranslations("customizer");
  const tp = useTranslations("product");
  const { setOpen } = useCartUI();
  const [quantity, setQuantity] = useState(1);
  const [pending, start] = useTransition();
  const [sending, setSending] = useState(false);
  const [imageError, setImageError] = useState<SendError | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const textId = useId();

  if (mode === "photos")
    return (
      <div className="grid gap-4">
        <AddToCart productId={productId} stock={stock}>
          {children}
        </AddToCart>
        {stock > 0 && (
          <button type="button" onClick={() => setMode("custom")} className="rounded-sm bg-highlight px-4 py-3 text-left text-highlight-foreground">
            <span className="display-sm block text-xl">{t("invite.title")}</span>
            <span className="text-sm">{options.surchargeCents > 0 ? t("invite.text", { surcharge }) : t("invite.textFree")}</span>
          </button>
        )}
      </div>
    );

  const text = cleanText(design.text);
  const count = textLength(text);
  const printed = isPrinted({ text, image: design.image });
  const sample = text || t("fontSample");
  const inks = COLOR_KEYS.filter((ink) => inkReadable(ink, design.color));

  const pick = async (chosen: File | undefined) => {
    if (!chosen) return;
    setImageError(null);
    setSending(true);
    const sent = await sendImage(chosen);
    setSending(false);
    if (file.current) file.current.value = "";
    if (sent.ok) change({ image: sent.image.name });
    else setImageError(sent.error);
  };

  const add = () =>
    start(async () => {
      const final: Design = { ...design, text };
      try {
        const image = final.image ? await loadImage(`/uploads/${final.image}`) : null;
        await ensureFont(final.font, final.text);
        const canvas = document.createElement("canvas");
        paintFlat(canvas, options.template, final, image, 640, STONE);
        const preview = await sendBlob(await canvasBlob(canvas, "image/jpeg", 0.86));
        if (!preview.ok) return void toast.error(t(`upload.${preview.error}`));

        let print: string | null = null;
        if (printed) {
          // Le fichier d'impression est un PNG à fond transparent ; une photo très détaillée peut dépasser la limite d'envoi, on réduit alors.
          for (const side of [undefined, 1200, 900]) {
            paintZone(canvas, options.template, final, image, side);
            const blob = await canvasBlob(canvas, "image/png");
            if (blob.size > MAX_UPLOAD_BYTES) continue;
            const sent = await sendBlob(blob);
            if (!sent.ok) return void toast.error(t(`upload.${sent.error}`));
            print = sent.image.name;
            break;
          }
          if (!print) return void toast.error(t("upload.tooLarge"));
        }
        const res = await addCustomized({
          productId,
          quantity,
          design: final,
          preview: preview.image.name,
          print,
        });
        if (res.error) toast.error(res.error);
        else setOpen(true);
      } catch {
        toast.error(t("upload.network"));
      }
    });

  return (
    <div className="grid gap-7">
      <Swatches legend={t("color")} name="couleur" colors={options.colors} value={design.color} onChange={(color) => change({ color, ink: inkFor(color, design.ink) })} />

      {options.textMax > 0 && (
        <div className="grid gap-4">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={textId} className="display-sm text-lg">
                {t("text")}
              </label>
              <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                {t("counter", { count, max: options.textMax })}
              </span>
            </div>
            <input
              id={textId}
              type="text"
              value={design.text}
              autoComplete="off"
              enterKeyHint="done"
              placeholder={t("textPlaceholder")}
              onChange={(e) => textLength(cleanText(e.target.value)) <= options.textMax && change({ text: e.target.value })}
              className="display-sm mt-2 h-14 w-full min-w-0 rounded-md border-2 border-foreground bg-card px-3.5 text-2xl outline-none placeholder:text-muted-foreground/70 focus-visible:ring-4 focus-visible:ring-ring/30"
            />
          </div>

          {text && (
            <>
              <fieldset className="min-w-0">
                <legend className="display-sm text-lg">{t("font")}</legend>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {FONTS.map((font) => (
                    <label key={font} className="relative min-w-0">
                      <input type="radio" name="police" value={font} checked={design.font === font} onChange={() => change({ font })} className="peer sr-only" />
                      <span className="flex h-14 items-center justify-center overflow-hidden rounded-md border border-input px-2 text-xl peer-checked:border-2 peer-checked:border-foreground peer-checked:bg-stone peer-focus-visible:ring-4 peer-focus-visible:ring-ring/40">
                        <span aria-hidden className="truncate" style={fontStyle(font)}>
                          {sample}
                        </span>
                        <span className="sr-only">{t(`fonts.${font}`)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Swatches legend={t("ink")} name="encre" colors={inks} value={design.ink} onChange={(ink) => change({ ink })} small />
              <div>
                <Slider label={t("textSize")} value={design.textSize} onChange={(textSize) => change({ textSize })} />
                <Slider label={t("textY")} value={design.textY} onChange={(textY) => change({ textY })} />
              </div>
            </>
          )}
        </div>
      )}

      {options.allowImage && (
        <div>
          <p className="display-sm text-lg">{t("image")}</p>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" aria-label={t("imageAdd")} className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            {design.image && (
              // eslint-disable-next-line @next/next/no-img-element -- fichier envoyé à l'instant, déjà réduit ; pas besoin de l'optimiseur d'images
              <img src={`/uploads/${design.image}`} alt={t("imageYours")} className="size-14 rounded-sm border bg-stone object-contain" />
            )}
            <Button type="button" variant="outline" size="xl" disabled={sending} onClick={() => file.current?.click()}>
              {sending ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
              {sending ? t("imageSending") : design.image ? t("imageReplace") : t("imageAdd")}
            </Button>
            {design.image && (
              <Button type="button" variant="ghost" size="xl" onClick={() => change({ image: null })}>
                <Trash2 aria-hidden />
                {t("imageRemove")}
              </Button>
            )}
          </div>
          {imageError ? (
            <p role="alert" className="mt-2.5 border-l-4 border-destructive pl-3 text-sm font-medium text-destructive">
              {t(`upload.${imageError}`)}
            </p>
          ) : (
            !design.image && <p className="mt-2 text-sm text-muted-foreground">{t("imageHint")}</p>
          )}
          {design.image && (
            <div className="mt-3">
              <Slider label={t("imageSize")} value={design.imageSize} onChange={(imageSize) => change({ imageSize })} />
              <Slider label={t("imageX")} value={design.imageX} onChange={(imageX) => change({ imageX })} />
              <Slider label={t("imageY")} value={design.imageY} onChange={(imageY) => change({ imageY })} />
            </div>
          )}
        </div>
      )}

      <div className="border-t-2 border-foreground pt-5">
        {printed && options.surchargeCents > 0 && (
          <p className="mb-3 flex items-baseline justify-between gap-4">
            <span>{t("surcharge", { surcharge })}</span>
            <span className="display-sm text-2xl tabular-nums">{total}</span>
          </p>
        )}
        {stock === 0 ? (
          <Button size="xl" disabled className="w-full">
            {tp("soldOut")}
          </Button>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Stepper value={quantity} max={Math.min(stock, 10)} onChange={setQuantity} disabled={pending} label={tp("quantity")} />
            <Button size="xl" className="flex-1" disabled={pending || sending} onClick={add}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {tp("add")}
            </Button>
          </div>
        )}
        {printed && <p className="mt-3 text-sm text-muted-foreground">{t("noReturn")}</p>}
        <button type="button" onClick={() => setMode("photos")} className="mt-3 text-sm font-medium underline underline-offset-4">
          {t("backToPhotos")}
        </button>
      </div>
    </div>
  );
}
