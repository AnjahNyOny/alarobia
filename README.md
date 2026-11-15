# Alarobia, boutique en ligne

Boutique en ligne pour Madagascar : objets du quotidien, prix en ariary, paiement par Mobile Money ou à la livraison, interface en français, anglais et malgache. Elle comprend la boutique publique, l'espace client et le back-office du vendeur.

Le projet est en cours de refonte : [PLAN.md](PLAN.md) décrit ce qui est prévu, [PROGRESS.md](PROGRESS.md) ce qui est fait.

**Technique** : Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Prisma et SQLite, Zod, next-intl.

## Démarrer

```bash
npm install          # installe les dépendances et génère le client Prisma
cp .env.example .env # puis renseigner AUTH_SECRET : openssl rand -base64 32
npm run db:reset     # crée la base et charge les données de démonstration
npm run dev          # http://localhost:3000/fr
```

Node 22 (voir `.nvmrc`).

### Comptes de démonstration

| Rôle           | E-mail                    | Mot de passe | Adresse     |
| -------------- | ------------------------- | ------------ | ----------- |
| Administrateur | `admin@alarobia.example`  | `admin1234`  | `/fr/admin` |
| Client         | `client@alarobia.example` | `client1234` | `/fr/login` |

Codes promo : `BIENVENUE10` (−10 %), `TONGASOA` (−10 000 Ar dès 100 000 Ar).

**Avant toute mise en ligne, changez ces mots de passe** (ou relancez un seed sans ces comptes).

## Ce que contient le projet

**Boutique** (`src/app/[locale]/(store)`, sous `/fr`, `/en` et `/mg`)

- Accueil, catalogue avec recherche, filtres (catégorie, prix, stock, promotion), tri et pagination
- Fiche produit : galerie, stock, avis clients avec mention « Achat vérifié », produits associés, données structurées (JSON-LD)
- Panier (tiroir latéral + page), codes promo, seuil de livraison offerte
- Commande avec ou sans compte, adresse malgache, zone de livraison au choix avec date promise
- Paiement par MVola, Orange Money ou Airtel Money (le client envoie le montant au numéro du vendeur puis saisit la référence de sa transaction), ou à la livraison
- Espace client : commandes et suivi, favoris, profil, adresse, mot de passe
- Pages d'aide, à propos, mentions légales, `sitemap.xml`, `robots.txt`

**Administration** (`src/app/[locale]/admin`, réservée au rôle `ADMIN`)

- Tableau de bord : chiffre d'affaires, commandes, panier moyen, nouveaux clients (comparés à la période précédente), courbe journalière, meilleures ventes, stock faible, commandes à traiter
- Commandes : recherche, filtres par statut, changement de statut, numéro de suivi, bouton « Paiement reçu » pour le Mobile Money, remise en stock automatique à l'annulation
- Produits : création et modification, envoi de photos par glisser-déposer, prix barré, stock, brouillon / en ligne / archivé
- Catégories, clients, codes promo, modération des avis
- Zones de livraison : tarif et délai par zone
- Réglages : nom de la boutique, bandeau d'annonce, devise, seuil de livraison offerte, numéros Mobile Money

## Organisation du code

```
prisma/schema.prisma     modèle de données
prisma/seed.mjs          données de démonstration
src/actions/             actions serveur (toute écriture passe par ici)
src/lib/                 accès base, session, panier, tarification, validation
src/components/ui/       composants shadcn/ui
src/components/store/    composants de la boutique
src/components/admin/    composants du back-office
src/i18n/                routage par langue
messages/                textes de l'interface : fr.json, en.json, mg.json
src/app/globals.css      jetons de design (couleurs, typographie, rayons)
uploads/                 photos envoyées depuis l'administration
```

Quelques règles suivies partout :

- Les prix sont stockés en unités mineures (entiers : 25 000 Ar = 2 500 000) et les totaux toujours recalculés côté serveur : le cookie du panier ne contient que des identifiants et des quantités.
- Chaque action serveur revérifie la session ; le proxy (`src/proxy.ts`) n'est qu'un premier filtre.
- Le stock est décrémenté dans une transaction avec condition (`stock >= quantité`), ce qui empêche la survente en cas de commandes simultanées.
- Toutes les entrées sont validées avec Zod (`src/lib/schemas.ts`).

## Ce qu'il reste à brancher avant une vraie mise en ligne

- **Paiement** : aucune liaison avec les opérateurs. Le vendeur vérifie lui-même sur son téléphone que l'argent est arrivé avant de cliquer sur « Paiement reçu ». Une API marchande Mobile Money demande un compte marchand.
- **E-mails** : aucune confirmation n'est envoyée (commande, expédition, mot de passe oublié). À ajouter avec un service transactionnel.
- **Base de données** : SQLite convient au développement et à un petit trafic sur un seul serveur. Pour la production, passez `provider` à `postgresql` dans `prisma/schema.prisma`.
- **Photos** : elles sont écrites sur le disque local (`uploads/`). Sur un hébergement sans disque persistant (Vercel, par exemple), utilisez un stockage objet.
- **Limitation de débit** sur la connexion et l'inscription, à ajouter au niveau du proxy ou de l'application.
- **Mentions légales et CGV** : la page fournie est un modèle à faire compléter.

## Commandes utiles

```bash
npm run build      # compilation de production
npm run start      # serveur de production
npm run lint       # ESLint
npm test           # tests unitaires (Vitest)
npm run test:e2e   # tests navigateur (Playwright), sur une compilation de production
npm run db:push    # applique le schéma Prisma
npm run db:seed    # recharge les données de démonstration (efface les données existantes)
npm run db:reset   # recrée la base puis la remplit
```

Photos de démonstration : Unsplash.
