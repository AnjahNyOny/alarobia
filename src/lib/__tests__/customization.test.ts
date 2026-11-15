import { describe, expect, it } from "vitest";
import {
  cleanText,
  COLORS,
  contrast,
  customizedUnitPrice,
  customizerOptions,
  defaultDesign,
  describeDesign,
  inkFor,
  isPrinted,
  parseDesign,
  sameDesign,
  textLength,
  type CustomizerOptions,
} from "../customization";

const mug: CustomizerOptions = { template: "mug", colors: ["blanc", "laterite", "indigo"], textMax: 20, allowImage: true, surchargeCents: 300_000 };
const image = "perso-0b9f6c1e-7a52-4c1d-9e0f-3a1b2c3d4e5f.jpg";

describe("customizerOptions", () => {
  const base = { customTemplate: "mug", customColors: "blanc,laterite", customTextMax: 20, customImage: true, customSurchargeCents: 300_000 };
  it("renvoie null pour un produit sans gabarit ou au gabarit inconnu", () => {
    expect(customizerOptions({ ...base, customTemplate: "" })).toBeNull();
    expect(customizerOptions({ ...base, customTemplate: "voiture" })).toBeNull();
  });
  it("lit le gabarit, les couleurs, le texte, l'image et le supplément", () => {
    expect(customizerOptions(base)).toEqual({ template: "mug", colors: ["blanc", "laterite"], textMax: 20, allowImage: true, surchargeCents: 300_000 });
  });
  it("écarte les couleurs inconnues et les doublons", () => {
    expect(customizerOptions({ ...base, customColors: " laterite , fuchsia,laterite,indigo" })?.colors).toEqual(["laterite", "indigo"]);
  });
  it("propose le blanc quand aucune couleur valide n'est enregistrée", () => {
    expect(customizerOptions({ ...base, customColors: "" })?.colors).toEqual(["blanc"]);
  });
  it("borne la longueur du texte entre 0 et 40", () => {
    expect(customizerOptions({ ...base, customTextMax: -3 })?.textMax).toBe(0);
    expect(customizerOptions({ ...base, customTextMax: 500 })?.textMax).toBe(40);
  });
});

describe("cleanText", () => {
  it("retire les espaces autour et réduit les espaces répétés", () => {
    expect(cleanText("  Miora   Rakoto ")).toBe("Miora Rakoto");
  });
  it("remplace les retours à la ligne et les tabulations par une espace", () => {
    expect(cleanText("Miora\n\tRakoto\r\n2026")).toBe("Miora Rakoto 2026");
  });
  it("retire les caractères de contrôle invisibles", () => {
    expect(cleanText("Mi\u0000o​ra‮")).toBe("Miora");
  });
  it("rend un texte vide pour une saisie faite uniquement d'espaces", () => {
    expect(cleanText("   \n ")).toBe("");
  });
  it("garde les apostrophes, les accents et les émojis", () => {
    expect(cleanText("L'île d’Aina 🌺")).toBe("L'île d’Aina 🌺");
  });
});

describe("textLength", () => {
  it("compte un émoji composé comme un seul caractère", () => {
    expect(textLength("👨‍👩‍👧")).toBe(1);
    expect(textLength("Aina 🌺")).toBe(6);
  });
  it("compte une lettre accentuée décomposée comme une seule", () => {
    expect(textLength("é")).toBe(1);
  });
});

describe("parseDesign", () => {
  const input = { color: "laterite", text: "Miora", font: "ronde", ink: "blanc", textSize: 60, textY: 40, image: null, imageSize: 50, imageX: 50, imageY: 50 };

  it("accepte un dessin complet et le rend tel quel", () => {
    expect(parseDesign(input, mug)).toEqual({ ok: true, design: input });
  });
  it("refuse une couleur que le produit ne propose pas", () => {
    expect(parseDesign({ ...input, color: "foret" }, mug)).toEqual({ ok: false, error: "color" });
    expect(parseDesign({ ...input, color: undefined }, mug)).toEqual({ ok: false, error: "color" });
  });
  it("refuse un texte de 200 caractères", () => {
    expect(parseDesign({ ...input, text: "a".repeat(200) }, mug)).toEqual({ ok: false, error: "textTooLong" });
  });
  it("accepte un texte à la limite exacte, émojis comptés pour un", () => {
    const text = "🌺".repeat(20);
    const result = parseDesign({ ...input, text }, mug);
    expect(result.ok && result.design.text).toBe(text);
  });
  it("garde les apostrophes telles que saisies", () => {
    const result = parseDesign({ ...input, text: "L'île d’Aina" }, mug);
    expect(result.ok && result.design.text).toBe("L'île d’Aina");
  });
  it("traite un texte fait d'espaces comme une absence de texte", () => {
    const result = parseDesign({ ...input, text: "    " }, mug);
    expect(result.ok && result.design.text).toBe("");
  });
  it("ignore le texte quand le produit n'en accepte pas", () => {
    const result = parseDesign(input, { ...mug, textMax: 0 });
    expect(result.ok && result.design.text).toBe("");
  });
  it("n'accepte comme image qu'un nom de fichier généré par le serveur", () => {
    expect(parseDesign({ ...input, image }, mug)).toMatchObject({ ok: true, design: { image } });
    for (const bad of ["../../etc/passwd", "photo.jpg", "/uploads/" + image, "perso-123.svg", 42])
      expect(parseDesign({ ...input, image: bad }, mug), String(bad)).toEqual({ ok: false, error: "image" });
  });
  it("refuse une image quand le produit n'en accepte pas", () => {
    expect(parseDesign({ ...input, image }, { ...mug, allowImage: false })).toEqual({ ok: false, error: "image" });
  });
  it("ramène les réglages hors bornes entre 0 et 100, et les valeurs illisibles à 50", () => {
    const result = parseDesign({ ...input, textSize: 250, textY: -4, imageSize: "abc", imageX: 33.6, imageY: null }, mug);
    expect(result.ok && result.design).toMatchObject({ textSize: 100, textY: 0, imageSize: 50, imageX: 34, imageY: 50 });
  });
  it("remplace une police inconnue par la police par défaut", () => {
    const result = parseDesign({ ...input, font: "comic" }, mug);
    expect(result.ok && result.design.font).toBe("enseigne");
  });
  it("remplace une encre illisible sur la couleur de l'objet", () => {
    const result = parseDesign({ ...input, color: "blanc", ink: "blanc" }, mug);
    expect(result.ok && result.design.ink).not.toBe("blanc");
  });
  it("refuse ce qui n'est pas un objet", () => {
    expect(parseDesign(null, mug).ok).toBe(false);
    expect(parseDesign("laterite", mug).ok).toBe(false);
  });
});

describe("defaultDesign", () => {
  it("part de la première couleur proposée, sans texte ni image, avec une encre lisible", () => {
    const design = defaultDesign(mug);
    expect(design).toMatchObject({ color: "blanc", text: "", image: null, font: "enseigne" });
    expect(contrast(COLORS[design.ink], COLORS[design.color])).toBeGreaterThan(4.5);
    expect(parseDesign(design, mug)).toEqual({ ok: true, design });
  });
});

describe("inkFor", () => {
  it("garde l'encre demandée quand elle se lit sur l'objet", () => {
    expect(inkFor("laterite", "blanc")).toBe("blanc");
  });
  it("choisit une encre claire sur un objet sombre et une encre sombre sur un objet clair", () => {
    expect(inkFor("indigo", "indigo")).toBe("blanc");
    expect(inkFor("blanc", "blanc")).toBe("indigo");
    expect(inkFor("charbon")).toBe("blanc");
  });
});

describe("prix d'un article personnalisé", () => {
  const design = defaultDesign(mug);
  it("n'ajoute aucun supplément pour un simple choix de couleur", () => {
    expect(isPrinted(design)).toBe(false);
    expect(customizedUnitPrice(1_200_000, mug, { ...design, color: "laterite" })).toBe(1_200_000);
  });
  it("ajoute le supplément dès qu'il y a un texte ou une image à imprimer", () => {
    expect(customizedUnitPrice(1_200_000, mug, { ...design, text: "Miora" })).toBe(1_500_000);
    expect(customizedUnitPrice(1_200_000, mug, { ...design, image })).toBe(1_500_000);
  });
});

describe("sameDesign", () => {
  const design = { ...defaultDesign(mug), text: "Miora" };
  it("reconnaît deux dessins identiques", () => {
    expect(sameDesign(design, { ...design })).toBe(true);
  });
  it("distingue un texte, une couleur ou un réglage différent", () => {
    expect(sameDesign(design, { ...design, text: "Hery" })).toBe(false);
    expect(sameDesign(design, { ...design, color: "indigo" })).toBe(false);
    expect(sameDesign(design, { ...design, textSize: design.textSize + 1 })).toBe(false);
  });
  it("ignore les réglages d'un élément absent", () => {
    expect(sameDesign({ ...design, imageSize: 10 }, { ...design, imageSize: 90 })).toBe(true);
    expect(sameDesign({ ...design, text: "", font: "ronde", textY: 5 }, { ...design, text: "", font: "classique", textY: 80 })).toBe(true);
  });
});

describe("describeDesign", () => {
  it("résume ce qui a été choisi, pour le panier et la commande", () => {
    expect(describeDesign({ ...defaultDesign(mug), color: "laterite", text: "Miora", image })).toEqual({ color: "laterite", text: "Miora", hasImage: true });
  });
  it("lit aussi la copie figée d'une ligne de commande, et rend null si elle est illisible", () => {
    expect(describeDesign(JSON.stringify({ color: "indigo", text: "", image: null }))).toEqual({ color: "indigo", text: "", hasImage: false });
    expect(describeDesign("{pas du json")).toBeNull();
    expect(describeDesign(null)).toBeNull();
  });
});
