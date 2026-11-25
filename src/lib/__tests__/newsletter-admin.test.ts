import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db";
import { createTestDatabase } from "@/test/database";
import { removeNewsletterSubscriber } from "@/actions/admin/newsletter";
import { GET } from "@/app/api/admin/newsletter/route";

/*
 * Back-office de la lettre d'information, contre une vraie base (schéma temporaire) : retrait d'une adresse à la
 * demande de la personne, et export CSV. La session est simulée : `requireAdmin` lève une erreur comme le ferait
 * la redirection de Next pour un visiteur qui n'est pas administrateur.
 */

const test = vi.hoisted(() => ({ db: null as Db | null, role: null as string | null }));
vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db")>()),
  get db() {
    return test.db;
  },
}));
vi.mock("../auth", () => ({
  getUser: async () => (test.role ? { id: "u", email: "a@x.mg", name: "A", role: test.role, phone: null } : null),
  requireAdmin: async () => {
    if (test.role !== "ADMIN") throw new Error("NEXT_REDIRECT");
    return { id: "u", role: "ADMIN" };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));

let database: ReturnType<typeof createTestDatabase>;
let db: Db;

beforeAll(() => {
  database = createTestDatabase("lettre");
  db = test.db = database.db;
}, 60_000);
afterAll(() => database.drop());

beforeEach(async () => {
  test.role = "ADMIN";
  await db.newsletterSubscriber.deleteMany();
});

describe("removeNewsletterSubscriber", () => {
  it("retire l'adresse et laisse les autres", async () => {
    const [a, b] = await Promise.all([db.newsletterSubscriber.create({ data: { email: "a@exemple.mg" } }), db.newsletterSubscriber.create({ data: { email: "b@exemple.mg" } })]);
    expect(await removeNewsletterSubscriber(a.id)).toEqual({ ok: true, message: "newsletterRemoved" });
    expect((await db.newsletterSubscriber.findMany()).map((s) => s.id)).toEqual([b.id]);
  });
  it("ne fait rien sans session administrateur", async () => {
    const a = await db.newsletterSubscriber.create({ data: { email: "a@exemple.mg" } });
    test.role = "CUSTOMER";
    await expect(removeNewsletterSubscriber(a.id)).rejects.toThrow("NEXT_REDIRECT");
    expect(await db.newsletterSubscriber.count()).toBe(1);
  });
  it("ne plante pas sur une adresse déjà retirée (deux onglets, double clic)", async () => {
    const a = await db.newsletterSubscriber.create({ data: { email: "a@exemple.mg" } });
    await removeNewsletterSubscriber(a.id);
    expect(await removeNewsletterSubscriber(a.id)).toEqual({ ok: true, message: "newsletterRemoved" });
  });
});

describe("GET /api/admin/newsletter", () => {
  it("sert le CSV des inscrits, le plus récent d'abord, en pièce jointe datée", async () => {
    await db.newsletterSubscriber.create({ data: { email: "ancien@exemple.mg", createdAt: new Date("2026-11-17T20:30:05Z") } });
    await db.newsletterSubscriber.create({ data: { email: "recent@exemple.mg", createdAt: new Date("2026-11-20T09:00:00Z") } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="lettre-inscrits-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toBe("email,inscription\r\nrecent@exemple.mg,2026-11-20T12:00:00+03:00\r\nancien@exemple.mg,2026-11-17T23:30:05+03:00\r\n");
  });
  it("répond 404 sans rien révéler à un client connecté", async () => {
    await db.newsletterSubscriber.create({ data: { email: "secret@exemple.mg" } });
    test.role = "CUSTOMER";
    const res = await GET();
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("secret@exemple.mg");
  });
  it("répond 404 sans session", async () => {
    test.role = null;
    expect((await GET()).status).toBe(404);
  });
});
