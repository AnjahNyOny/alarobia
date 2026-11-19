import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/uploads/[name]/route";
import { saveUpload } from "../storage";

/* Route qui sert les fichiers envoyés (`/uploads/<nom>`), sur le stockage du disque, dans un dossier temporaire. */

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const NAME = "perso-00000000-0000-4000-8000-000000000001.png";
const get = (name: string) => GET(new Request(`http://localhost/uploads/${name}`), { params: Promise.resolve({ name }) });

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "alarobia-servis-"));
  vi.stubEnv("UPLOAD_DIR", path.relative(process.cwd(), dir));
  vi.stubEnv("SITE_ID", undefined);
  vi.stubEnv("NETLIFY_BLOBS_CONTEXT", undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("GET /uploads/[name]", () => {
  it("sert le fichier avec son type, mis en cache un an par le navigateur et par le réseau de Netlify", async () => {
    await saveUpload(NAME, PNG, "image/png");
    const res = await get(NAME);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    // Les demandes suivantes sont servies par le réseau de Netlify, sans relancer la fonction ni relire le magasin.
    expect(res.headers.get("netlify-cdn-cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("404 pour un fichier absent ou un nom qui n'est pas celui d'un envoi", async () => {
    expect((await get("perso-00000000-0000-4000-8000-000000000002.png")).status).toBe(404);
    expect((await get("..%2F.env")).status).toBe(404);
    expect((await get("page.html")).status).toBe(404);
  });
});
