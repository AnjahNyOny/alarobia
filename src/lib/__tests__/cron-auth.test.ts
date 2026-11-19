import { afterEach, describe, expect, it, vi } from "vitest";
import { refuseCron } from "../cron-auth";

/* Contrôle du secret partagé des routes appelées par une tâche planifiée (`/api/cron/…`). */

const SECRET = "secret-de-test-partage";
const request = (authorization?: string) => new Request("http://localhost/api/cron/x", { headers: authorization ? { authorization } : {} });

afterEach(() => vi.unstubAllEnvs());

describe("refuseCron", () => {
  it("laisse passer (null) la requête qui porte « Bearer <CRON_SECRET> »", () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect(refuseCron(request(`Bearer ${SECRET}`), "nettoyage")).toBeNull();
  });

  it("503 sans CRON_SECRET, avant tout contrôle du secret, avec un message qui nomme la variable et l'opération", async () => {
    vi.stubEnv("CRON_SECRET", undefined);
    const res = refuseCron(request(`Bearer ${SECRET}`), "nettoyage");
    expect(res?.status).toBe(503);
    expect(await res!.json()).toEqual({ error: "CRON_SECRET n'est pas défini sur le serveur : nettoyage impossible." });
    expect(res!.headers.get("cache-control")).toBe("private, no-store");
  });

  it("CRON_SECRET vide compte comme absent : 503, jamais un secret vide accepté", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(refuseCron(request("Bearer "), "nettoyage")?.status).toBe(503);
  });

  it("401 sans en-tête, avec un mauvais secret, sans le préfixe « Bearer » ou avec un secret plus long", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    for (const authorization of [undefined, "Bearer mauvais", SECRET, `Bearer ${SECRET}x`, `bearer ${SECRET}`]) {
      const res = refuseCron(request(authorization), "nettoyage");
      expect(res?.status, String(authorization)).toBe(401);
      expect(await res!.json()).toEqual({ error: "Non autorisé." });
      expect(res!.headers.get("cache-control")).toBe("private, no-store");
    }
  });
});
