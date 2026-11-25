"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form";

/**
 * Retire une adresse de la lettre d'information, à la demande de la personne (le texte du pied de page promet une
 * désinscription « sur simple demande »). `deleteMany` : une adresse déjà retirée (deux onglets ouverts) n'est pas une erreur.
 */
export async function removeNewsletterSubscriber(id: string): Promise<FormState> {
  await requireAdmin();
  await db.newsletterSubscriber.deleteMany({ where: { id } });
  revalidatePath("/admin/newsletter");
  return { ok: true, message: (await getTranslations("admin.notices"))("newsletterRemoved") };
}
