import { describe, expect, it } from "vitest";
import { frozenDeployContext, frozenPreviewUrl, indexable, robotsHeaders, uploadStore } from "../deploy-context";

/*
 * Contexte de déploiement (PLAN.md 7.6) : la production garde son magasin d'images et son référencement, tout autre
 * déploiement Netlify (branche `preview`, aperçu de demande de fusion) a les siens et n'est pas indexé.
 */

describe("frozenDeployContext : valeur figée à la compilation (next.config.ts)", () => {
  it("compilation Netlify : le CONTEXT que Netlify pose pour la compilation", () => {
    expect(frozenDeployContext({ NETLIFY: "true", CONTEXT: "production" })).toBe("production");
    expect(frozenDeployContext({ NETLIFY: "true", CONTEXT: "branch-deploy" })).toBe("branch-deploy");
    expect(frozenDeployContext({ NETLIFY: "true", CONTEXT: "deploy-preview" })).toBe("deploy-preview");
  });

  it("compilation Netlify sans CONTEXT : « unknown », jamais « production »", () => {
    expect(frozenDeployContext({ NETLIFY: "true" })).toBe("unknown");
    expect(frozenDeployContext({ NETLIFY: "true", CONTEXT: "" })).toBe("unknown");
  });

  it("hors de Netlify (poste local, tests navigateur) : « local », même si CONTEXT traîne dans l'environnement", () => {
    expect(frozenDeployContext({})).toBe("local");
    expect(frozenDeployContext({ CONTEXT: "production" })).toBe("local");
    expect(frozenDeployContext({ NETLIFY: "false", CONTEXT: "production" })).toBe("local");
  });
});

describe("uploadStore : magasin Netlify Blobs des envois", () => {
  it("la production garde « uploads »", () => {
    expect(uploadStore("production")).toBe("uploads");
  });

  it("tout autre contexte écrit dans « uploads-preview », inconnu compris", () => {
    for (const context of ["branch-deploy", "deploy-preview", "dev", "unknown", "local", "", "Production"]) {
      expect(uploadStore(context), context).toBe("uploads-preview");
    }
  });
});

describe("indexable et robotsHeaders : référencement", () => {
  it("la production et le poste local sont indexables, sans en-tête de plus", () => {
    for (const context of ["production", "local"]) {
      expect(indexable(context), context).toBe(true);
      expect(robotsHeaders(context), context).toEqual([]);
    }
  });

  it("tout autre déploiement Netlify : X-Robots-Tag: noindex", () => {
    for (const context of ["branch-deploy", "deploy-preview", "dev", "unknown", ""]) {
      expect(indexable(context), context).toBe(false);
      expect(robotsHeaders(context), context).toEqual([{ key: "X-Robots-Tag", value: "noindex" }]);
    }
  });
});

describe("frozenPreviewUrl : adresse du déploiement figée à la compilation, hors production seulement", () => {
  const PRIME = "https://preview--alarobia-shop.netlify.app";

  it("déploiement de branche, aperçu ou contexte inconnu : DEPLOY_PRIME_URL, sans barre finale", () => {
    expect(frozenPreviewUrl("branch-deploy", PRIME)).toBe(PRIME);
    expect(frozenPreviewUrl("deploy-preview", "https://deploy-preview-1--alarobia-shop.netlify.app/")).toBe("https://deploy-preview-1--alarobia-shop.netlify.app");
    expect(frozenPreviewUrl("unknown", PRIME)).toBe(PRIME);
  });

  it("production et poste local : rien, même si DEPLOY_PRIME_URL est donnée", () => {
    expect(frozenPreviewUrl("production", "https://main--alarobia-shop.netlify.app")).toBe("");
    expect(frozenPreviewUrl("local", PRIME)).toBe("");
  });

  it("DEPLOY_PRIME_URL absente : rien", () => {
    expect(frozenPreviewUrl("branch-deploy", undefined)).toBe("");
    expect(frozenPreviewUrl("branch-deploy", "")).toBe("");
  });
});
