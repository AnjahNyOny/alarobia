import { z } from "zod";
import { COUNTRIES } from "./constants";

const required = (label: string, max = 120) => z.string().trim().min(1, `${label} est requis.`).max(max);

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide."));
export const passwordSchema = z.string().min(8, "8 caractères minimum.").max(100);

export const addressSchema = z.object({
  fullName: required("Le nom complet"),
  line1: required("L'adresse", 200),
  line2: z.string().trim().max(200).optional(),
  postalCode: required("Le code postal", 12),
  city: required("La ville"),
  country: z.enum(COUNTRIES as [string, ...string[]], "Pays non desservi."),
  phone: z.string().trim().regex(/^[+\d][\d\s.-]{7,18}$/, "Numéro de téléphone invalide."),
});
