"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { invalid, type FormState } from "@/lib/form";
import { getTranslations } from "next-intl/server";
import { makeSchemas } from "@/lib/schemas";

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const [t, n] = await Promise.all([getTranslations("errors"), getTranslations("notices")]);
  const parsed = z.object({ name: makeSchemas(t).name, phone: z.string().trim().max(20).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, t("formInvalid"));
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name, phone: parsed.data.phone || null } });
  revalidatePath("/account", "layout");
  return { ok: true, message: n("profileUpdated") };
}

export async function updateAddress(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const [t, n] = await Promise.all([getTranslations("errors"), getTranslations("notices")]);
  const parsed = makeSchemas(t).address.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, t("formInvalid"));
  const data = { ...parsed.data, line2: parsed.data.line2 || null, country: "Madagascar" };
  await db.address.upsert({ where: { userId: user.id }, update: data, create: { ...data, userId: user.id } });
  revalidatePath("/account", "layout");
  return { ok: true, message: n("addressSaved") };
}

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const [t, n] = await Promise.all([getTranslations("errors"), getTranslations("notices")]);
  const parsed = z.object({ current: z.string().min(1, t("currentPasswordRequired")), password: makeSchemas(t).password }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, t("formInvalid"));
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(parsed.data.current, record.passwordHash)))
    return { fieldErrors: { current: t("currentPasswordWrong") } };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) } });
  return { ok: true, message: n("passwordChanged") };
}
