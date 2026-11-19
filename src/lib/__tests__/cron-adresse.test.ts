import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/adresse/route";

/*
 * Route de diagnostic de l'adresse du client (PLAN.md 7.5, étapes 0 et 7) : protégée comme le nettoyage, elle renvoie
 * à l'appelant ce que le serveur a reçu pour sa propre requête, et rien d'autre.
 */

const SECRET = "secret-de-test-pour-le-diagnostic";
const call = (headers: Record<string, string> = {}) => GET(new Request("http://localhost/api/cron/adresse", { headers }));

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/adresse", () => {
  it("503 quand CRON_SECRET n'est pas défini, avec un message qui le nomme, même avec un secret fourni", async () => {
    vi.stubEnv("CRON_SECRET", undefined);
    const res = await call({ authorization: `Bearer ${SECRET}`, "x-nf-client-connection-ip": "203.0.113.7" });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/CRON_SECRET/);
    expect(JSON.stringify(body)).not.toContain("203.0.113.7");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("401 sans secret, avec un mauvais secret ou sans « Bearer », et rien de la requête n'est renvoyé", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    for (const authorization of [undefined, "Bearer mauvais-secret", SECRET]) {
      const res = await call({ ...(authorization && { authorization }), "x-nf-client-connection-ip": "203.0.113.7" });
      expect(res.status, String(authorization)).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Non autorisé." });
      expect(res.headers.get("cache-control")).toBe("private, no-store");
    }
  });

  it("avec le bon secret : renvoie l'adresse retenue et les trois en-têtes bruts, rien d'autre", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const res = await call({
      authorization: `Bearer ${SECRET}`,
      "x-nf-client-connection-ip": " 203.0.113.7 ",
      "x-forwarded-for": "198.51.100.9, 10.0.0.1",
      "x-real-ip": "192.0.2.4",
      "user-agent": "test",
      cookie: "session=abc",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    // Les en-têtes bruts tels que reçus (Headers retire les espaces aux bords), l'adresse telle que clientIp() la retient.
    expect(await res.json()).toEqual({
      clientIp: "203.0.113.7",
      nfClientConnectionIp: "203.0.113.7",
      forwardedFor: "198.51.100.9, 10.0.0.1",
      realIp: "192.0.2.4",
    });
  });

  it("avec le bon secret et sans en-tête d'adresse : tout vaut null", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clientIp: null, nfClientConnectionIp: null, forwardedFor: null, realIp: null });
  });

  it("sans x-nf-client-connection-ip : l'adresse retenue est la première de x-forwarded-for", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const res = await call({ authorization: `Bearer ${SECRET}`, "x-forwarded-for": "198.51.100.9, 10.0.0.1" });
    expect(await res.json()).toEqual({ clientIp: "198.51.100.9", nfClientConnectionIp: null, forwardedFor: "198.51.100.9, 10.0.0.1", realIp: null });
  });
});
