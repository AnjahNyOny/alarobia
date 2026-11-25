import { describe, expect, it } from "vitest";
import { csvCell, madagascarIso, newsletterCsv, newsletterCsvName } from "../newsletter-csv";

/* Export des inscrits à la lettre d'information (back-office) : fichier CSV que le vendeur ouvrira dans un tableur. */

describe("madagascarIso : instant écrit à l'heure de Madagascar", () => {
  it("donne la date et l'heure locales avec le décalage +03:00", () => {
    expect(madagascarIso(new Date("2026-11-17T20:30:05Z"))).toBe("2026-11-17T23:30:05+03:00");
  });
  it("passe au jour suivant quand il est déjà minuit passé à Antananarivo", () => {
    expect(madagascarIso(new Date("2026-12-31T22:15:00Z"))).toBe("2027-01-01T01:15:00+03:00");
  });
});

describe("csvCell : une cellule sans danger pour un tableur", () => {
  it("laisse une adresse ordinaire telle quelle", () => {
    expect(csvCell("rakoto@exemple.mg")).toBe("rakoto@exemple.mg");
  });
  it.each(["=1+1", "+33612", "-2", "@SUM(A1)", "\tx", "\rx"])("neutralise une formule qui commence par %j", (value) => {
    expect(csvCell(value).replace(/^"|"$/g, "").startsWith("'")).toBe(true);
  });
  it("double les guillemets et entoure la cellule de guillemets", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
  });
  it("entoure de guillemets une cellule qui contient une virgule ou un saut de ligne", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
  it("neutralise puis entoure une formule qui contient une virgule", () => {
    expect(csvCell('=HYPERLINK("http://x",1)')).toBe(`"'=HYPERLINK(""http://x"",1)"`);
  });
});

describe("newsletterCsv", () => {
  it("écrit l'en-tête puis une ligne par inscrit, dans l'ordre reçu, avec des fins de ligne CRLF", () => {
    const csv = newsletterCsv([
      { email: "voahangy@exemple.mg", createdAt: new Date("2026-11-20T09:00:00Z") },
      { email: "rakoto@exemple.mg", createdAt: new Date("2026-11-17T20:30:05Z") },
    ]);
    expect(csv).toBe("email,inscription\r\nvoahangy@exemple.mg,2026-11-20T12:00:00+03:00\r\nrakoto@exemple.mg,2026-11-17T23:30:05+03:00\r\n");
  });
  it("n'écrit que l'en-tête quand personne n'est inscrit", () => {
    expect(newsletterCsv([])).toBe("email,inscription\r\n");
  });
  it("neutralise une adresse piégée", () => {
    expect(newsletterCsv([{ email: "=cmd@x.mg", createdAt: new Date("2026-11-17T20:30:05Z") }])).toContain("\r\n'=cmd@x.mg,");
  });
});

describe("newsletterCsvName", () => {
  it("porte la date du jour à Madagascar, même quand le serveur (UTC) est encore la veille", () => {
    expect(newsletterCsvName(new Date("2026-11-23T22:00:00Z"))).toBe("lettre-inscrits-2026-11-24.csv");
  });
});
