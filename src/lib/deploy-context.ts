/**
 * Contexte de déploiement (PLAN.md 7.6) : la production (`main`) garde ses images et son référencement ; un déploiement
 * de branche (`preview`) ou un aperçu de demande de fusion a son propre magasin d'images et n'est pas indexé.
 *
 * Netlify ne donne le contexte qu'à la compilation : `CONTEXT` vaut `production`, `deploy-preview`, `branch-deploy` ou
 * `dev` (https://docs.netlify.com/build/configure-builds/environment-variables/, « Read-only variables »). Ses fonctions
 * ne reçoivent à l'exécution que `URL`, `SITE_NAME` et `SITE_ID`
 * (https://docs.netlify.com/build/functions/environment-variables/). next.config.ts fige donc la valeur dans le code
 * serveur, sous le nom `DEPLOY_CONTEXT` (option `env`), et la lit pour ses en-têtes.
 *
 * Ce fichier n'importe rien : next.config.ts l'importe aussi.
 */

/** Hors de Netlify : poste local, tests unitaires et navigateur. */
export const LOCAL = "local";

/**
 * Valeur figée à la compilation, d'après l'environnement de la compilation. `NETLIFY` vaut `true` dans toute compilation
 * Netlify (même page). Une compilation Netlify sans `CONTEXT` donne `unknown`, traitée comme un aperçu : jamais comme
 * la production.
 */
export function frozenDeployContext(env: { NETLIFY?: string; CONTEXT?: string }): string {
  if (env.NETLIFY !== "true") return LOCAL;
  return env.CONTEXT || "unknown";
}

/**
 * Contexte du code en cours d'exécution : la valeur figée par next.config.ts. Absente (tests, ou figeage manqué), elle
 * compte comme `local` : indexable, et sur Netlify le magasin des aperçus (voir `uploadStore`).
 * `process.env.DEPLOY_CONTEXT` doit rester écrit en entier pour être remplacé à la compilation.
 */
export function currentDeployContext(): string {
  return process.env.DEPLOY_CONTEXT || LOCAL;
}

/**
 * Adresse du déploiement, figée à la compilation hors production (next.config.ts, sous le nom `PREVIEW_SITE_URL`) :
 * `DEPLOY_PRIME_URL`, « the primary URL for an individual deploy, or a group of them, like branch deploys and Deploy
 * Previews; for example, `https://feature-branch--petsof.netlify.app` »
 * (https://docs.netlify.com/build/configure-builds/environment-variables/). Pour la branche `preview` :
 * https://preview--alarobia-shop.netlify.app. Vide en production et en local : rien ne change pour eux.
 */
export function frozenPreviewUrl(context: string, primeUrl: string | undefined): string {
  if (context === "production" || context === LOCAL) return "";
  return (primeUrl ?? "").replace(/\/+$/, "");
}

/** Adresse du déploiement en cours hors production, vide en production. `process.env.PREVIEW_SITE_URL` reste écrit en entier. */
export function currentPreviewUrl(): string {
  return currentDeployContext() === "production" ? "" : process.env.PREVIEW_SITE_URL || "";
}

/**
 * Magasin Netlify Blobs des envois. Un magasin ouvert par `getStore` est commun à tous les déploiements du site
 * (https://docs.netlify.com/build/data-and-storage/netlify-blobs/) : sans cette séparation, un aperçu écrirait, et son
 * nettoyage supprimerait, dans les fichiers de la production. Seule la production, nommée explicitement, garde
 * `uploads` ; tout le reste, contexte inconnu compris, va dans `uploads-preview`. Une erreur dans ce sens se voit tout
 * de suite (images de la production introuvables) ; dans l'autre, un aperçu toucherait aux fichiers réels sans bruit.
 */
export function uploadStore(context: string): "uploads" | "uploads-preview" {
  return context === "production" ? "uploads" : "uploads-preview";
}

/**
 * Le site peut-il être indexé ? Oui en production et en local (les tests navigateur contrôlent le référencement de la
 * production) ; non pour tout autre déploiement Netlify. Netlify pose lui-même `X-Robots-Tag: noindex` sur les aperçus
 * de demande de fusion, mais pas sur les adresses de déploiement de branche (`preview--…`) : on le pose partout hors
 * production.
 */
export function indexable(context: string): boolean {
  return context === "production" || context === LOCAL;
}

/** En-têtes à ajouter sur toutes les adresses (next.config.ts) : `X-Robots-Tag: noindex` hors production. */
export function robotsHeaders(context: string): { key: string; value: string }[] {
  return indexable(context) ? [] : [{ key: "X-Robots-Tag", value: "noindex" }];
}
