import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * Point de vigilance 12 : un réglage de production manquant échoue en le nommant. Sans AUTH_SECRET (ou avec un secret
 * de moins de 32 caractères), aucune session ne s'ouvre : la connexion et l'inscription lèvent une erreur qui nomme la
 * variable, au lieu de signer les cookies avec une clé vide.
 */
const { set } = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set, get: () => undefined, delete: vi.fn() }) }));
vi.mock("@/i18n/server", () => ({ redirectTo: vi.fn() }));
vi.mock("../db", () => ({ db: {} }));

import { createSession } from "../auth";

afterEach(() => {
  vi.unstubAllEnvs();
  set.mockClear();
});

describe("AUTH_SECRET", () => {
  it("absent : l'ouverture de session échoue en nommant la variable, et aucun cookie n'est posé", async () => {
    vi.stubEnv("AUTH_SECRET", undefined);
    await expect(createSession("u1", "ADMIN")).rejects.toThrow(/AUTH_SECRET/);
    expect(set).not.toHaveBeenCalled();
  });

  it("trop court (31 caractères) : même refus", async () => {
    vi.stubEnv("AUTH_SECRET", "x".repeat(31));
    await expect(createSession("u1", "ADMIN")).rejects.toThrow(/AUTH_SECRET/);
    expect(set).not.toHaveBeenCalled();
  });

  it("32 caractères : la session est signée et posée dans un cookie httpOnly", async () => {
    vi.stubEnv("AUTH_SECRET", "x".repeat(32));
    await createSession("u1", "ADMIN");
    expect(set).toHaveBeenCalledWith("session", expect.stringMatching(/^eyJ/), expect.objectContaining({ httpOnly: true }));
  });
});
