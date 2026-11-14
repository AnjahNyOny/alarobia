"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { invalid, type FormState } from "@/lib/form";
import { zoneSchema } from "@/lib/schemas";

/** Vrai si une autre zone que celle-ci est encore ouverte : la boutique doit toujours pouvoir livrer quelque part. */
async function anotherActiveZone(id: string | null) {
  return (await db.shippingZone.count({ where: { active: true, NOT: id ? { id } : undefined } })) > 0;
}

const LAST_ZONE = "C'est la seule zone ouverte : sans elle, plus personne ne pourrait commander. Ouvrez-en une autre d'abord.";

export async function saveZone(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = zoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;
  if (id && !data.active && !(await anotherActiveZone(id))) return { error: LAST_ZONE };
  const clash = await db.shippingZone.findFirst({ where: { name: data.name, NOT: id ? { id } : undefined } });
  if (clash) return { fieldErrors: { name: "Une zone porte déjà ce nom." } };
  if (id) await db.shippingZone.update({ where: { id }, data });
  else await db.shippingZone.create({ data });
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "Zone modifiée." : "Zone créée." };
}

export async function deleteZone(id: string): Promise<FormState> {
  await requireAdmin();
  const zone = await db.shippingZone.findUnique({ where: { id } });
  if (!zone) return { error: "Zone introuvable." };
  if (zone.active && !(await anotherActiveZone(id))) return { error: LAST_ZONE };
  // Les commandes gardent le nom de la zone en copie : la suppression ne touche pas l'historique.
  await db.shippingZone.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Zone supprimée." };
}
