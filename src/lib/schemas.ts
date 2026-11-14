import { z } from "zod";
import { normalizePhone, PROVINCES } from "./address";
import { MAX_ORDER_CENTS } from "./constants";
import { parseAmountToCents } from "./format";

/** Traducteur de l'espace de noms "errors" (getTranslations côté serveur). */
export type ErrorT = (key: string, values?: Record<string, string | number>) => string;

/** Schémas de validation dont les messages sont dans la langue du visiteur. */
export function makeSchemas(t: ErrorT) {
  const required = (max = 120) => z.string().trim().min(1, t("required")).max(max);
  const email = z.string().trim().toLowerCase().pipe(z.email(t("emailInvalid")));
  const password = z.string().min(8, t("passwordMin")).max(100);
  const name = z.string().trim().min(2, t("nameRequired")).max(80);
  const address = z.object({
    fullName: required(),
    // Tout numéro malgache est accepté, puis ramené à la forme « 034 12 345 67 ».
    phone: z.preprocess((v) => normalizePhone(typeof v === "string" ? v : ""), z.string(t("phoneInvalid"))),
    line1: required(200),
    district: required(80),
    city: required(),
    province: z.enum(PROVINCES, t("provinceRequired")),
    postalCode: z.string().trim().regex(/^(\d{3})?$/, t("postalCodeInvalid")).default(""),
    /** Repère pour le livreur. */
    line2: z.string().trim().max(200).default(""),
  });
  return { required, email, password, name, address };
}

/** Version française, pour le back-office tant qu'il n'est pas traduit (phase 5). */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide."));

const days = (msg: string) => z.coerce.number(msg).int(msg).min(0, msg).max(60, msg);

/** Zone de livraison saisie dans le back-office (messages en français, comme le reste du back-office). */
export const zoneSchema = z
  .object({
    name: z.string().trim().min(2, "Le nom est requis.").max(60),
    nameEn: z.string().trim().max(60).default(""),
    nameMg: z.string().trim().max(60).default(""),
    price: z
      .string()
      .transform((v) => parseAmountToCents(v))
      .refine((n) => Number.isInteger(n) && n >= 0 && n <= MAX_ORDER_CENTS, "Tarif invalide."),
    minDays: days("Délai invalide : un nombre de jours entre 0 et 60."),
    maxDays: days("Délai invalide : un nombre de jours entre 0 et 60."),
    position: z.coerce.number().int().min(0).default(0),
    active: z.string().optional(),
  })
  .refine((zone) => zone.maxDays >= zone.minDays, { path: ["maxDays"], message: "Le délai maximal ne peut pas être plus court que le délai minimal." })
  .transform(({ price, active, ...zone }) => ({ ...zone, priceCents: price, active: active === "on" }));
