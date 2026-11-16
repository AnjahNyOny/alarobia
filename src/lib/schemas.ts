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

const days = (msg: string) => z.coerce.number(msg).int(msg).min(0, msg).max(60, msg);

/** Zone de livraison saisie dans le back-office. `t` est le traducteur de « admin.errors » : les messages sont dans la langue de l'interface. */
export function zoneSchema(t: ErrorT) {
  return z
    .object({
      name: z.string().trim().min(2, t("nameRequired")).max(60, t("tooLong", { max: 60 })),
      nameEn: z.string().trim().max(60, t("tooLong", { max: 60 })).default(""),
      nameMg: z.string().trim().max(60, t("tooLong", { max: 60 })).default(""),
      price: z
        .string()
        .transform((v) => parseAmountToCents(v))
        .refine((n) => Number.isInteger(n) && n >= 0 && n <= MAX_ORDER_CENTS, t("zoneRateInvalid")),
      minDays: days(t("daysInvalid")),
      maxDays: days(t("daysInvalid")),
      position: z.coerce.number().int().min(0).default(0),
      active: z.string().optional(),
    })
    .refine((zone) => zone.maxDays >= zone.minDays, { path: ["maxDays"], message: t("daysOrder") })
    .transform(({ price, active, ...zone }) => ({ ...zone, priceCents: price, active: active === "on" }));
}
