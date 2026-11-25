"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirectTo } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalid, type FormState } from "@/lib/form";
import { letterPreview, newsletterIssueMail } from "@/lib/mail/newsletter-mails";
import { vendorAddress } from "@/lib/mail/order-mails";
import { maskAddress, sendMail } from "@/lib/mail/transport";
import { translateMail } from "@/lib/mail/translate";
import { runIssueBatch, type BatchResult } from "@/lib/newsletter-send";
import { issueSchema } from "@/lib/schemas";
import { siteBase } from "@/lib/seo";

/** Toutes les pages de la lettre, dans toutes les langues. */
const revalidateNewsletter = () => revalidatePath("/[locale]/admin/newsletter", "layout");

/**
 * Retire une adresse de la lettre d'information, à la demande d'une personne qui écrit à la boutique plutôt que de
 * suivre le lien de désinscription de la lettre. `deleteMany` : une adresse déjà retirée (deux onglets ouverts) n'est pas une erreur.
 */
export async function removeNewsletterSubscriber(id: string): Promise<FormState> {
  await requireAdmin();
  await db.newsletterSubscriber.deleteMany({ where: { id } });
  revalidatePath("/admin/newsletter");
  return { ok: true, message: (await getTranslations("admin.notices"))("newsletterRemoved") };
}

/** Enregistre une nouvelle lettre (PLAN.md 7.14), puis mène à sa page : aperçu, essai, envoi. */
export async function createIssue(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const t = await getTranslations("admin.errors");
  const parsed = issueSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, t("formInvalid"));
  const issue = await db.newsletterIssue.create({ data: parsed.data, select: { id: true } });
  revalidateNewsletter();
  return redirectTo(`/admin/newsletter/issues/${issue.id}`);
}

/**
 * Modifie l'objet et le texte, tant qu'aucune adresse n'a reçu la lettre : une fois l'envoi commencé, chacun doit
 * recevoir la même. La condition est dans la mise à jour elle-même, un envoi lancé entre-temps dans un autre onglet l'emporte.
 */
export async function updateIssue(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const [t, tn] = await Promise.all([getTranslations("admin.errors"), getTranslations("admin.notices")]);
  const parsed = issueSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, t("formInvalid"));
  const { count } = await db.newsletterIssue.updateMany({ where: { id, sentAt: null, deliveries: { none: {} } }, data: parsed.data });
  if (count === 0) return { error: (await db.newsletterIssue.count({ where: { id } })) ? t("issueLocked") : t("issueNotFound") };
  revalidateNewsletter();
  return { ok: true, message: tn("issueUpdated") };
}

/**
 * Essai au vendeur (adresse d'envoi `SMTP_USER`, celle de démonstration en local) : la lettre telle qu'elle partira, objet
 * préfixé, lien de désinscription sans jeton réel. Aucune ligne `NewsletterDelivery` : l'essai ne compte pas dans le plafond.
 */
export async function sendTestIssue(id: string): Promise<FormState> {
  await requireAdmin();
  const [t, tn, tl] = await Promise.all([getTranslations("admin.errors"), getTranslations("admin.notices"), getTranslations("admin.newsletter")]);
  const issue = await db.newsletterIssue.findUnique({ where: { id } });
  if (!issue) return { error: t("issueNotFound") };
  const vendor = vendorAddress(process.env.SMTP_USER);
  const preview = letterPreview(issue, { translate: translateMail, base: siteBase(), vendor });
  const sent = await sendMail({ ...preview, subject: `${tl("testPrefix")} ${issue.subject}` });
  return sent ? { ok: true, message: tn("testSent", { email: vendor }) } : { error: t("testFailed") };
}

/**
 * Un lot de l'envoi d'une lettre aux inscrits confirmés (src/lib/newsletter-send.ts : réservation avant envoi, plafond de
 * 300 par 24 h, arrêt avant 15 s). La page le rappelle tant qu'il en reste. Rien ne lève vers l'interface : une erreur
 * imprévue (base indisponible) est journalisée sans adresse en clair et arrête le lot, la reprise repartira de la base.
 */
export async function sendIssueBatch(issueId: string): Promise<BatchResult> {
  await requireAdmin();
  try {
    const ctx = { translate: translateMail, base: siteBase() };
    const result = await runIssueBatch(db, issueId, { send: sendMail, build: (letter, subscriber) => newsletterIssueMail(letter, subscriber, ctx) });
    if (result.sent > 0 || result.remaining === 0) revalidateNewsletter();
    return result;
  } catch (error) {
    const reason = (error instanceof Error ? error.message : String(error)).replace(/[^\s<>()"',;:]+@[^\s<>()"',;:]+/g, maskAddress);
    console.error(`[mail] envoi de la lettre ${issueId} interrompu : ${reason}`);
    return { sent: 0, remaining: 0, stopped: "error" };
  }
}
