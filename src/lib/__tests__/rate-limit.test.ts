import { describe, expect, it, vi } from "vitest";
import { clientIp, createRateLimiter, retryMinutes, withRateLimit } from "../rate-limit";

describe("createRateLimiter", () => {
  it("laisse passer jusqu'à la limite, puis refuse", () => {
    const allow = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => 1000 });
    expect([allow("a"), allow("a"), allow("a"), allow("a")]).toEqual([true, true, true, false]);
  });
  it("compte chaque clé séparément", () => {
    const allow = createRateLimiter({ limit: 1, windowMs: 60_000, now: () => 1000 });
    expect(allow("a")).toBe(true);
    expect(allow("b")).toBe(true);
    expect(allow("a")).toBe(false);
  });
  it("laisse repasser une fois la fenêtre écoulée", () => {
    let now = 0;
    const allow = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
    allow("a");
    now = 600;
    allow("a");
    expect(allow("a")).toBe(false);
    now = 1001; // le premier envoi est sorti de la fenêtre, pas le second
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(false);
  });
  it("oublie les clés inactives au lieu de les garder en mémoire", () => {
    let now = 0;
    const allow = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
    for (let i = 0; i < 500; i++) allow(`ip-${i}`);
    now = 5000;
    allow("nouvelle");
    expect(allow.size()).toBe(1);
  });
  it("ne limite jamais une clé inconnue : sans adresse, tous les visiteurs partageraient le même compteur", () => {
    const allow = createRateLimiter({ limit: 1, windowMs: 60_000, now: () => 1000 });
    expect([allow(null), allow(null), allow(null)]).toEqual([true, true, true]);
    allow.record(null);
    expect(allow.retryIn(null)).toBe(0);
    expect(allow.size()).toBe(0);
  });
});

describe("retryIn et record : compter sans consommer", () => {
  it("retryIn ne compte rien", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => 1000 });
    for (let i = 0; i < 10; i++) expect(limiter.retryIn("a")).toBe(0);
    expect(limiter("a")).toBe(true);
  });
  it("record compte, et retryIn donne l'attente avant que la plus ancienne tentative sorte de la fenêtre", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => now });
    limiter.record("a");
    now = 10_000;
    limiter.record("a");
    now = 15_000;
    expect(limiter.retryIn("a")).toBe(45_000);
    now = 60_001;
    expect(limiter.retryIn("a")).toBe(0);
  });
});

describe("retryMinutes", () => {
  it("arrondit à la minute supérieure, une minute au moins", () => {
    expect(retryMinutes(1)).toBe(1);
    expect(retryMinutes(60_000)).toBe(1);
    expect(retryMinutes(60_001)).toBe(2);
    expect(retryMinutes(14 * 60_000 + 5)).toBe(15);
  });
});

describe("withRateLimit : seuls les échecs comptent", () => {
  const setup = (limit = 3) => {
    let now = 0;
    const byEmail = createRateLimiter({ limit, windowMs: 15 * 60_000, now: () => now });
    const byIp = createRateLimiter({ limit: 30, windowMs: 15 * 60_000, now: () => now });
    return { byEmail, byIp, tick: (ms: number) => (now += ms) };
  };
  const wrong = async () => false;
  const right = async () => true;
  const failed = (ok: boolean) => !ok;

  it("une réussite ne consomme rien", async () => {
    const { byEmail } = setup(1);
    for (let i = 0; i < 5; i++) expect(await withRateLimit([[byEmail, "a@x.mg"]], right, failed)).toEqual({ limited: false, value: true });
    expect(byEmail.retryIn("a@x.mg")).toBe(0);
  });

  it("compte chaque échec sur toutes les clés, puis refuse sans même tenter", async () => {
    const { byEmail, byIp } = setup(3);
    const checks = [[byEmail, "a@x.mg"], [byIp, "197.149.1.20"]] as const;
    for (let i = 0; i < 3; i++) expect(await withRateLimit(checks, wrong, failed)).toEqual({ limited: false, value: false });
    const attempt = vi.fn(right);
    expect(await withRateLimit(checks, attempt, failed)).toEqual({ limited: true, minutes: 15 });
    // Le bon mot de passe n'est même pas comparé : pas de calcul coûteux, et rien n'indique s'il était juste.
    expect(attempt).not.toHaveBeenCalled();
    expect(byIp.retryIn("197.149.1.20")).toBe(0);
  });

  it("bloque sur la clé la plus chargée et donne la plus longue attente", async () => {
    const { byEmail, byIp, tick } = setup(2);
    await withRateLimit([[byEmail, "a@x.mg"]], wrong, failed);
    tick(5 * 60_000);
    await withRateLimit([[byEmail, "a@x.mg"]], wrong, failed);
    expect(await withRateLimit([[byIp, "1.2.3.4"], [byEmail, "a@x.mg"]], right, failed)).toEqual({ limited: true, minutes: 10 });
  });

  it("des tentatives envoyées en rafale ne dépassent pas la limite", async () => {
    const { byEmail } = setup(3);
    const attempt = vi.fn(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5)));
    const results = await Promise.all(Array.from({ length: 10 }, () => withRateLimit([[byEmail, "a@x.mg"]], attempt, failed)));
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(results.filter((r) => r.limited)).toHaveLength(7);
  });

  it("une tentative en cours qui réussit rend sa place", async () => {
    const { byEmail } = setup(1);
    expect(await withRateLimit([[byEmail, "a@x.mg"]], right, failed)).toEqual({ limited: false, value: true });
    expect(await withRateLimit([[byEmail, "a@x.mg"]], wrong, failed)).toEqual({ limited: false, value: false });
    expect(await withRateLimit([[byEmail, "a@x.mg"]], right, failed)).toMatchObject({ limited: true });
  });

  it("une tentative qui lève une erreur ne compte pas", async () => {
    const { byEmail } = setup(1);
    await expect(withRateLimit([[byEmail, "a@x.mg"]], () => Promise.reject(new Error("base indisponible")), failed)).rejects.toThrow("base indisponible");
    expect(byEmail.retryIn("a@x.mg")).toBe(0);
  });

  it("compte aussi les réussites quand c'est ce qu'on limite (comptes créés)", async () => {
    const { byEmail } = setup(2);
    const created = (ok: boolean) => ok;
    await withRateLimit([[byEmail, "1.2.3.4"]], wrong, created);
    expect(byEmail.retryIn("1.2.3.4")).toBe(0);
    await withRateLimit([[byEmail, "1.2.3.4"]], right, created);
    await withRateLimit([[byEmail, "1.2.3.4"]], right, created);
    expect(await withRateLimit([[byEmail, "1.2.3.4"]], right, created)).toMatchObject({ limited: true });
  });

  it("une autre clé reste libre", async () => {
    const { byEmail } = setup(1);
    await withRateLimit([[byEmail, "a@x.mg"]], wrong, failed);
    expect(await withRateLimit([[byEmail, "b@x.mg"]], right, failed)).toEqual({ limited: false, value: true });
  });

  it("une clé inconnue (adresse absente) ne bloque jamais, les autres clés s'appliquent toujours", async () => {
    const { byEmail, byIp } = setup(2);
    const checks = [[byEmail, "a@x.mg"], [byIp, null]] as const;
    await withRateLimit(checks, wrong, failed);
    await withRateLimit(checks, wrong, failed);
    expect(await withRateLimit(checks, right, failed)).toMatchObject({ limited: true });
    expect(await withRateLimit([[byIp, null]], right, failed)).toEqual({ limited: false, value: true });
  });
});

describe("clientIp", () => {
  it("sur Netlify, lit d'abord x-nf-client-connection-ip, posé par Netlify, avant x-forwarded-for et x-real-ip", () => {
    const headers = new Headers({ "x-nf-client-connection-ip": "197.149.1.20", "x-forwarded-for": "6.6.6.6, 10.0.0.1", "x-real-ip": "7.7.7.7" });
    expect(clientIp(headers)).toBe("197.149.1.20");
  });
  it("retire les espaces autour de x-nf-client-connection-ip", () => {
    expect(clientIp(new Headers({ "x-nf-client-connection-ip": " 2c0f:f4c0::1 " }))).toBe("2c0f:f4c0::1");
  });
  it("ignore un x-nf-client-connection-ip vide et passe à x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-nf-client-connection-ip": " ", "x-forwarded-for": "197.149.1.20" }))).toBe("197.149.1.20");
  });
  it("prend la première adresse de x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "197.149.1.20, 10.0.0.1" }))).toBe("197.149.1.20");
  });
  it("se rabat sur x-real-ip", () => {
    expect(clientIp(new Headers({ "x-real-ip": "41.188.2.3" }))).toBe("41.188.2.3");
  });
  it("renvoie null quand l'adresse est inconnue, plutôt qu'une clé commune à tous", () => {
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp(new Headers({ "x-forwarded-for": " , 10.0.0.1" }))).toBeNull();
  });
});
