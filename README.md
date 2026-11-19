# Alarobia, boutique en ligne

Boutique en ligne pour Madagascar : objets du quotidien, prix en ariary, paiement par Mobile Money ou à la livraison, interface en français, anglais et malgache. Le client peut personnaliser certains objets (couleur, texte, image) et les voir en 3D avant de commander. Le projet comprend la boutique publique, l'espace client et le back-office du vendeur. « Alarobia » veut dire mercredi en malgache.

À lire ensuite : [PLAN.md](PLAN.md) (plan de la refonte, par phases), [PROGRESS.md](PROGRESS.md) (ce qui est fait, mesures, décisions prises et en attente), [CLAUDE.md](CLAUDE.md) (règles de code et de design, pièges connus), [docs/glossaire.md](docs/glossaire.md) (vocabulaire malgache retenu et termes à relire).

**Technique** : Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Prisma et PostgreSQL, Zod, next-intl, three.js et @react-three/fiber. Tests : Vitest, Playwright, axe. Ne pas revenir sous Next 16 : la version 15.5 donnait des erreurs d'hydratation intermittentes (voir `CLAUDE.md`).

## Démarrer

Il faut Node 22 (`.nvmrc`) et npm, PostgreSQL 17, plus Google Chrome pour les tests navigateur et les scripts de mesure (ils utilisent Chrome, pas le Chromium de Playwright). La compilation télécharge trois polices sur Google Fonts : elle demande un accès à internet.

PostgreSQL s'installe par Homebrew, avec deux bases : `alarobia` pour le développement, `alarobia_test` pour les tests. Elles sont créées en collation `C.UTF-8` (fournisseur `builtin`) : les chaînes se trient par point de code, de la même façon sur toutes les machines.

```bash
brew install postgresql@17
brew services start postgresql@17
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"   # Homebrew n'installe pas psql et createdb dans le PATH
createdb --template=template0 --encoding=UTF8 --locale-provider=builtin --builtin-locale=C.UTF-8 alarobia
createdb --template=template0 --encoding=UTF8 --locale-provider=builtin --builtin-locale=C.UTF-8 alarobia_test
```

Puis :

```bash
nvm use               # Node 22, d'après .nvmrc
npm install           # dépendances, puis génération du client Prisma
cp .env.example .env  # puis renseigner AUTH_SECRET
npm run db:push       # crée les tables dans la base alarobia
npm run db:seed       # charge les données de démonstration
npm run dev           # http://localhost:3000
```

Les adresses de `.env.example` se connectent sans mot de passe avec l'utilisateur `mac` : Homebrew crée un utilisateur PostgreSQL au nom du compte macOS, à mettre à la place.

`/` redirige vers `/fr`, `/en` ou `/mg` : la langue choisie la dernière fois, sinon celle du navigateur, sinon le français. Pour un autre port : `npm run dev -- -p 3001`.

| Variable (`.env`) | Rôle |
| --- | --- |
| `DATABASE_URL` | Base PostgreSQL de l'application : `postgresql://<utilisateur>@localhost:5432/alarobia` en local. |
| `DATABASE_URL_UNPOOLED` | Adresse directe de la même base, pour les commandes Prisma (`db push`, migrations). En local, la même que `DATABASE_URL`. |
| `AUTH_SECRET` | Signe le cookie de session. 32 caractères au moins, sinon la connexion et l'inscription échouent : `openssl rand -base64 32`. |
| `NEXT_PUBLIC_SITE_URL` | Adresse publique du site : adresses canoniques, plan du site, `robots.txt`, images de partage. À changer en production. Vide, le site prend `URL`, l'adresse que Netlify fournit lui-même, puis `http://localhost:3000`. |
| `UPLOAD_DIR` | Facultative. Dossier des fichiers envoyés, `uploads` par défaut. Sur Netlify, les envois vont dans Netlify Blobs et cette variable ne sert pas. |
| `CRON_SECRET` | Facultative en local. Protège la route du nettoyage quotidien (`/api/cron/nettoyage`), qui répond 503 sans elle : `openssl rand -base64 32`. |

### Comptes de démonstration

| Rôle           | E-mail                    | Mot de passe | Adresse     |
| -------------- | ------------------------- | ------------ | ----------- |
| Administrateur | `admin@alarobia.example`  | `admin1234`  | `/fr/admin` |
| Client         | `client@alarobia.example` | `client1234` | `/fr/login` |

Codes promo : `BIENVENUE10` (−10 %), `TONGASOA` (−10 000 Ar dès 100 000 Ar d'achat).

Les données de démonstration sont dans `prisma/catalog.mjs` et `prisma/seed.mjs` les écrit en base : six rayons, des produits en fr, en et mg, des clients malgaches, des commandes, des avis, quatre zones de livraison et des numéros Mobile Money fictifs. Elles sont identiques à chaque chargement. `npm run db:seed` vide d'abord toutes les tables.

## Ce que contient le projet

**Boutique** (`src/app/[locale]/(store)`, sous `/fr`, `/en` et `/mg`)

- Accueil : démonstration « Écrivez votre prénom » sur une tasse (photo fixe, puis objet en direct au premier contact avec le champ ; le prénom suit jusqu'à la fiche) ; frise de la semaine en malgache, qui montre le jour où arriverait une commande passée maintenant ; rayons et nouveautés.
- Catalogue : recherche dans la langue du visiteur et en français, filtres (rayon, prix, stock, promotion), tri, pagination.
- Fiche produit : galerie, prix, jour de livraison et tarif pour chaque zone, avis avec mention « Achat vérifié », produits du même rayon.
- Panier (tiroir latéral et page), codes promo, seuil de livraison offerte.
- Commande avec ou sans compte : adresse malgache (lot, quartier, repère, ville, province, téléphone +261), zone de livraison au choix avec date promise (pas de livraison le dimanche).
- Paiement par MVola, Orange Money ou Airtel Money : après la commande, le client envoie le montant au numéro du vendeur affiché sur la confirmation, puis saisit la référence de sa transaction. Ou paiement à la livraison.
- Espace client : commandes et suivi, favoris, profil, adresse, mot de passe.
- Trois langues : sélecteur dans l'en-tête, le menu du téléphone et le pied de page, qui reste sur la même page. Les adresses ne diffèrent que par leur préfixe (`/fr/products`, `/mg/products`). Un texte de produit non traduit s'affiche en français.
- Aide, « Qui sommes-nous », mentions légales, page 404, `sitemap.xml`, `robots.txt`.

**Personnalisation** (`src/components/customizer`, `src/lib/customizer`)

- Quatre gabarits construits par le code, sans fichier 3D : tasse, gourde, carnet, sac en toile. Dans les données de démonstration, la tasse et la gourde sont personnalisables ; le carnet et le sac s'attribuent à un produit depuis le back-office.
- Réglages : couleur de l'objet parmi celles du produit, texte avec compteur, quatre écritures (Enseigne, Ronde, Classique, Manuscrite), couleur du texte, image du client, taille et position. Le supplément ne s'applique que s'il y a un texte ou une image à imprimer.
- Objet en 3D, tournable au doigt, à la souris et par deux boutons. Vue à plat avec les mêmes réglages sans WebGL, si l'appareil peine ou au choix du client.
- Envoi d'image : JPEG, PNG ou WebP, 4 Mo et 4 096 px au plus, format lu dans le contenu du fichier ; SVG et HEIC refusés avec un message qui dit quoi faire. Le navigateur réduit l'image à 2 048 px avant l'envoi, ce qui retire aussi ses métadonnées.
- Un seul tracé (`src/lib/customizer/paint.ts`) produit la texture 3D, l'aperçu et le fichier d'impression : le vendeur reçoit ce que le client a vu.
- L'aperçu remplace la photo dans le panier, la confirmation de commande et l'espace client. Dès qu'il y a un texte ou une image à imprimer, la fiche précise que l'article ne sera ni repris ni échangé.

**Administration** (`src/app/[locale]/admin`, réservée au rôle `ADMIN`, en fr, en et mg)

- Tableau de bord : chiffre d'affaires, commandes, panier moyen, nouveaux clients (comparés à la période précédente), courbe journalière, meilleures ventes, stock faible, commandes à traiter.
- Commandes : recherche, filtres par statut, changement de statut, numéro de suivi, remise en stock à l'annulation. Une commande Mobile Money reste « en attente » ; la liste signale « Référence à vérifier » quand le client a déclaré son paiement, et le vendeur clique sur « Paiement reçu » après avoir vérifié sur son téléphone. Rien n'annule automatiquement une commande impayée.
- Commande personnalisée : « N articles à imprimer » dans la liste ; dans le détail, aperçu en grand, objet, couleur, texte exact, écriture, zone imprimable en millimètres, téléchargement du fichier d'impression et de l'image du client.
- Produits : création et modification, photos par glisser-déposer (JPG, PNG, WebP ou AVIF, 4 Mo, réduites à 2 048 px dans le navigateur), prix barré, stock, brouillon / en ligne / archivé. Traductions anglaise et malgache dans des onglets, avec le nombre de champs « à traduire » sur l'onglet et dans la liste. Carte « Personnalisation » : gabarit, couleurs proposées, longueur du texte, image autorisée, supplément.
- Catégories (mêmes onglets de traduction), clients, codes promo, modération des avis.
- Zones de livraison : nom dans les trois langues, tarif et délai par zone.
- Réglages : nom de la boutique, bandeau d'annonce par langue (vide : le français s'affiche), devise, seuil de livraison offerte, numéros Mobile Money et nom du titulaire.
- Sélecteur de langue dans la barre latérale et le menu du téléphone. Les textes du back-office ne sont jamais envoyés aux pages publiques.

## Qualité

- **Accessibilité** : contrôle axe (WCAG 2.1 A et AA) sur toutes les pages de la boutique, de l'espace client et du back-office, états ouverts compris (tiroir, menus, personnalisation, formulaire refusé) ; taille des cibles tactiles sur téléphone ; parcours au clavier seul (`e2e/clavier.spec.ts`). La 3D ne bouge pas seule si le visiteur a demandé moins d'animations.
- **Performance** : budgets de poids par page sur téléphone (total, JavaScript, police) et aucune feuille de style à télécharger avant l'affichage, contrôlés par `e2e/performance.spec.ts`. Les temps en 3G lente se mesurent à la main avec `scripts/mesure-telephone.mjs` ; les relevés sont dans `PROGRESS.md`. La feuille CSS est écrite dans le HTML (`experimental.inlineCss`), la police Archivo est réduite aux graisses et largeurs utilisées, et ses polices de remplacement sont calibrées pour éviter tout décalage de mise en page. three.js (environ 240 ko compressés) n'est jamais chargé d'office : seulement à l'ouverture de la personnalisation, ou au premier contact avec la démonstration de l'accueil.
- **Sécurité** : session dans un cookie signé `httpOnly`, relue en base à chaque requête ; les actions serveur réservées et chaque page du back-office revérifient la session. En-têtes `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` et `Permissions-Policy` sur toutes les adresses (`next.config.ts`, contrôlés par `e2e/securite.spec.ts`). Limites de débit, en mémoire (voir « Ce qu'il reste à brancher ») :

  | Action | Limite |
  | --- | --- |
  | Connexion | 8 échecs par e-mail et 30 par adresse IP, en 15 min ; au-delà, le mot de passe n'est plus comparé |
  | Inscription | 10 comptes créés par heure et par adresse IP |
  | Changement de mot de passe | 5 échecs en 15 min par compte |
  | Code promo | 20 codes inconnus en 10 min par adresse IP |
  | Commande | 40 en 10 min par adresse IP |
  | Déclaration de paiement | 10 en 10 min par commande |
  | Lettre d'information | 10 inscriptions par heure et par adresse IP |
  | Image de personnalisation | 60 envois en 10 min par adresse IP |
  | Article personnalisé ajouté au panier | 30 en 10 min par adresse IP |

- **Référencement** : adresse canonique et `hreflang` (fr, en, mg, `x-default` vers le français) sur les pages indexables, par `src/lib/seo.ts` ; plan du site avec chaque page dans les trois langues ; image de partage générée dans la langue de la page (`src/app/[locale]/opengraph-image.tsx`) ; données structurées de la boutique sur l'accueil, du produit et du fil d'Ariane sur la fiche. Panier, commande, compte, connexion, inscription, recherche et back-office ne sont pas indexés.

## Organisation du code

```
prisma/schema.prisma          modèle de données (statuts en chaînes, pas en enums)
prisma/migrations/            migrations versionnées, pour la production (en local et dans les tests : prisma db push)
prisma/catalog.mjs            données de démonstration en fr, en, mg (données seules, testées)
prisma/write-catalog.mjs      écrit en base les zones de livraison, rayons et produits de catalog.mjs (partagé)
prisma/seed.mjs               écrit les données de démonstration en base (vide d'abord toutes les tables)
prisma/init-production.mjs    données de départ de la production, une seule fois (voir « Mise en ligne »)
netlify.toml                  compilation sur Netlify : migrations, puis next build
src/proxy.ts                  langue de l'adresse et premier filtre d'accès (/admin, /account)
src/actions/                  actions serveur : toute écriture en base passe par ici (admin/ pour le back-office)
src/app/[locale]/(store)/     boutique et espace client
src/app/[locale]/admin/       back-office
src/app/api/                  envoi d'images (client, back-office), fichiers d'une commande pour le vendeur
src/app/uploads/[name]/       sert les fichiers envoyés
src/app/fonts/                police Archivo réduite, chargée par next/font/local
src/app/globals.css           jetons de design, polices de remplacement calibrées
src/lib/                      base, session, panier, prix, promotions, livraison, adresses, paiement, validation,
                              formats par langue, traductions du catalogue, référencement, limites de débit, envois
src/lib/customizer/           mise en place du dessin, tracé, objets à plat, démonstration (fonctions pures, testées)
src/components/customizer/    scène 3D et gabarits, objet en direct ou à plat, réglages, démonstration de l'accueil
src/components/store/         boutique
src/components/admin/         back-office
src/components/ui/            composants shadcn/ui
src/i18n/                     routage par langue, navigation, fusion des messages, textes envoyés au navigateur
messages/                     textes de l'interface : fr.json (socle), en.json, mg.json
docs/glossaire.md             vocabulaire malgache retenu et termes à relire
e2e/                          tests navigateur (Playwright)
scripts/                      maintenance, mesures, fichiers générés (voir « Scripts »)
assets/fonts/                 Archivo statique pour l'image de partage, et sa licence
public/products/              photos de démonstration
uploads/                      fichiers envoyés : photos de produits, images des clients, aperçus, fichiers d'impression
```

Règles suivies partout (le détail est dans `CLAUDE.md`) :

- Les prix sont stockés en unités mineures (entiers : 25 000 Ar = 2 500 000) et les totaux toujours recalculés côté serveur, supplément de personnalisation compris. Le cookie du panier ne contient que des identifiants (produit, personnalisation) et des quantités.
- Chaque action serveur réservée à un compte ou à l'administrateur revérifie la session (`requireUser`, `requireAdmin`) ; le proxy (`src/proxy.ts`) n'est qu'un premier filtre. Une commande liée à un compte n'est lisible que par ce compte et l'administrateur ; celle d'un client sans compte, par son lien non devinable.
- Le stock est décrémenté dans une transaction avec condition (`stock >= quantité`), et un code promo à usage limité y est consommé de la même façon : des commandes simultanées ne peuvent ni survendre ni dépasser la limite.
- Toutes les entrées sont validées avec Zod (`src/lib/schemas.ts`), avec des messages traduits rattachés au champ.
- Aucun texte visible n'est écrit dans un composant : tout est dans `messages/`. Une clé absente ou vide en anglais ou en malgache retombe sur le français.

## Tests

`npm test` lance les tests unitaires (Vitest, `src/**/*.test.ts`). Ils couvrent la logique : prix, supplément et plafond, codes promo et stock (consommation et réservation sous condition, vérifiées sur une vraie base PostgreSQL, commandes simultanées comprises), migrations à jour du schéma, lignes du panier, personnalisation (validation, mise en place du dessin, aperçu identique au fichier d'impression), contrôle des envois et nettoyage, livraison et dates promises, adresses et téléphone, paiement, formats et noms de jours dans les trois langues, mêmes clés dans les trois fichiers de messages, repli des traductions, référencement, limites de débit, contrôle de session en tête de chaque page du back-office, polices de remplacement, secret de session absent ou trop court, données de départ de la production (`init-production.mjs` lancé contre une base temporaire). Ceux qui ont besoin d'une base créent chacun un schéma temporaire dans `alarobia_test` (ou dans la base de `TEST_DATABASE_URL`), supprimé à la fin : PostgreSQL doit tourner.

`npm run test:e2e` lance les tests navigateur (Playwright, `e2e/`) sur une compilation de production. Il prépare son propre environnement sans toucher à celui de développement : base `alarobia_test` (schéma `public`) remplie par le seed, compilation dans `.next-e2e/`, fichiers envoyés dans `uploads-test/` (qui s'accumulent d'un passage à l'autre), serveur sur le port 3100, qui doit être libre. Deux projets : `ordinateur` (1 440 × 900) et `mobile` (Pixel 7 émulé, fichiers dont le nom contient « mobile »). Les tests partagent la base et passent l'un après l'autre : la suite prend plusieurs minutes. Ils couvrent :

- l'achat avec et sans compte, le paiement Mobile Money déclaré mais jamais reçu, le paiement à la livraison, le changement de langue en cours de commande ;
- la personnalisation : images refusées et acceptées, 3D et vue à plat, téléphone sans WebGL, réseau lent, prénom venu de l'accueil ;
- le back-office : produits et traductions, commandes à imprimer et téléchargements, réglages, trois langues, 320 px en malgache ;
- les gros montants à 320 px, l'accessibilité, le clavier, le poids des pages, le référencement, les limites de débit ;
- des parcours complets dans les trois langues, sur ordinateur et sur téléphone (`e2e/parcours.spec.ts`, `e2e/parcours-mobile.spec.ts`, étapes dans `e2e/parcours.ts`) : un client sans compte paie par Mobile Money puis le vendeur traite sa commande ; un client avec compte paie à la livraison. À chaque écran : langue de la page et des liens, aucune clé de traduction affichée, pas de défilement horizontal, aucune erreur. `PARCOURS_CAPTURES=<dossier>` enregistre une capture de chaque écran.

Avant de livrer un changement : `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run test:e2e`.

## Scripts

```bash
# Mesures, contre un serveur de production (par exemple : npm run build && npm run start -- -p 3100)
node scripts/poids-pages.mjs http://localhost:3100 /fr /fr/products             # octets transférés par page, en quelques secondes
node scripts/mesure-telephone.mjs http://localhost:3100 --pages=accueil --langues=fr   # temps en 3G lente, plusieurs minutes
node scripts/stress-hydratation.mjs http://localhost:3100 /fr/help 600          # erreurs d'hydratation en rafale (attendu : 0)

# Fichiers générés, à refaire si leur source change
node scripts/apple-icon.mjs                        # src/app/apple-icon.png, depuis src/app/icon.svg
python3 scripts/police-archivo.py <archivo.woff2>  # src/app/fonts/archivo-latin.woff2 (installation en tête du script)
```

`mesure-telephone.mjs` accepte d'autres pages (`catalogue`, `fiche`, `fiche-perso`, `3d`, `panier`, `commande`) et options (profil réseau, ralentissement du processeur, visite avec cache rempli) : voir l'en-tête du script. Ses temps ne valent rien sur une machine chargée.

## Nettoyage quotidien

Le point d'envoi des images de personnalisation est public : sans nettoyage, le stockage se remplit. `src/lib/cleanup.ts` supprime les personnalisations jamais commandées depuis plus de sept jours, puis les fichiers « perso-… » que plus rien ne référence. Il ne touche ni aux photos de produits ni à ce qu'une commande utilise.

Il tourne par la route `GET /api/cron/nettoyage`, protégée par `Authorization: Bearer <CRON_SECRET>` (401 avec un mauvais secret, 503 si `CRON_SECRET` n'est pas défini sur le serveur). `?dry-run=1` compte ce qui partirait sans rien supprimer. En local :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3001/api/cron/nettoyage?dry-run=1"
```

En production, le flux de travail GitHub Actions `.github/workflows/nettoyage.yml` l'appelle chaque jour à 4 h, heure d'Antananarivo. Il lit deux secrets du dépôt, `SITE_URL` et `CRON_SECRET` (la même valeur que sur Netlify), et se lance aussi à la main depuis l'onglet Actions, avec ou sans essai à blanc. Le dépôt étant public, ses journaux le sont aussi : le flux n'y écrit que des nombres, jamais les noms des fichiers. GitHub met en pause les tâches planifiées d'un dépôt public sans activité depuis 60 jours : il faut alors les réactiver depuis l'onglet Actions.

## Mise en ligne

La boutique tourne sur l'offre gratuite de Netlify, avec une base PostgreSQL sur l'offre gratuite de Neon et les fichiers envoyés dans Netlify Blobs (rien à créer : le magasin vient avec le site). Aucune option payante : au-delà des quotas gratuits, Netlify met le site en pause jusqu'au mois suivant, sans facturer. Les étapes, dans l'ordre et avec qui fait quoi, sont dans `PLAN.md` (tâche 7.5).

**Variables**, à définir dans Netlify pour le contexte « Production » seulement (le détail de chacune est dans `.env.example`) :

| Variable | Provenance |
| --- | --- |
| `DATABASE_URL` | Neon : adresse regroupée (*pooler*), pour l'application |
| `DATABASE_URL_UNPOOLED` | Neon : adresse directe, pour les migrations |
| `AUTH_SECRET` | À générer : `openssl rand -base64 32` |
| `CRON_SECRET` | À générer : `openssl rand -base64 32` ; la même valeur dans les secrets du dépôt GitHub |
| `NEXT_PUBLIC_SITE_URL` | L'adresse `.netlify.app` du site, puis le domaine. Sans elle, le site prend `URL`, fournie par Netlify |

Les secrets du dépôt GitHub `SITE_URL` et `CRON_SECRET` servent au nettoyage quotidien (section précédente). Une variable changée sur Netlify ne compte qu'à la mise en ligne suivante.

**Compilation** (`netlify.toml`) : `npx prisma migrate deploy && npm run build`. Les migrations de `prisma/migrations/` sont appliquées à la base Neon par l'adresse directe à chaque compilation, avant celle de Next ; une migration qui échoue arrête la mise en ligne. Node 22 vient de `.nvmrc`, le reste est laissé à l'adaptateur Next.js de Netlify. Le client Prisma embarque le moteur des fonctions Netlify (`binaryTargets` dans `prisma/schema.prisma` : compilation sous Ubuntu, fonctions sous Amazon Linux).

**Données de départ**, une seule fois, après la première mise en ligne, depuis sa machine :

```bash
node --env-file=.env.production.local prisma/init-production.mjs
```

`.env.production.local` (ignoré par git) contient `DATABASE_URL` et `DATABASE_URL_UNPOOLED` (toutes deux l'adresse directe de Neon), `ADMIN_EMAIL` et `ADMIN_PASSWORD` (12 caractères au moins). Le script refuse de tourner, avec un message, si l'une manque ou si la base contient déjà un utilisateur, un produit ou une commande ; il écrit tout dans une seule transaction. Il crée :

- les réglages de la boutique, sans numéro Mobile Money : seul le paiement à la livraison est proposé tant que le vendeur n'a pas saisi les siens dans le back-office (Réglages) ; adresse de contact `ADMIN_EMAIL` ;
- les quatre zones de livraison, les six rayons et les 27 produits de `prisma/catalog.mjs` avec leurs traductions, photos et réglages de personnalisation. Tous sont en brouillon, sauf la tasse personnalisable, en ligne pour le contrôle de la mise en ligne : le vendeur corrige les autres (prix, stock, photos) et les met en ligne depuis le back-office ;
- le compte administrateur.

Il ne crée ni client, ni avis, ni commande, ni code promo, ni abonné. Ne jamais lancer `npm run db:seed` sur la base de production : il la vide puis la remplit de données de démonstration.

**À vérifier en ligne** (`PLAN.md`, 7.5) : le moteur de Prisma dans les fonctions (sa présence dans les traces de fichiers de Next a été vérifiée en local), la collation de la base Neon, et l'adresse du visiteur : sur Netlify, les limites par adresse lisent `x-nf-client-connection-ip`, posé par Netlify, mais rien dans sa documentation ne dit qu'un client ne peut pas l'imposer.

## Ce qu'il reste à brancher avant une vraie mise en ligne

- **Paiement** : aucune liaison avec les opérateurs. Le vendeur vérifie lui-même sur son téléphone que l'argent est arrivé ; la référence saisie par le client n'est contrôlée que sur sa forme. Une API marchande Mobile Money demande un compte marchand. Les numéros Mobile Money des données de démonstration sont fictifs ; en production, `init-production.mjs` les laisse vides : saisir les vrais dans les réglages pour proposer le Mobile Money.
- **E-mails et SMS** : rien n'est envoyé (confirmation, expédition). Il n'y a pas de procédure « mot de passe oublié ». La lettre d'information enregistre des adresses, mais rien ne s'en sert.
- **Fichiers envoyés** : sur le disque en local et dans les tests (`uploads/`, `uploads-test/`), dans Netlify Blobs sur Netlify (`src/lib/storage.ts`, seul module qui y touche). Un envoi pèse 4 Mo au plus, parce qu'une fonction Netlify refuse toute requête de plus de 6 Mo et que le fichier y arrive encodé en Base64 ; le navigateur réduit les photos à 2048 px avant l'envoi. Les aperçus et fichiers d'impression sont servis à tous sous leur nom imprévisible (`/uploads/…`). Le serveur ne réencode pas les images : un envoi qui contourne le navigateur garde ses métadonnées.
- **Limites de débit** : en mémoire, donc comptées par instance de fonction sur Netlify (plus lâches) et remises à zéro au redémarrage ; un stockage partagé si des abus apparaissent. Sur Netlify, l'adresse du visiteur est lue dans `x-nf-client-connection-ip`, posé par Netlify ; qu'un client ne puisse pas l'imposer reste à vérifier en ligne (voir « Mise en ligne »). Ailleurs, elle est lue dans `x-forwarded-for`, qu'un client peut forger sans proxy de confiance. Si l'adresse est forgeable, les limites par adresse IP se contournent ; celles par e-mail, par compte et par commande tiennent.
- **Montants** : 20 000 000 Ar au plus par prix, tarif ou commande (`MAX_ORDER_CENTS`), parce que les colonnes de montant sont des entiers 32 bits. Au-delà, passer ces colonnes en BigInt.
- **CSP** : aucune politique de sécurité du contenu pour l'instant. Elle devra autoriser le `<style>` en ligne écrit par `experimental.inlineCss` (`next.config.ts`), option expérimentale à revérifier à chaque mise à jour de Next.
- **Malgache** : rédigé par Claude, à faire relire par un locuteur natif (termes incertains dans `docs/glossaire.md` et `PROGRESS.md`). Les caractéristiques des produits de démonstration ne sont pas traduites en malgache.
- **Textes à valider** : mentions légales et CGV (modèle à compléter : éditeur, hébergeur) ; modalités de remboursement des retours (Mobile Money sous 5 jours ouvrés, reprise « convenue avec vous » : hypothèses à confirmer) ; page « Qui sommes-nous », proposée par Claude.
- **Produits de départ** : en production, 26 des 27 produits de démonstration arrivent en brouillon, avec des prix et des stocks inventés (certains ne sont pas des objets du quotidien malgache) : à corriger ou supprimer avant de les mettre en ligne. Aucun compte ni code promo de démonstration n'y est créé.

## Commandes utiles

```bash
npm run dev          # serveur de développement (port 3000 ; npm run dev -- -p 3001 pour un autre)
npm run build        # compilation de production
npm run start        # serveur de production, après build
npm run lint         # ESLint
npx tsc --noEmit     # vérification des types
npm test             # tests unitaires (Vitest)
npm run test:watch   # tests unitaires, relancés à chaque modification
npm run test:e2e     # tests navigateur (Playwright), sur une compilation de production, port 3100
npm run db:push      # applique le schéma Prisma à la base
npm run db:seed      # vide la base puis charge les données de démonstration
npm run db:reset     # recrée la base de zéro puis la remplit
```

`npm install` lance aussi `prisma generate` (script `postinstall`).

## Crédits

- Photos de démonstration (`public/products/`) : Unsplash, reprises de la première version du site. La photo de la démonstration de l'accueil (`public/home/tasse-anjah.jpg`) est une capture de la scène 3D du projet.
- Police Archivo : The Archivo Project Authors, SIL Open Font License 1.1 (`assets/fonts/OFL.txt`). Le site en utilise une version réduite (`src/app/fonts/archivo-latin.woff2`), l'image de partage deux instances fixes (`assets/fonts/`).
- Baloo 2, Lora et Caveat (écritures de la personnalisation) : Google Fonts, téléchargées à la compilation par `next/font/google`.
