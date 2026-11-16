import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { uploadDir, uploadPath } from "@/lib/upload-dir";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * `code` est traduit par le navigateur (`admin.photos.errors`) ; `error` garde le texte français
 * pour qui appelle la route sans passer par l'interface.
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé.", code: "forbidden" }, { status: 403 });

  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu.", code: "missing" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Format accepté : JPG, PNG, WebP ou AVIF.", code: "type" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image trop lourde (5 Mo maximum).", code: "tooLarge" }, { status: 413 });

  // Le nom est généré côté serveur : rien de ce que fournit le client n'atteint le système de fichiers.
  const name = `${randomUUID()}.${ext}`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(uploadPath(name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/uploads/${name}` });
}
