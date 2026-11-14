"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { invalid, type FormState } from "@/lib/form";
import { addressSchema, passwordSchema } from "@/lib/schemas";

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ name: z.string().trim().min(2, "Indiquez votre nom.").max(80), phone: z.string().trim().max(20).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name, phone: parsed.data.phone || null } });
  revalidatePath("/account", "layout");
  return { ok: true, message: "Profil mis à jour." };
}

export async function updateAddress(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const data = { ...parsed.data, line2: parsed.data.line2 || null };
  await db.address.upsert({ where: { userId: user.id }, update: data, create: { ...data, userId: user.id } });
  revalidatePath("/account", "layout");
  return { ok: true, message: "Adresse enregistrée." };
}

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ current: z.string().min(1, "Saisissez votre mot de passe actuel."), password: passwordSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(parsed.data.current, record.passwordHash)))
    return { fieldErrors: { current: "Mot de passe actuel incorrect." } };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) } });
  return { ok: true, message: "Mot de passe modifié." };
}
