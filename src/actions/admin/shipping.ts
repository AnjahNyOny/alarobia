"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { invalid, type FormState } from "@/lib/form";
import { zoneSchema } from "@/lib/schemas";

/** Vrai si une autre zone que celle-ci est encore ouverte : la boutique doit toujours pouvoir livrer quelque part. */
async function anotherActiveZone(id: string | null) {
  return (await db.shippingZone.count({ where: { active: true, NOT: id ? { id } : undefined } })) > 0;
}

export async function saveZone(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const [t, tn] = await Promise.all([getTranslations("admin.errors"), getTranslations("admin.notices")]);
  const parsed = zoneSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, t("formInvalid"));
  const data = parsed.data;
  if (id && !data.active && !(await anotherActiveZone(id))) return { error: t("lastZone") };
  const clash = await db.shippingZone.findFirst({ where: { name: data.name, NOT: id ? { id } : undefined } });
  if (clash) return { fieldErrors: { name: t("zoneTaken") } };
  if (id) await db.shippingZone.update({ where: { id }, data });
  else await db.shippingZone.create({ data });
  revalidatePath("/", "layout");
  return { ok: true, message: id ? tn("zoneUpdated") : tn("zoneCreated") };
}

export async function deleteZone(id: string): Promise<FormState> {
  await requireAdmin();
  const [t, tn] = await Promise.all([getTranslations("admin.errors"), getTranslations("admin.notices")]);
  const zone = await db.shippingZone.findUnique({ where: { id } });
  if (!zone) return { error: t("zoneNotFound") };
  if (zone.active && !(await anotherActiveZone(id))) return { error: t("lastZone") };
  // Les commandes gardent le nom de la zone en copie : la suppression ne touche pas l'historique.
  await db.shippingZone.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true, message: tn("zoneDeleted") };
}
