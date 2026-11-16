import { mkdir, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { checkUpload, customFileName, MAX_UPLOAD_BYTES, type UploadError } from "@/lib/upload";
import { uploadDir, uploadPath } from "@/lib/upload-dir";

/**
 * Envoi d'une image par un visiteur, pour la personnaliser sur un objet. Point d'envoi public :
 * tout est contrôlé ici (`src/lib/upload.ts`), le navigateur ne fait que gagner du temps.
 * La réponse porte un motif (`error`) que l'interface traduit dans la langue du visiteur.
 */

// Soixante envois par adresse et par dizaine de minutes. Chaque ajout au panier en fait deux (aperçu et fichier d'impression),
// et les opérateurs mobiles font sortir beaucoup de clients par la même adresse : une limite plus basse gênerait des acheteurs.
// Au pire, une adresse remplit 300 Mo en dix minutes ; le nettoyage hebdomadaire les reprend. À ajuster avec le trafic réel.
const allow = createRateLimiter({ limit: 60, windowMs: 10 * 60_000 });

const STATUS: Record<UploadError, number> = { missing: 400, tooLarge: 413, heic: 415, type: 415, dimensions: 422, rate: 429 };
const refuse = (error: UploadError) => NextResponse.json({ error }, { status: STATUS[error] });

export async function POST(req: Request) {
  if (!allow(clientIp(req.headers))) return refuse("rate");

  // Un corps annoncé trop gros est refusé sans être lu (l'enveloppe du formulaire pèse quelques centaines d'octets).
  const announced = Number(req.headers.get("content-length"));
  if (announced > MAX_UPLOAD_BYTES + 64 * 1024) return refuse("tooLarge");

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return refuse("missing");
  }
  if (!(file instanceof File)) return refuse("missing");
  if (file.size > MAX_UPLOAD_BYTES) return refuse("tooLarge");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkUpload(bytes);
  if (!checked.ok) return refuse(checked.error);

  // Ni le nom ni le type annoncés par le navigateur ne servent : l'extension vient du contenu, le nom est généré.
  const name = customFileName(checked.ext);
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(uploadPath(name), bytes);
  return NextResponse.json({ name, url: `/uploads/${name}`, width: checked.width, height: checked.height });
}
