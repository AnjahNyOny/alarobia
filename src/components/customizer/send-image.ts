import { MAX_UPLOAD_BYTES, scaleToFit, sniffType, type UploadError } from "@/lib/upload";

/**
 * Envoi d'une image par le client, et réduction des photos du vendeur (`reduceImage`). Le navigateur fait le gros
 * du travail avant d'envoyer : il écarte tout de suite un fichier qui n'est pas une photo, réduit l'image à 2048 px
 * (une photo de téléphone de 6 Mo en pèse alors quelques centaines de ko, ce qui compte en données mobiles) et
 * retire au passage les métadonnées, dont la position GPS. Le serveur recontrôle tout (`src/lib/upload.ts`).
 */
export type SendError = UploadError | "network";
export type SentImage = {
  name: string;
  url: string;
  width: number;
  height: number;
};

const UPLOAD_ERRORS: UploadError[] = ["missing", "tooLarge", "heic", "type", "dimensions", "rate"];

/**
 * Contenu d'un canevas en fichier. Rangé ici plutôt qu'avec le dessin (`texture.ts`), qui importe les polices de la
 * personnalisation : le back-office réduit ses photos avec ce module et ne doit pas les recevoir (`admin-fonts.test.ts`).
 */
export function canvasBlob(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg" | "image/webp", quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("export du canevas impossible"))), type, quality));
}

type Encoding = "image/png" | "image/jpeg" | "image/webp";
// Formats de sortie essayés dans l'ordre, selon le fichier reçu. Un PNG reste un PNG (logo, transparence) tant qu'il tient dans la limite.
const OUTPUTS: Record<"jpg" | "png" | "webp" | "heic", Encoding[]> = {
  jpg: ["image/jpeg"],
  heic: ["image/jpeg"],
  png: ["image/png", "image/webp", "image/jpeg"],
  webp: ["image/webp", "image/jpeg"],
};

/**
 * Photo prête à envoyer : contrôlée, réduite à 2048 px de grand côté et réencodée sous 4 Mo. Sert à l'image du client
 * et aux photos de produits du back-office (`admin/image-uploader.tsx`).
 */
export async function reduceImage(file: File): Promise<{ ok: true; blob: Blob } | { ok: false; error: UploadError }> {
  if (file.size === 0) return { ok: false, error: "missing" };
  const kind = sniffType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!kind) return { ok: false, error: "type" };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Safari sait lire le HEIC et le convertit ci-dessous ; ailleurs, on explique quoi faire.
    return { ok: false, error: kind === "heic" ? "heic" : "type" };
  }

  const { width, height } = scaleToFit(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "type" };
  try {
    for (const type of OUTPUTS[kind]) {
      ctx.clearRect(0, 0, width, height);
      if (type === "image/jpeg") {
        // Le JPEG n'a pas de transparence : fond blanc plutôt que noir.
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await canvasBlob(canvas, type, type === "image/png" ? undefined : 0.86);
      if (blob.size <= MAX_UPLOAD_BYTES) return { ok: true, blob };
    }
    return { ok: false, error: "tooLarge" };
  } catch {
    return { ok: false, error: "type" };
  } finally {
    bitmap.close();
  }
}

/** Envoie un fichier déjà prêt (image réduite, aperçu, fichier d'impression) et rend le nom que le serveur lui a donné. */
export async function sendBlob(blob: Blob): Promise<{ ok: true; image: SentImage } | { ok: false; error: SendError }> {
  const body = new FormData();
  body.set("file", blob, "image");
  try {
    const res = await fetch("/api/customizer/upload", { method: "POST", body });
    const data: unknown = await res.json().catch(() => null);
    if (res.ok && data && typeof data === "object" && "name" in data) return { ok: true, image: data as SentImage };
    const error = data && typeof data === "object" && "error" in data ? (data as { error: unknown }).error : null;
    return {
      ok: false,
      error: UPLOAD_ERRORS.find((e) => e === error) ?? "network",
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function sendImage(file: File) {
  const reduced = await reduceImage(file);
  return reduced.ok ? sendBlob(reduced.blob) : reduced;
}
