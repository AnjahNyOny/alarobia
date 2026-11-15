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
6. Ne committer que si le propriétaire l'a demandé (voir « Décisions en attente » dans `PROGRESS.md`).

Le propriétaire a rejeté une première version jugée « comme tous les sites e-commerce ». Une demande explicite d'outil ou de méthode (un skill, une bibliothèque) se suit telle quelle ; si c'est impossible, le dire tout de suite plutôt que de substituer autre chose.

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
```

Comptes de démonstration : `admin@alarobia.example` / `admin1234`, `client@alarobia.example` / `client1234`. Adresses : `/fr/admin`, `/fr/login`.

## Architecture

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind v4, shadcn/ui sur Base UI, Prisma + SQLite, Zod.

```
prisma/schema.prisma     modèle de données (statuts en chaînes : SQLite n'a pas d'enum)
prisma/seed.mjs          données de démonstration, déterministes
src/actions/             actions serveur : toute écriture en base passe par ici
src/lib/                 db, auth (JWT en cookie), cart (cookie), pricing, schemas Zod, format, address (provinces, téléphone), shipping (zones, dates promises)
src/components/ui/       shadcn/ui
src/components/store/    boutique
src/components/admin/    back-office
src/app/[locale]/(store)/  pages publiques et espace client
src/app/[locale]/admin/    back-office (rôle ADMIN)
src/i18n/                routage par langue, navigation, fusion des messages
messages/                textes de l'interface : fr.json (socle), en.json, mg.json
src/app/globals.css      jetons de design
uploads/                 fichiers envoyés, servis par src/app/uploads/[name]/route.ts
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
- **Erreurs d'hydratation (#418) : ne pas redescendre sous Next 16.** Sous Next 15.5, React démarrait parfois l'hydratation avant d'avoir reçu toutes les données d'un composant serveur asynchrone, et se décalait par rapport au HTML : erreur intermittente, uniquement avec le JavaScript en cache, jusqu'à 25 % des chargements sous charge. Next 16 corrige le défaut (0 erreur sur 2 400 chargements). Le banc d'essai est dans le dépôt : `node scripts/stress-hydratation.mjs http://localhost:3100 /aide 600` contre un serveur de production. Deux précautions prises pendant l'enquête sont conservées : la mise en page charge ses données une seule fois (`loadShell`) au lieu d'avoir plusieurs composants asynchrones côte à côte, et les boutons de menu ont un `id` fixe.
- **Prisma refuse `db push --force-reset` lancé par un agent.** C'est voulu. Pour repartir de zéro, `npm run db:seed` vide et remplit les tables ; `npm run db:reset` est à lancer par le propriétaire.
- **Débordement horizontal** : dans un test en émulation mobile, comparer `scrollWidth` à `clientWidth` (`innerWidth` s'élargit avec le contenu et masque le défaut). Deux causes déjà rencontrées : une colonne de grille ou un `fieldset` sans `min-w-0`, et un `sr-only` dans un conteneur `overflow-x-auto` qui n'est pas `relative`.
- **Montants** : colonnes en entiers 32 bits, plafond `MAX_ORDER_CENTS` (20 000 000 Ar) dans `src/lib/pricing.ts`.
- **Dates de livraison** : partir de `madagascarTime()` (`src/lib/shipping.ts`), jamais de `new Date()` seul : le serveur peut tourner dans un autre fuseau.
- **Schéma Prisma** : `db push` refuse de supprimer une colonne remplie. Ajouter des colonnes avec une valeur par défaut ; les colonnes devenues inutiles sont marquées « obsolètes » dans le schéma.
- **Recherche de photos** : l'interface non officielle d'Unsplash est bloquée dans cet environnement. Utiliser les photos de `public/products/` ou celles fournies par le propriétaire.

## Limites actuelles (voir phase 7)

Paiement simulé, aucun e-mail envoyé, SQLite et fichiers sur disque local, pas de limitation de débit, mentions légales à compléter.
