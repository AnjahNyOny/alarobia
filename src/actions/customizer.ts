"use server";

import { stat } from "node:fs/promises";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { addCartLine, addResultState, designOf, readCartEntries } from "@/lib/cart";
import { CUSTOM_FILE, customizerOptions, isPrinted, parseDesign, sameDesign } from "@/lib/customization";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form";
import { clientIp, createRateLimiter } from "@/lib/upload";
import { uploadPath } from "@/lib/upload-dir";

// Trente ajouts personnalisés par adresse et par dizaine de minutes (une adresse peut être partagée par plusieurs clients mobiles).
const allow = createRateLimiter({ limit: 30, windowMs: 10 * 60_000 });

/** Le fichier a-t-il bien été enregistré par le point d'envoi ? Le nom seul ne prouve rien. */
async function uploaded(name: unknown): Promise<string | null> {
  if (typeof name !== "string" || !CUSTOM_FILE.test(name)) return null;
  try {
    return (await stat(uploadPath(name))).isFile() ? name : null;
  } catch {
    return null;
  }
}

/**
 * Ajoute au panier un article personnalisé. Le dessin est revalidé contre les réglages du produit ;
 * l'aperçu et le fichier d'impression ont déjà été envoyés par `/api/customizer/upload`, qui les a
 * contrôlés : on ne reçoit ici que leurs noms, vérifiés sur le disque. Le prix n'est pas calculé ici
 * mais à chaque lecture du panier, à partir du produit.
 */
export async function addCustomized(input: { productId: string; quantity: number; design: unknown; preview: string; print: string | null }): Promise<FormState> {
  const t = await getTranslations("customizer.errors");
  if (!allow(clientIp(await headers()))) return { error: t("rate") };

  const product = await db.product.findFirst({ where: { id: String(input.productId), status: "ACTIVE" } });
  const options = product && customizerOptions(product);
  if (!product || !options) return addResultState({ ok: false, reason: "unavailable" });

  const parsed = parseDesign(input.design, options);
  if (!parsed.ok) return { error: t(parsed.error) };
  const { design } = parsed;
  if (design.image && !(await uploaded(design.image))) return { error: t("image") };

  // Le même dessin déjà dans le panier : on augmente la quantité de sa ligne au lieu d'en créer une seconde.
  const inCart = (await readCartEntries()).flatMap((e) => (e.id === product.id && e.c ? [e.c] : []));
  const existing = inCart.length ? (await db.customization.findMany({ where: { id: { in: inCart }, productId: product.id } })).find((c) => sameDesign(designOf(c), design)) : undefined;
  if (existing) return addResultState(await addCartLine({ id: product.id, c: existing.id }, input.quantity));

  const preview = await uploaded(input.preview);
  const print = isPrinted(design) ? await uploaded(input.print) : null;
  if (!preview || (isPrinted(design) && !print)) return { error: t("files") };

  const created = await db.customization.create({ data: { productId: product.id, ...design, preview, print } });
  const result = await addCartLine({ id: product.id, c: created.id }, input.quantity);
  // Rien n'a été ajouté (stock, quantité maximale) : la ligne ne servirait à rien. Ses fichiers partent avec le nettoyage.
  if (!result.ok) await db.customization.delete({ where: { id: created.id } });
  return addResultState(result);
}
