# Alarobia — boutique en ligne

Plateforme e-commerce pour Madagascar : objets du quotidien, catalogue libre (le propriétaire doit pouvoir y vendre ce qu'il veut), personnalisation des produits en 3D, interface en français, anglais et malgache.

« Alarobia » signifie mercredi en malgache. Le projet a d'abord été construit sous le nom provisoire « Sève » (boutique généraliste en français, en euros) ; il est en cours de refonte.

**Avant de coder, lire [PLAN.md](PLAN.md) et [PROGRESS.md](PROGRESS.md).** Le plan dit quoi faire et dans quel ordre ; le suivi dit où on en est. Ce fichier décrit les règles qui valent pour tout le projet.

## Façon de travailler

1. Prendre la prochaine tâche non cochée de `PROGRESS.md`, dans l'ordre des phases de `PLAN.md`.
2. Charger le skill qui correspond (tableau ci-dessous) avant d'écrire du code.
3. Écrire le test d'abord quand la tâche porte sur de la logique (prix, panier, traductions, validation).
4. Vérifier pour de bon avant de dire que c'est fait : `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, puis le parcours navigateur et des captures d'écran pour tout changement visible.
5. Mettre à jour `PROGRESS.md` : cocher la tâche, noter ce qui a été vérifié et toute décision prise.
6. Committer chaque tâche finie et vérifiée, un commit par tâche (autorisé par le propriétaire le 16/11/2026). Ne pas pousser vers GitHub sans sa demande : un envoi déclenche un déploiement Vercel.

Le propriétaire a rejeté une première version jugée « comme tous les sites e-commerce ». Une demande explicite d'outil ou de méthode (un skill, une bibliothèque) se suit telle quelle ; si c'est impossible, le dire tout de suite plutôt que de substituer autre chose.

## Délégation aux sous-agents

La session principale (Fable ou Opus) est l'architecte. Elle lit le plan, découpe la tâche, rédige les consignes, relit les résultats et tient `PROGRESS.md`. Les tâches de développement partent chez le sous-agent du niveau qui convient, et toutes les vérifications chez `verificateur`. Cette section vaut demande explicite du propriétaire de lancer des sous-agents.

L'architecte peut modifier le code lui-même (autorisé par le propriétaire le 16/11/2026) quand c'est plus court que de rédiger une consigne : correctif de quelques lignes déjà diagnostiqué, retouche après relecture d'un diff ou d'une capture, fichier qu'il vient de lire. Une tâche entière du plan, ou un bug dont la cause reste à trouver, part toujours chez `developpeur`. Ses modifications passent par `verificateur` comme celles d'un sous-agent, et il ne modifie pas des fichiers qu'un sous-agent est en train d'écrire.

| Sous-agent (`.claude/agents/`) | Modèle | Ce qu'on lui confie |
| --- | --- | --- |
| `developpeur` | Opus | Tâche complète qui demande du jugement : nouvelle logique, action serveur, composant d'interface, bug dont la cause reste à trouver. |
| `executant` | Sonnet | Changement court et entièrement spécifié : clés de traduction, même retouche dans plusieurs fichiers, test d'une fonction existante, correctif déjà diagnostiqué. |
| `verificateur` | Haiku | Lancer lint, types, tests, build, tests navigateur, captures d'écran, et rapporter. Ne modifie rien. |
| `Explore` (intégré) | — | Chercher dans le code quand la réponse demande de parcourir beaucoup de fichiers. |

Ce qui reste chez l'architecte : le découpage, les choix d'architecture et de schéma, la direction visuelle et la critique sur capture d'écran, la relecture des diffs, `PROGRESS.md`, les commits.

- **Consigne complète.** Un sous-agent part de zéro et ne voit pas la conversation. Lui donner le but et à quoi il sert, les fichiers concernés, ce qui est déjà décidé ou écarté, le critère de fin, ce qu'il ne doit pas toucher, et la forme du rapport attendu.
- **Un seul sous-agent qui écrit à la fois**, sauf si les fichiers sont clairement disjoints. Un seul `build` ou `test:e2e` à la fois (port 3100, `prisma/test.db`).
- **Un rapport n'est pas une preuve.** Relire le `git diff` de chaque sous-agent, puis faire passer `verificateur`, avant de cocher la tâche.
- **Changer de niveau plutôt qu'insister.** Si un `executant` signale que la tâche dépasse sa consigne, la confier à `developpeur` avec ce qu'il a trouvé.
- Les sous-agents ne committent pas et ne touchent ni à `PROGRESS.md`, ni à `PLAN.md`, ni à ce fichier.

## Skills installés (`.claude/skills/`)

| Skill | Source | Quand le charger |
| --- | --- | --- |
| `frontend-design` | anthropics/skills | Toute création ou retouche d'interface. Suivre sa méthode : plan, relecture contre les clichés, construction, critique sur capture d'écran. |
| `writing-plans` | obra/superpowers | Avant de détailler une phase du plan ou d'en ajouter une. |
| `test-driven-development` | obra/superpowers | Toute nouvelle logique ou correction de bug. |
| `systematic-debugging` | obra/superpowers | Tout bug ou comportement inattendu : chercher la cause avant de corriger. |
| `verification-before-completion` | obra/superpowers | Avant d'annoncer qu'une tâche est finie. |
| `webapp-testing` | anthropics/skills | Référence pour les tests navigateur (le projet utilise Playwright en Node, pas en Python). |

Versions copiées le 13/11/2026 : `obra/superpowers@22f0b46` (MIT), `anthropics/skills@2c5958e` (Apache 2.0). Lire le contenu d'un skill tiers avant de l'ajouter.

## Commandes

```bash
npm run dev -- -p 3001   # le port 3000 est souvent pris par un autre projet du propriétaire
npm run build && npm run start
npm run lint
npx tsc --noEmit
npm test                 # tests unitaires (Vitest)
npm run test:e2e         # tests navigateur (Playwright) : compile en production sur le port 3100, base prisma/test.db
npm run db:reset         # recrée la base et recharge les données de démonstration (efface tout)
npm run db:seed
node scripts/poids-pages.mjs        # poids transféré des pages, contre un serveur de production (lire l'en-tête)
node scripts/mesure-telephone.mjs   # temps en 3G lente sur téléphone ralenti (FCP, LCP, CLS, hydratation, 3D)
```

Comptes de démonstration : `admin@alarobia.example` / `admin1234`, `client@alarobia.example` / `client1234`. Adresses : `/fr/admin`, `/fr/login`.

## Architecture

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind v4, shadcn/ui sur Base UI, Prisma + SQLite, Zod.

```
prisma/schema.prisma     modèle de données (statuts en chaînes : SQLite n'a pas d'enum)
prisma/seed.mjs          données de démonstration, déterministes
src/actions/             actions serveur : toute écriture en base passe par ici
src/lib/                 db, auth (JWT en cookie), cart (cookie), pricing, promo (code consommé sous condition), schemas Zod, format, localize (repli sur le français), address (provinces, téléphone), shipping (zones, dates promises), customization (dessin d'un client), upload (contrôle des images envoyées), rate-limit (limites de débit, en mémoire), seo (canonique, hreflang)
src/lib/customizer/      mise en place du dessin (layout), tracé sur canevas (paint), objet vu à plat (flat) : fonctions pures, testées
src/components/customizer/  personnalisation : scène 3D (scene, models), objet en direct 3D ou à plat (live-object), onglets et réglages de la fiche (stage, controls), démonstration de l'accueil (home-demo), chargement à la demande (lazy, fiche), écritures proposées (fonts)
src/components/ui/       shadcn/ui
src/components/store/    boutique
src/components/admin/    back-office
src/app/[locale]/(store)/  pages publiques et espace client
src/app/[locale]/admin/    back-office (rôle ADMIN)
src/i18n/                routage par langue, navigation, fusion des messages
messages/                textes de l'interface : fr.json (socle), en.json, mg.json
src/app/globals.css      jetons de design, polices de remplacement calibrées
src/app/fonts/           Archivo réduite aux graisses et largeurs du site (scripts/police-archivo.py)
assets/fonts/            Archivo en instances fixes pour l'image de partage (satori), licence OFL
uploads/                 fichiers envoyés, servis par src/app/uploads/[name]/route.ts
e2e/                     tests navigateur ; parcours complets dans les trois langues : parcours*.spec.ts, étapes dans parcours.ts
scripts/                 mesures (poids, 3G, hydratation), nettoyage des personnalisations, icône, police
```

## Règles de code

- **Argent** : entiers en unités mineures (centimes), jamais de flottants. Les totaux sont toujours recalculés côté serveur ; le cookie du panier ne contient que des identifiants et des quantités.
- **Autorisations** : chaque action serveur revérifie la session (`requireUser`, `requireAdmin`). Le proxy (`src/proxy.ts`, l'ancien middleware) n'est qu'un premier filtre. Toute lecture d'une commande filtre sur son propriétaire.
- **Stock** : décrément conditionnel dans une transaction (`stock >= quantité`).
- **Validation** : Zod sur toute entrée, messages d'erreur rattachés au champ.
- **Formulaires** : utiliser `<Form>` de `src/components/form.tsx`, pas `<form action>`. React 19 vide les champs après une action ; `<Form>` conserve la saisie en cas d'erreur.
- **Navigation** : importer `Link`, `useRouter`, `usePathname` depuis `@/i18n/navigation` (jamais `next/link`), et rediriger côté serveur avec `redirectTo` de `@/i18n/server`. Les chemins s'écrivent sans préfixe de langue.
- **Boutons-liens** : `buttonVariants()` passe par `cn` pour que la variante remplace bien les classes de base. Ne pas appeler `cva` directement.
- **Fichiers envoyés** : nom généré côté serveur, type et taille contrôlés, jamais de chemin fourni par le client.
- **Textes** : aucun texte en dur dans les composants une fois la phase 1 faite ; tout passe par les fichiers de messages, dans les trois langues.

## Règles de design

Identité voulue : un marché malgache du quotidien, pas une boutique « lifestyle » internationale. Le détail (palette, typographie, logo, mise en page) est fixé en phase 2 de `PLAN.md`.

À ne pas refaire, ce sont les signes d'un design générique relevés par le skill `frontend-design` et présents dans la première version :

- fond crème avec titre en serif contrasté et accent terre cuite ;
- un seul mot du titre en italique ou en couleur ;
- petits libellés en majuscules espacées au-dessus des titres ;
- numérotation 01 / 02 / 03 sur un contenu qui n'est pas une séquence ;
- métadonnées séparées par des points médians, flèches collées aux liens ;
- même rayon, même ombre et même effet de survol sur toutes les cartes ;
- animations d'apparition sur chaque section.

Une seule audace par page, le reste sobre. Plancher de qualité non négociable : mobile, focus clavier visible, `prefers-reduced-motion`, contrastes lisibles.

## Pièges connus

- **Ne jamais utiliser `pkill -f "next dev"`** : cela tuerait aussi les autres serveurs Next du propriétaire. Cibler le port : `lsof -ti tcp:3001 -sTCP:LISTEN`.
- **Node** : la machine a Node 21 par défaut (fin de vie), le projet demande Node 22 (`.nvmrc`). Avant toute commande : `nvm use`, ou préfixer le `PATH` avec `~/.nvm/versions/node/v22.16.0/bin`.
- **Turbopack en dev** peut ignorer des fichiers créés pendant qu'il tourne (404 sur une page qui existe, erreurs d'hydratation fantômes). Redémarrer le serveur et supprimer `.next` avant de conclure à un bug.
- **Erreurs d'hydratation (#418) : ne pas redescendre sous Next 16.** Sous Next 15.5, React démarrait parfois l'hydratation avant d'avoir reçu toutes les données d'un composant serveur asynchrone, et se décalait par rapport au HTML : erreur intermittente, uniquement avec le JavaScript en cache, jusqu'à 25 % des chargements sous charge. Next 16 corrige le défaut (0 erreur sur 2 400 chargements). Le banc d'essai est dans le dépôt : `node scripts/stress-hydratation.mjs http://localhost:3100 /fr/help 600` contre un serveur de production. Deux précautions prises pendant l'enquête sont conservées : la mise en page charge ses données une seule fois (`loadShell`) au lieu d'avoir plusieurs composants asynchrones côte à côte, et les boutons de menu ont un `id` fixe.
- **Prisma refuse `db push --force-reset` lancé par un agent.** C'est voulu. Pour repartir de zéro, `npm run db:seed` vide et remplit les tables ; `npm run db:reset` est à lancer par le propriétaire.
- **Débordement horizontal** : dans un test en émulation mobile, comparer `scrollWidth` à `clientWidth` (`innerWidth` s'élargit avec le contenu et masque le défaut). Deux causes déjà rencontrées : une colonne de grille ou un `fieldset` sans `min-w-0`, et un `sr-only` dans un conteneur `overflow-x-auto` qui n'est pas `relative`.
- **Montants** : colonnes en entiers 32 bits, plafond `MAX_ORDER_CENTS` (20 000 000 Ar), défini dans `src/lib/constants.ts` et réexporté par `src/lib/pricing.ts`.
- **Dates de livraison** : partir de `madagascarTime()` (`src/lib/shipping.ts`), jamais de `new Date()` seul : le serveur peut tourner dans un autre fuseau.
- **Schéma Prisma** : `db push` refuse de supprimer une colonne remplie. Ajouter des colonnes avec une valeur par défaut ; les colonnes devenues inutiles sont marquées « obsolètes » dans le schéma.
- **Constante exportée d'un fichier `"use client"`** : importée dans un composant serveur, elle arrive sous forme de référence, pas de valeur, et toute comparaison échoue en silence. Les valeurs lues des deux côtés vont dans `src/lib/` (exemple : `src/lib/customizer/demo.ts`).
- **Polices** : ne pas redéclarer Archivo avec `next/font` dans un second fichier, le navigateur la téléchargerait deux fois (57 ko). La personnalisation lit son nom dans la variable CSS `--font-archivo`.
- **Polices de remplacement** (`globals.css`, familles « Archivo Fallback » sur Arial et « Archivo Fallback Roboto » pour Android) : une face par largeur employée (100, 78, 68 %), `size-adjust` mesuré sur les textes du site. Elles évitent tout décalage pendant le chargement d'Archivo (CLS 0). Une nouvelle largeur (`font-stretch`) dans un utilitaire demande sa face dans les deux familles : `fallback-font.test.ts` échoue sinon. Côté Android, `RobotoStatic-Regular` doit rester la première source : Chrome resserre la Roboto variable par son axe `wdth`.
- **CSS écrite dans le HTML** (`experimental.inlineCss`, `next.config.ts`) : seule la feuille de la route l'est. Une règle importée seulement par un composant chargé par `next/dynamic` (une police `next/font` par exemple) revient en `<link rel="stylesheet">` et retarde l'affichage de 2 s en 3G : l'importer aussi depuis la page (exemple : `customizer/fonts.ts` dans `products/[slug]/page.tsx`). `e2e/performance.spec.ts` le contrôle, avec les budgets de poids.
- **Three.js n'est chargé qu'à la demande** (243 ko compressé) : n'importer `scene.tsx` ou `live-object.tsx` que par `next/dynamic`, jamais directement depuis l'accueil ou le catalogue. Vérifier avec `node scripts/poids-pages.mjs`.
- **Scène 3D et tests** : le cadre `[data-view="3d"]` existe avant que la scène ne soit téléchargée ; un test qui agit sur la 3D attend `[data-view="3d"] canvas`. En se fermant, la scène libère son contexte WebGL et déclenche `webglcontextlost` une demi-seconde plus tard : ce n'est pas une panne.
- **Tests navigateur** :
  - le projet `mobile` (Pixel 7) ne prend que les fichiers dont le nom contient `mobile`, le projet `ordinateur` les ignore ;
  - toute la suite partage une adresse (`::1`) pour les limites de débit : marge la plus faible, 30 échecs de connexion par 15 min. Un test qui en provoque beaucoup envoie son propre `x-forwarded-for` ;
  - `admin.spec.ts` supprime des zones de livraison sans les recréer : ne pas supposer les zones du seed ;
  - une compilation dans un `NEXT_DIST_DIR` que git n'ignore pas modifie `tsconfig.json` et fait lire ses fichiers à Tailwind : compiler dans `.next-e2e` ou un dossier ignoré, et rendre `tsconfig.json` après usage ;
  - capture `fullPage` : les éléments `sticky` et `fixed` (en-tête, objet de la personnalisation, barre latérale du back-office) apparaissent décalés. Ce n'est pas un défaut de la page.
- **Mesures de temps** : la machine du propriétaire fait tourner d'autres travaux (autre projet, Roblox Studio). Les temps de `mesure-telephone.mjs` ne valent qu'avec une charge (`uptime`) inférieure à 6, sinon en séries alternées avant / après. Les octets, eux, ne dépendent pas de la charge.
- **Pas de configuration Prettier** dans le dépôt : `npx prettier --write` recoupe tout à 80 colonnes. Ne pas le lancer sur les fichiers existants.
- **Recherche de photos** : l'interface non officielle d'Unsplash est bloquée dans cet environnement. Utiliser les photos de `public/products/` ou celles fournies par le propriétaire.

## Limites actuelles (voir phase 7)

Paiement Mobile Money confirmé à la main par le vendeur (pas d'API opérateur), aucun e-mail envoyé, SQLite (échoue au-delà d'une dizaine de transactions simultanées) et fichiers sur disque local, limites de débit en mémoire et adresse du client forgeable sans proxy de confiance, heures du back-office dans le fuseau du serveur, mentions légales à compléter, malgache à faire relire.
