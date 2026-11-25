import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTransport, type Transporter } from "nodemailer";
import { SHOP_NAME } from "./layout";

/**
 * Envoi des e-mails (PLAN.md 7.11). Trois sorties, dans cet ordre :
 * 1. SMTP de Gmail, quand SMTP_USER et SMTP_PASSWORD (mot de passe d'application) sont définis. Ils ne sont saisis que
 *    sur Netlify, jamais dans un `.env*` : une compilation ou un serveur local enverraient de vrais e-mails.
 * 2. Sinon, si MAIL_OUTBOX est défini (tests navigateur), un fichier JSON par message dans ce dossier. Jamais lu quand
 *    SMTP est configuré.
 * 3. Sinon, une ligne de journal : sujet et destinataire masqué. Sur Netlify, c'est une erreur (variables oubliées).
 *
 * Un e-mail ne fait jamais échouer une action : `sendMail` renvoie `false` sur toute erreur, ne lève jamais, et
 * journalise sans l'adresse du destinataire en clair.
 *
 * Le dossier MAIL_OUTBOX est écrit avec `node:fs`, pas par `storage.ts` : il ne sert qu'aux tests, sur le disque local,
 * et ce ne sont pas des fichiers envoyés par les visiteurs.
 */

export type MailMessage = { to: string; subject: string; html: string; text: string; replyTo?: string; headers?: Record<string, string> };

/** Message tel qu'il est écrit dans MAIL_OUTBOX : `readOutbox()` (e2e/helpers.ts) relit ce format. */
export type OutboxMessage = MailMessage & { from: string; at: string };

/** Expéditeur hors SMTP (outbox, journal) : l'adresse réelle de la boutique n'est écrite nulle part dans le code. */
const DEMO_FROM = `"${SHOP_NAME}" <boutique@alarobia.example>`;

/**
 * Délais courts : sans eux, nodemailer attend jusqu'à 2 min la connexion et 10 min un serveur muet
 * (smtp-connection, valeurs par défaut). L'envoi se fait après la réponse, dans la même fonction Netlify, dont le délai
 * est de 26 s au moins sûr. Un envoi normal par Gmail prend une à deux secondes.
 */
const SMTP_TIMEOUTS = { connectionTimeout: 5_000, greetingTimeout: 5_000, socketTimeout: 10_000, dnsTimeout: 5_000 };
/** Durée maximale d'un envoi, de la connexion à l'acceptation, par un `AbortSignal` (README de nodemailer). */
const SEND_TIMEOUT = 10_000;

let gmail: Transporter | null = null;
let sequence = 0;

export async function sendMail(message: MailMessage): Promise<boolean> {
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASSWORD ?? "";
  try {
    if (user || pass) {
      if (!user || !pass) {
        console.error(`[mail] ${user ? "SMTP_PASSWORD" : "SMTP_USER"} manque (l'autre est défini) : e-mail « ${message.subject} » à ${maskAddress(message.to)} non envoyé.`);
        return false;
      }
      gmail ??= createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass }, ...SMTP_TIMEOUTS });
      await gmail.sendMail({ from: `"${SHOP_NAME}" <${user}>`, ...message, signal: AbortSignal.timeout(SEND_TIMEOUT) });
      return true;
    }
    const outbox = process.env.MAIL_OUTBOX;
    if (outbox) {
      await writeOutbox(outbox, message);
      return true;
    }
    if (process.env.SITE_ID) {
      // Sur Netlify (SITE_ID y est toujours posé, voir storage.ts) : les variables ont été oubliées.
      console.error(`[mail] SMTP_USER et SMTP_PASSWORD absents : e-mail « ${message.subject} » à ${maskAddress(message.to)} non envoyé. Les saisir dans les variables d'environnement du site Netlify, puis redéployer.`);
      return false;
    }
    console.info(`[mail] non envoyé (ni SMTP ni MAIL_OUTBOX) : « ${message.subject} » à ${maskAddress(message.to)}`);
    return true;
  } catch (error) {
    console.error(`[mail] échec de l'envoi « ${message.subject} » à ${maskAddress(message.to)} : ${describe(error, message.to)}`);
    return false;
  }
}

async function writeOutbox(dir: string, message: MailMessage) {
  await mkdir(dir, { recursive: true });
  const at = new Date().toISOString();
  // Nom triable par date : l'heure ISO (sans « : », refusé par certains systèmes), puis un compteur pour les messages de
  // la même milliseconde, puis du hasard contre deux serveurs qui écriraient dans le même dossier.
  const name = `${at.replace(/[:.]/g, "-")}-${String(++sequence).padStart(6, "0")}-${randomBytes(3).toString("hex")}.json`;
  const written: OutboxMessage = { from: DEMO_FROM, ...message, at };
  // Écrit à côté puis renommé : un test qui relit le dossier pendant l'écriture ne voit jamais un fichier à moitié écrit.
  const file = path.join(dir, name);
  await writeFile(`${file}.tmp`, JSON.stringify(written, null, 2));
  await rename(`${file}.tmp`, file);
}

/** `rakoto@example.mg` → `r***@example.mg` : assez pour reconnaître un domaine dans le journal, pas une personne. */
export function maskAddress(address: string): string {
  const at = address.lastIndexOf("@");
  return at > 0 ? `${address[0]}***${address.slice(at)}` : "***";
}

/** Code et message de l'erreur, sans l'adresse du destinataire (Gmail la cite quand il la refuse). */
function describe(error: unknown, to: string) {
  const code = error instanceof Error && "code" in error && error.code ? `${String(error.code)} ` : "";
  const reason = error instanceof Error ? error.message : String(error);
  const escaped = to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `${code}${to ? reason.replace(new RegExp(escaped, "gi"), maskAddress(to)) : reason}`;
}
