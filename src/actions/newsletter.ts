"use server";

import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form";
import { confirmSubscription, unsubscribe } from "@/lib/newsletter";

/**
 * Boutons des pages ouvertes depuis un e-mail de la lettre d'information (PLAN.md 7.13). Point de vigilance 5 : la page
 * elle-même (GET) ne change rien, un antivirus de messagerie peut l'ouvrir sans effet ; seul ce bouton (POST) agit.
 * Le jeton est la seule preuve demandée : 32 octets aléatoires, envoyés à l'adresse elle-même.
 */

const tokenOf = (formData: FormData) => String(formData.get("token") ?? "");

export async function confirmNewsletter(_: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("newsletter");
  if (!(await confirmSubscription(db, tokenOf(formData)))) return { error: t("invalidText") };
  return { ok: true, message: t("confirmedText") };
}

/** Même réponse que le jeton existe ou non : la page ne dit pas si une adresse était inscrite, et un second clic n'est pas une erreur. */
export async function unsubscribeNewsletter(_: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("newsletter");
  await unsubscribe(db, tokenOf(formData));
  return { ok: true, message: t("unsubscribedText") };
}
