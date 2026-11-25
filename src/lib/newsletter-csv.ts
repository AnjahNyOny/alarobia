import { madagascarDayKey } from "./format";
import { madagascarTime } from "./shipping";

/*
 * Export des inscrits à la lettre d'information, ouvert par le vendeur dans un tableur (Excel, LibreOffice, Google Sheets).
 * UTF-8, virgules, en-tête, fins de ligne CRLF (RFC 4180).
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Instant → « 2026-11-17T23:30:05+03:00 » : date et heure à Madagascar (UTC+3 toute l'année, pas d'heure d'été). */
export function madagascarIso(instant: Date) {
  const wall = madagascarTime(instant);
  return `${madagascarDayKey(instant)}T${pad(wall.getHours())}:${pad(wall.getMinutes())}:${pad(wall.getSeconds())}+03:00`;
}

/**
 * Une cellule CSV. Un tableur exécute une cellule qui commence par `=`, `+`, `-` ou `@` (et certains après une tabulation
 * ou un retour chariot) : n'importe qui peut s'inscrire avec une telle « adresse », on la préfixe donc d'une apostrophe.
 * Les guillemets sont doublés, et la cellule entourée de guillemets dès qu'elle contient un séparateur.
 */
export function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Inscrits → fichier CSV, dans l'ordre reçu (le plus récent d'abord, comme la page). */
export function newsletterCsv(subscribers: { email: string; createdAt: Date }[]) {
  const rows = [["email", "inscription"], ...subscribers.map((s) => [s.email, madagascarIso(s.createdAt)])];
  return rows.map((row) => row.map(csvCell).join(",") + "\r\n").join("");
}

/** « lettre-inscrits-2026-11-24.csv », daté du jour à Madagascar. */
export function newsletterCsvName(now: Date) {
  return `lettre-inscrits-${madagascarDayKey(now)}.csv`;
}
