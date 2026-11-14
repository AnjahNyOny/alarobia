"use server";

import bcrypt from "bcryptjs";
import { redirectTo } from "@/i18n/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { invalid, safeNext, type FormState } from "@/lib/form";
import { emailSchema, passwordSchema } from "@/lib/schemas";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(80),
  email: emailSchema,
  password: passwordSchema,
});

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { name, email, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } }))
    return { fieldErrors: { email: "Un compte existe déjà avec cette adresse." } };

  const user = await db.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12) } });
  await createSession(user.id, user.role);
  return redirectTo(safeNext(formData.get("next")));
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = email ? await db.user.findUnique({ where: { email } }) : null;
  // Même message et même coût de calcul que le compte existe ou non.
  const hash = user?.passwordHash ?? "$2b$12$ArWxNV3L5NSuYW9u6Mj61eF6Ovrmym7k58Zv93f6WAOdXt4mRLsyi";
  const valid = await bcrypt.compare(password, hash);
  if (!user || !valid) return { error: "E-mail ou mot de passe incorrect." };

  await createSession(user.id, user.role);
  return redirectTo(safeNext(formData.get("next"), user.role === "ADMIN" ? "/admin" : "/account"));
}

export async function logout() {
  await destroySession();
  return redirectTo("/");
}
