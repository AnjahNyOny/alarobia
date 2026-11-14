# Sève — boutique en ligne

Plateforme e-commerce complète : boutique publique, espace client et back-office d'administration.

**Stack** : Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Prisma + SQLite · Zod · Recharts.

## Démarrer

```bash
npm install          # installe les dépendances et génère le client Prisma
cp .env.example .env # puis renseigner AUTH_SECRET : openssl rand -base64 32
npm run db:reset     # crée la base et charge les données de démonstration
npm run dev          # http://localhost:3000
```

Node 22 ou plus récent.

### Comptes de démonstration

| Rôle           | E-mail                | Mot de passe |
| -------------- | --------------------- | ------------ |
| Administrateur | `admin@seve.example`  | `admin1234`  |
| Client         | `client@seve.example` | `client1234` |

Codes promo : `BIENVENUE10` (−10 %), `MAISON20` (−20 € dès 150 €).

**Avant toute mise en ligne, changez ces mots de passe** (ou relancez un seed sans ces comptes).

## Ce que contient le projet

**Boutique** (`src/app/(store)`)

- Accueil, catalogue avec recherche, filtres (catégorie, prix, stock, promotion), tri et pagination
- Fiche produit : galerie, stock, avis clients avec mention « Achat vérifié », produits associés, données structurées (JSON-LD)
- Panier (tiroir latéral + page), codes promo, seuil de livraison offerte
- Commande avec ou sans compte, livraison standard ou express, carte ou paiement à la livraison
- Espace client : commandes et suivi, favoris, profil, adresse, mot de passe
- Pages d'aide, à propos, mentions légales, `sitemap.xml`, `robots.txt`

**Administration** (`src/app/admin`, réservée au rôle `ADMIN`)

- Tableau de bord : chiffre d'affaires, commandes, panier moyen, nouveaux clients (comparés à la période précédente), courbe journalière, meilleures ventes, stock faible, commandes à traiter
- Commandes : recherche, filtres par statut, changement de statut, numéro de suivi, remise en stock automatique à l'annulation
- Produits : création et modification, envoi de photos par glisser-déposer, prix barré, stock, brouillon / en ligne / archivé
- Catégories, clients, codes promo, modération des avis
- Réglages : nom de la boutique, bandeau d'annonce, devise, frais de livraison

## Organisation du code

```
prisma/schema.prisma     modèle de données
prisma/seed.mjs          données de démonstration
src/actions/             actions serveur (toute écriture passe par ici)
src/lib/                 accès base, session, panier, tarification, validation
src/components/ui/       composants shadcn/ui
src/components/store/    composants de la boutique
src/components/admin/    composants du back-office
src/app/globals.css      jetons de design (couleurs, typographie, rayons)
uploads/                 photos envoyées depuis l'administration
```

Quelques règles suivies partout :

- Les prix sont stockés en centimes (entiers) et les totaux toujours recalculés côté serveur : le cookie du panier ne contient que des identifiants et des quantités.
- Chaque action serveur revérifie la session ; le middleware n'est qu'un premier filtre.
- Le stock est décrémenté dans une transaction avec condition (`stock >= quantité`), ce qui empêche la survente en cas de commandes simultanées.
- Toutes les entrées sont validées avec Zod (`src/lib/schemas.ts`).

## Ce qu'il reste à brancher avant une vraie mise en ligne

- **Paiement** : le paiement par carte est simulé (aucune carte n'est demandée, la commande est marquée payée). Branchez un prestataire (Stripe, par exemple) dans `src/actions/checkout.ts`, à l'endroit signalé par un commentaire, et ne passez la commande à `PAID` qu'à la réception du webhook.
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
npm run db:push    # applique le schéma Prisma
npm run db:seed    # recharge les données de démonstration (efface les données existantes)
npm run db:reset   # recrée la base puis la remplit
```

Photos de démonstration : Unsplash.
