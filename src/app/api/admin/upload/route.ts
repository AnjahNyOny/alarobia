import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await getUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Format accepté : JPG, PNG, WebP ou AVIF." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image trop lourde (5 Mo maximum)." }, { status: 413 });

  // Le nom est généré côté serveur : rien de ce que fournit le client n'atteint le système de fichiers.
  const name = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/uploads/${name}` });
}
