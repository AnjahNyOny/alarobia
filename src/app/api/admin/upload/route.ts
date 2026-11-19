import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { saveUpload } from "@/lib/storage";
import { checkAdminUpload, IMAGE_MIME, MAX_UPLOAD_BYTES, type AdminUploadError } from "@/lib/upload";

const REFUSED: Record<AdminUploadError, { error: string; status: number }> = {
  missing: { error: "Aucun fichier reçu.", status: 400 },
  type: { error: "Format accepté : JPG, PNG, WebP ou AVIF.", status: 415 },
  tooLarge: { error: "Image trop lourde (4 Mo maximum).", status: 413 },
};
const refuse = (code: AdminUploadError) => NextResponse.json({ error: REFUSED[code].error, code }, { status: REFUSED[code].status });

/**
 * `code` est traduit par le navigateur (`admin.photos.errors`) ; `error` garde le texte français
 * pour qui appelle la route sans passer par l'interface.
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé.", code: "forbidden" }, { status: 403 });

  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return refuse("missing");
  if (file.size > MAX_UPLOAD_BYTES) return refuse("tooLarge");

  // Le type annoncé par le navigateur (`file.type`) ne sert pas : le format et l'extension viennent du contenu.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkAdminUpload(bytes);
  if (!checked.ok) return refuse(checked.error);

  // Le nom est généré côté serveur : rien de ce que fournit le client n'atteint le stockage.
  const name = `${randomUUID()}.${checked.ext}`;
  await saveUpload(name, bytes, IMAGE_MIME[checked.ext]);
  return NextResponse.json({ url: `/uploads/${name}` });
}
