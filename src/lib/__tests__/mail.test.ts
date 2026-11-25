import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, renderMail } from "../mail/layout";
import type { MailMessage } from "../mail/transport";

/*
 * Socle d'envoi des e-mails (PLAN.md 7.11). Gabarit : échappement du HTML, version texte intacte. Transport : SMTP Gmail
 * quand SMTP_USER et SMTP_PASSWORD sont là, sinon un fichier par message dans MAIL_OUTBOX (tests), sinon une ligne de
 * journal. Gmail est remplacé par un transporteur simulé : aucun réseau, aucun vrai e-mail.
 */

const { createTransport, transportSend } = vi.hoisted(() => ({ createTransport: vi.fn(), transportSend: vi.fn() }));
vi.mock("nodemailer", () => ({ createTransport, default: { createTransport } }));

describe("escapeHtml", () => {
  it.each([
    ['<script>alert("x")</script>', "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"],
    ["Tom & Jerry", "Tom &amp; Jerry"],
    [`l'été "chaud"`, "l&#39;été &quot;chaud&quot;"],
    ["&amp;", "&amp;amp;"],
    ["Rakoto Jean", "Rakoto Jean"],
  ])("%s", (input, expected) => {
    expect(escapeHtml(input)).toBe(expected);
  });
});

describe("renderMail", () => {
  const content = {
    title: "Commande de <b>Rakoto</b> & fils",
    paragraphs: ['Note du client : <img src="https://pirate.example/x.png"> merci', "Lot IVB 12\nAmbohijatovo"],
    button: { label: "Voir la commande", url: "https://alarobia.example/fr/order/abc?a=1&b=2" },
    footer: "Vous recevez ce message <parce que> vous avez commandé.",
  };

  it("échappe le titre, les paragraphes et le pied dans la version HTML", () => {
    const { html } = renderMail("fr", content);
    expect(html).toContain("Commande de &lt;b&gt;Rakoto&lt;/b&gt; &amp; fils");
    expect(html).toContain("Note du client : &lt;img src=&quot;https://pirate.example/x.png&quot;&gt; merci");
    expect(html).toContain("Vous recevez ce message &lt;parce que&gt; vous avez commandé.");
    expect(html).not.toContain("<b>Rakoto</b>");
    expect(html).not.toContain("<parce que>");
  });

  it("garde le texte brut intact dans la version texte", () => {
    const { text } = renderMail("fr", content);
    expect(text).toContain("Commande de <b>Rakoto</b> & fils");
    expect(text).toContain('Note du client : <img src="https://pirate.example/x.png"> merci');
    expect(text).toContain("Lot IVB 12\nAmbohijatovo");
    expect(text).toContain("Vous recevez ce message <parce que> vous avez commandé.");
    expect(text).not.toContain("&lt;");
    expect(text).not.toContain("&amp;");
  });

  it("met le bouton en lien dans le HTML et en clair dans le texte", () => {
    const { html, text } = renderMail("fr", content);
    expect(html).toContain('href="https://alarobia.example/fr/order/abc?a=1&amp;b=2"');
    expect(html).toContain(">Voir la commande</a>");
    expect(text).toContain("Voir la commande\nhttps://alarobia.example/fr/order/abc?a=1&b=2");
  });

  it("garde les retours à la ligne d'un paragraphe", () => {
    expect(renderMail("fr", content).html).toContain("Lot IVB 12<br>Ambohijatovo");
  });

  it("déclare la langue du message", () => {
    expect(renderMail("mg", content).html).toMatch(/<html lang="mg"/);
    expect(renderMail("en", content).html).toMatch(/<html lang="en"/);
  });

  it("nomme la boutique dans les deux versions", () => {
    const { html, text } = renderMail("en", { title: "Hello", paragraphs: ["World"] });
    expect(html).toContain("alarobia");
    expect(text).toMatch(/Alarobia/i);
  });

  it("ne charge rien de l'extérieur : ni image, ni feuille de style, ni police", () => {
    const { html } = renderMail("fr", { title: "Bonjour", paragraphs: ["Texte"], button: { label: "Ouvrir", url: "https://alarobia.example" }, footer: "Pied" });
    expect(html).not.toMatch(/<img|<link|url\(|@import|<script/i);
  });

  it("écrit des attributs style complets : aucun guillemet ne les coupe en route", () => {
    const { html } = renderMail("fr", content);
    const styles = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    expect(styles.length).toBeGreaterThan(5);
    for (const style of styles) expect(style, style).toMatch(/^(\s*[a-z-]+:[^;]+;)+$/);
  });

  it("sans bouton ni pied, n'en laisse aucune trace", () => {
    const { html, text } = renderMail("fr", { title: "Bonjour", paragraphs: ["Un", "Deux"] });
    expect(html).not.toContain("<a ");
    expect(text).toBe("Bonjour\n\nUn\n\nDeux\n\n--\nAlarobia\n");
  });

  it("par défaut, une adresse écrite dans un paragraphe reste du texte (e-mails de commande)", () => {
    const { html } = renderMail("fr", { title: "Note", paragraphs: ["Voir https://exemple.mg/a"] });
    expect(html).not.toContain("<a ");
    expect(html).toContain("Voir https://exemple.mg/a");
  });

  it("avec `links`, les adresses http(s) des paragraphes deviennent des liens, et seulement elles", () => {
    const { html, text } = renderMail("fr", { title: "https://titre.mg", paragraphs: ["Voir https://exemple.mg/a?x=1&y=2."], links: true, footer: "https://pied.mg" });
    expect(html).toContain('<a href="https://exemple.mg/a?x=1&amp;y=2" style="');
    expect(html).toContain(">https://exemple.mg/a?x=1&amp;y=2</a>.");
    expect([...html.matchAll(/<a /g)]).toHaveLength(1);
    expect(text).toContain("Voir https://exemple.mg/a?x=1&y=2.");
  });

  it("met le lien du pied en lien dans le HTML et en clair dans le texte", () => {
    const { html, text } = renderMail("fr", { title: "Lettre", paragraphs: ["Texte"], footer: "Vous êtes inscrit.", footerLink: { label: "Se <désinscrire>", url: "https://exemple.mg/u?a=1&b=2" } });
    expect(html).toContain('href="https://exemple.mg/u?a=1&amp;b=2"');
    expect(html).toContain(">Se &lt;désinscrire&gt;</a>");
    expect(text).toBe("Lettre\n\nTexte\n\n--\nAlarobia\nVous êtes inscrit.\nSe <désinscrire>\nhttps://exemple.mg/u?a=1&b=2\n");
  });
});

describe("sendMail", () => {
  const message: MailMessage = {
    to: "rakoto@example.mg",
    subject: "Commande AL-1 reçue",
    html: "<p>Bonjour</p>",
    text: "Bonjour",
    replyTo: "bonjour@alarobia.example",
    headers: { "List-Unsubscribe": "<https://alarobia.example/u>" },
  };
  let outbox: string;

  beforeEach(async () => {
    vi.resetModules();
    createTransport.mockReset().mockReturnValue({ sendMail: transportSend });
    transportSend.mockReset().mockResolvedValue({ messageId: "<1@gmail.com>", accepted: [message.to], rejected: [] });
    outbox = await mkdtemp(path.join(tmpdir(), "outbox-"));
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASSWORD", "");
    vi.stubEnv("MAIL_OUTBOX", "");
    vi.stubEnv("SITE_ID", "");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await rm(outbox, { recursive: true, force: true });
  });

  const load = async () => (await import("../mail/transport")).sendMail;
  const silence = (level: "info" | "error") => vi.spyOn(console, level).mockImplementation(() => {});
  const logged = (spy: ReturnType<typeof silence>) => spy.mock.calls.map((args) => args.map(String).join(" ")).join("\n");

  it("sans SMTP, écrit un fichier JSON par message dans MAIL_OUTBOX", async () => {
    vi.stubEnv("MAIL_OUTBOX", outbox);
    const sendMail = await load();
    expect(await sendMail(message)).toBe(true);
    const files = await readdir(outbox);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.json$/);
    const written = JSON.parse(await readFile(path.join(outbox, files[0]), "utf8"));
    expect(written).toMatchObject({ to: message.to, subject: message.subject, html: message.html, text: message.text, replyTo: message.replyTo, headers: message.headers });
    expect(new Date(written.at).getTime()).not.toBeNaN();
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("crée le dossier de l'outbox s'il manque, et range les messages dans l'ordre d'envoi", async () => {
    const dir = path.join(outbox, "neuf");
    vi.stubEnv("MAIL_OUTBOX", dir);
    const sendMail = await load();
    for (const subject of ["un", "deux", "trois"]) expect(await sendMail({ ...message, subject })).toBe(true);
    const files = (await readdir(dir)).sort();
    const subjects = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), "utf8")).subject));
    expect(subjects).toEqual(["un", "deux", "trois"]);
  });

  it("avec SMTP, envoie par Gmail et n'écrit rien dans l'outbox", async () => {
    vi.stubEnv("SMTP_USER", "boutique@gmail.example");
    vi.stubEnv("SMTP_PASSWORD", "mot-de-passe-application");
    vi.stubEnv("MAIL_OUTBOX", outbox);
    const sendMail = await load();
    expect(await sendMail(message)).toBe(true);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "boutique@gmail.example", pass: "mot-de-passe-application" } }),
    );
    expect(transportSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Alarobia" <boutique@gmail.example>',
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        headers: message.headers,
      }),
    );
    expect(await readdir(outbox)).toEqual([]);
  });

  it("borne la durée de chaque envoi : une panne de Gmail ne bloque pas la fonction", async () => {
    vi.stubEnv("SMTP_USER", "boutique@gmail.example");
    vi.stubEnv("SMTP_PASSWORD", "mot-de-passe-application");
    const sendMail = await load();
    await sendMail(message);
    const options = createTransport.mock.calls[0][0];
    for (const key of ["connectionTimeout", "greetingTimeout", "socketTimeout", "dnsTimeout"]) expect(options[key], key).toBeLessThanOrEqual(10_000);
    expect(transportSend.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal);
  });

  it("réutilise un seul transporteur", async () => {
    vi.stubEnv("SMTP_USER", "boutique@gmail.example");
    vi.stubEnv("SMTP_PASSWORD", "mot-de-passe-application");
    const sendMail = await load();
    await sendMail(message);
    await sendMail({ ...message, to: "rasoa@example.mg" });
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(transportSend).toHaveBeenCalledTimes(2);
  });

  it("renvoie false sans lever quand Gmail refuse, et journalise sans l'adresse en clair", async () => {
    vi.stubEnv("SMTP_USER", "boutique@gmail.example");
    vi.stubEnv("SMTP_PASSWORD", "mot-de-passe-faux");
    transportSend.mockRejectedValue(Object.assign(new Error("Invalid login: 535-5.7.8 Username and Password not accepted"), { code: "EAUTH" }));
    const error = silence("error");
    const sendMail = await load();
    await expect(sendMail(message)).resolves.toBe(false);
    expect(error).toHaveBeenCalled();
    expect(logged(error)).toContain("EAUTH");
    expect(logged(error)).not.toContain("rakoto@example.mg");
  });

  it("retire l'adresse du message d'erreur de Gmail avant de le journaliser", async () => {
    vi.stubEnv("SMTP_USER", "boutique@gmail.example");
    vi.stubEnv("SMTP_PASSWORD", "mot-de-passe-application");
    transportSend.mockRejectedValue(
      Object.assign(new Error("Can't send mail - all recipients were rejected: 550 5.1.1 <Rakoto@Example.mg>: user unknown"), { code: "EENVELOPE" }),
    );
    const error = silence("error");
    const sendMail = await load();
    expect(await sendMail(message)).toBe(false);
    expect(logged(error)).toContain("EENVELOPE");
    expect(logged(error)).toContain("550 5.1.1");
    expect(logged(error).toLowerCase()).not.toContain("rakoto@example.mg");
  });

  it("renvoie false sans lever quand le transporteur ne peut pas être créé", async () => {
    vi.stubEnv("SMTP_USER", "boutique@gmail.example");
    vi.stubEnv("SMTP_PASSWORD", "mot-de-passe-application");
    createTransport.mockImplementation(() => {
      throw new Error("configuration refusée");
    });
    silence("error");
    const sendMail = await load();
    await expect(sendMail(message)).resolves.toBe(false);
  });

  it("renvoie false quand l'outbox ne peut pas être écrite", async () => {
    // Un fichier ordinaire là où le dossier devrait être : mkdir échoue (ENOTDIR).
    await writeFile(path.join(outbox, "fichier"), "");
    vi.stubEnv("MAIL_OUTBOX", path.join(outbox, "fichier", "outbox"));
    const error = silence("error");
    const sendMail = await load();
    await expect(sendMail(message)).resolves.toBe(false);
    expect(logged(error)).not.toContain("rakoto@example.mg");
  });

  it("une seule des deux variables SMTP : refuse, et nomme celle qui manque", async () => {
    vi.stubEnv("SMTP_USER", "boutique@gmail.example");
    vi.stubEnv("MAIL_OUTBOX", outbox);
    const error = silence("error");
    const sendMail = await load();
    expect(await sendMail(message)).toBe(false);
    expect(logged(error)).toContain("SMTP_PASSWORD");
    expect(createTransport).not.toHaveBeenCalled();
    expect(await readdir(outbox)).toEqual([]);
  });

  it("en local, sans SMTP ni outbox : une ligne de journal avec le sujet, destinataire masqué", async () => {
    const info = silence("info");
    const sendMail = await load();
    expect(await sendMail(message)).toBe(true);
    expect(logged(info)).toContain("Commande AL-1 reçue");
    expect(logged(info)).toContain("example.mg");
    expect(logged(info)).not.toContain("rakoto@example.mg");
  });

  it("sur Netlify, sans SMTP : une erreur claire qui nomme les variables, et false", async () => {
    vi.stubEnv("SITE_ID", "site-netlify");
    const error = silence("error");
    const sendMail = await load();
    expect(await sendMail(message)).toBe(false);
    expect(logged(error)).toContain("SMTP_USER");
    expect(logged(error)).toContain("SMTP_PASSWORD");
    expect(logged(error)).not.toContain("rakoto@example.mg");
  });
});
