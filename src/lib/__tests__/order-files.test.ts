import { describe, expect, it } from "vitest";
import { downloadName, itemFile } from "../order-files";

const print = "perso-0b9f6c1e-7a52-4c1d-9e0f-3a1b2c3d4e5f.png";
const image = "perso-11111111-2222-4333-8444-555555555555.jpg";
const customization = JSON.stringify({ template: "mug", color: "laterite", text: "Miora", font: "enseigne", ink: "blanc", textSize: 50, textY: 50, image, imageSize: 60, imageX: 50, imageY: 50 });

describe("itemFile", () => {
  it("rend le nom du fichier d'impression désigné par la ligne de commande", () => {
    expect(itemFile({ printUrl: `/uploads/${print}`, customization }, "print")).toBe(print);
  });
  it("rend le nom de l'image envoyée par le client, lu dans la copie figée", () => {
    expect(itemFile({ printUrl: `/uploads/${print}`, customization }, "image")).toBe(image);
  });
  it("rend null pour un article sans fichier : couleur seule, ou article ordinaire", () => {
    const colorOnly = JSON.stringify({ template: "mug", color: "blanc", text: "", image: null });
    expect(itemFile({ printUrl: null, customization: colorOnly }, "print")).toBeNull();
    expect(itemFile({ printUrl: null, customization: colorOnly }, "image")).toBeNull();
    expect(itemFile({ printUrl: null, customization: null }, "image")).toBeNull();
  });
  it("rend null pour un nom en base qui n'a pas la forme d'un fichier généré par le serveur", () => {
    for (const printUrl of ["/uploads/../.env", "/uploads/photo.png", "/products/mug.jpg", `/uploads/${print}/../secret`, print])
      expect(itemFile({ printUrl, customization: null }, "print"), printUrl).toBeNull();
  });
  it("rend null pour une copie figée illisible", () => {
    expect(itemFile({ printUrl: null, customization: "{cassé" }, "image")).toBeNull();
  });
});

describe("downloadName", () => {
  it("assemble le numéro de commande, le rang de l'article, la nature du fichier et son extension", () => {
    expect(downloadName("AL-2611-0042", 1, "print", "png")).toBe("AL-2611-0042-1-impression.png");
    expect(downloadName("AL-2611-0042", 2, "image", "jpg")).toBe("AL-2611-0042-2-image.jpg");
  });
  it("ne garde que lettres, chiffres, tirets et un seul point, quel que soit le numéro", () => {
    for (const number of ['AL/../"x";\r\nSet-Cookie: a=b', "AL 2611 é 0042", "../../etc/passwd", "A.L.1", "—"]) {
      const name = downloadName(number, 1, "print", "png");
      expect(name, number).toMatch(/^[A-Za-z0-9-]+\.png$/);
      expect(name, number).not.toMatch(/^-|--/);
    }
  });
  it("donne un nom même quand le numéro ne contient rien d'utilisable", () => {
    expect(downloadName("///", 3, "image", "webp")).toBe("commande-3-image.webp");
  });
  it("nettoie l'extension et le rang", () => {
    expect(downloadName("AL-1", 0, "image", "P.N/G")).toBe("AL-1-1-image.png");
    expect(downloadName("AL-1", 2.7, "print", "")).toBe("AL-1-2-impression.bin");
  });
});
