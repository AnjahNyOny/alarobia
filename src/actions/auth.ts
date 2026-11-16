"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirectTo } from "@/i18n/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { invalid, safeNext, type FormState } from "@/lib/form";
import { getTranslations } from "next-intl/server";
import { makeSchemas } from "@/lib/schemas";
import { clientIp, createRateLimiter, withRateLimit } from "@/lib/rate-limit";

// Connexion : seuls les échecs comptent. Huit par e-mail visé, trente par adresse (une adresse d'opérateur mobile
// est partagée par beaucoup de clients), sur quinze minutes. Inscription : dix comptes créés par adresse et par heure.
const loginFailuresByEmail = createRateLimiter({ limit: 8, windowMs: 15 * 60_000 });
const loginFailuresByIp = createRateLimiter({ limit: 30, windowMs: 15 * 60_000 });
const accountsByIp = createRateLimiter({ limit: 10, windowMs: 60 * 60_000 });

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("errors");
  const { name, email, password } = makeSchemas(t);
  // Seuls les comptes réellement créés comptent ; une saisie à corriger ou une adresse déjà prise rend sa place.
  const outcome = await withRateLimit(
    [[accountsByIp, clientIp(await headers())]],
    async (): Promise<{ state: FormState } | { user: { id: string; role: string } }> => {
      const parsed = z.object({ name, email, password }).safeParse(Object.fromEntries(formData));
      if (!parsed.success) return { state: invalid(parsed.error, t("formInvalid")) };
      const data = parsed.data;
      if (await db.user.findUnique({ where: { email: data.email } })) return { state: { fieldErrors: { email: t("emailTaken") } } };
      return { user: await db.user.create({ data: { name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 12) } }) };
    },
    (result) => "user" in result,
  );
  if (outcome.limited) return { error: t("rateLimited", { minutes: outcome.minutes }) };
  if ("state" in outcome.value) return outcome.value.state;

  await createSession(outcome.value.user.id, outcome.value.user.role);
  return redirectTo(safeNext(formData.get("next")));
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("errors");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // Limite atteinte : le mot de passe n'est même pas comparé, et la réponse est la même que le compte existe ou non.
  const outcome = await withRateLimit(
    [
      [loginFailuresByEmail, email || null],
      [loginFailuresByIp, clientIp(await headers())],
    ],
    async () => {
      const user = email ? await db.user.findUnique({ where: { email } }) : null;
      // Même message et même coût de calcul que le compte existe ou non.
      const hash = user?.passwordHash ?? "$2b$12$ArWxNV3L5NSuYW9u6Mj61eF6Ovrmym7k58Zv93f6WAOdXt4mRLsyi";
      return (await bcrypt.compare(password, hash)) ? user : null;
    },
    (user) => !user,
  );
  if (outcome.limited) return { error: t("rateLimited", { minutes: outcome.minutes }) };
  const user = outcome.value;
  if (!user) return { error: t("invalidCredentials") };

  await createSession(user.id, user.role);
  return redirectTo(safeNext(formData.get("next"), user.role === "ADMIN" ? "/admin" : "/account"));
}

export async function logout() {
  await destroySession();
  return redirectTo("/");
}
