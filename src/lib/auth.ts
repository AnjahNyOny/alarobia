import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirectTo } from "@/i18n/server";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

export const SESSION_COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET manquant ou trop court (voir .env.example)");
  return new TextEncoder().encode(value);
}

export async function createSession(userId: string, role: string) {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Utilisateur courant, relu en base à chaque requête (un compte supprimé ou rétrogradé perd ses droits aussitôt). */
export const getUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });
  } catch {
    return null;
  }
});

export async function requireUser(next = "/account") {
  const user = await getUser();
  if (!user) return redirectTo(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin() {
  const user = await getUser();
  if (!user) return redirectTo("/login?next=/admin");
  if (user.role !== "ADMIN") return redirectTo("/");
  return user;
}
