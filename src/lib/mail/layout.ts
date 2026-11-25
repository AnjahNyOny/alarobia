import type { Locale } from "@/i18n/routing";

/**
 * Gabarit commun des e-mails (PLAN.md 7.11) : une version HTML et une version texte équivalente.
 *
 * Le HTML vise les messageries telles qu'elles sont, Gmail en tête, sur ordinateur comme sur téléphone : mise en page
 * par tableaux, styles écrits sur chaque élément (Gmail retire une partie des feuilles de style), largeur de 560 px au
 * plus et fluide en dessous. Rien n'est chargé de l'extérieur : pas d'image (bloquées par défaut chez beaucoup de
 * lecteurs, et le message doit rester lisible sans), pas de police distante (pile du système), pas de feuille de style.
 * Le pictogramme du site, l'étiquette « Ar », est redessiné en texte sur fond latérite.
 *
 * Tout ce qui est passé ici est du texte, traduit par l'appelant : il est échappé dans la version HTML et laissé intact
 * dans la version texte. Seul le nom de la boutique est écrit ici, commun aux trois langues.
 */

/** Couleurs de src/app/globals.css (`:root`) : un e-mail ne lit pas les variables CSS du site. */
const COLOR = {
  ink: "#1f2547", // --foreground, --primary
  muted: "#585c75", // --muted-foreground
  border: "#e3e1da", // --border
  brand: "#b4401f", // --brand, la latérite
  onDark: "#ffffff", // --primary-foreground, --brand-foreground
  page: "#ffffff", // --background
};

/** Pile du système. Guillemets simples : la valeur est écrite dans des attributs `style="…"`. */
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

export const SHOP_NAME = "Alarobia";

export type MailContent = {
  title: string;
  /** Un paragraphe par élément ; un retour à la ligne y est gardé (adresse, liste courte). */
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Texte libre en bas du message, sous un filet (pourquoi on reçoit ce message, désinscription…). */
  footer?: string;
};

/** Échappe les cinq caractères qui ont un sens en HTML, dans le texte comme dans la valeur d'un attribut. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Texte échappé, retours à la ligne rendus par `<br>`. */
const lines = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br>");

export function renderMail(locale: Locale, { title, paragraphs, button, footer }: MailContent): { html: string; text: string } {
  return { html: html(locale, { title, paragraphs, button, footer }), text: text({ title, paragraphs, button, footer }) };
}

function text({ title, paragraphs, button, footer }: MailContent) {
  const blocks = [title, ...paragraphs];
  if (button) blocks.push(`${button.label}\n${button.url}`);
  blocks.push(`--\n${SHOP_NAME}${footer ? `\n${footer}` : ""}`);
  return `${blocks.join("\n\n")}\n`;
}

function html(locale: Locale, { title, paragraphs, button, footer }: MailContent) {
  const cell = (style: string, content: string) => `<tr><td style="${style}">${content}</td></tr>`;
  const side = "padding-left:28px;padding-right:28px;";

  const wordmark = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background-color:${COLOR.brand};color:${COLOR.onDark};font-family:${FONT};font-size:13px;font-weight:700;line-height:1;padding:5px 7px 5px 9px;border-radius:3px 4px 4px 3px;">Ar</td>
<td style="padding-left:8px;font-family:${FONT};font-size:21px;font-weight:700;line-height:1;color:${COLOR.ink};letter-spacing:-0.01em;">${escapeHtml(SHOP_NAME.toLowerCase())}</td>
</tr></table>`;

  const body = paragraphs.map((p) => `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.55;color:${COLOR.ink};">${lines(p)}</p>`).join("\n");

  const action = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px 0;"><tr>
<td style="background-color:${COLOR.ink};border-radius:6px;"><a href="${escapeHtml(button.url)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.2;color:${COLOR.onDark};text-decoration:none;border-radius:6px;">${escapeHtml(button.label)}</a></td>
</tr></table>`
    : "";

  const foot = footer ? cell(`${side}padding-top:20px;padding-bottom:24px;border-top:1px solid ${COLOR.border};font-family:${FONT};font-size:13px;line-height:1.5;color:${COLOR.muted};`, lines(footer)) : "";

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.page};"><tr><td align="center" style="padding:16px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background-color:${COLOR.page};border:1px solid ${COLOR.border};border-radius:6px;text-align:left;">
${cell(`${side}padding-top:24px;`, wordmark)}
${cell(`${side}padding-top:24px;`, `<h1 style="margin:0;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${COLOR.ink};">${escapeHtml(title)}</h1>`)}
${cell(`${side}padding-top:16px;padding-bottom:${footer ? 8 : 24}px;`, `${body}${action}`)}
${foot}
</table>
</td></tr></table>
</body>
</html>
`;
}
