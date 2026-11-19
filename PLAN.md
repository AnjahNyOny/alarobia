# Plan de refonte : de « Sève » à Alarobia

> Suivi de l'avancement : [PROGRESS.md](PROGRESS.md). Règles permanentes du projet : [CLAUDE.md](CLAUDE.md).
> Chaque tâche se termine par une vérification réelle (tests, compilation, navigateur) avant d'être cochée.

**But.** Transformer la boutique généraliste existante en Alarobia : une boutique malgache d'objets du quotidien, à l'identité reconnaissable, en français, anglais et malgache, où le client personnalise son produit et le voit en 3D avant de commander.

**Approche.** On garde le socle qui fonctionne (catalogue, panier, commande, comptes, back-office : 19 étapes de test passent en production). On le fait évoluer par phases, chacune livrable et testable seule. L'ordre évite de toucher deux fois aux mêmes fichiers : d'abord l'outillage et la traduction, puis le design (les pages sont réécrites une seule fois, directement traduites), puis le commerce malgache, puis la 3D.

**Technologies.** Existant : Next.js 16, TypeScript, Tailwind v4, shadcn/ui, Prisma + SQLite, Zod. Ajouts : `next-intl` (traduction), `three` + `@react-three/fiber` + `@react-three/drei` (3D), Vitest (tests unitaires), `@playwright/test` et `@axe-core/playwright` (tests navigateur et accessibilité).

## Contraintes valables pour toutes les tâches

- Trois langues : `fr` (par défaut), `en`, `mg`. Aucun texte visible en dur dans un composant.
- Une clé de traduction absente en `en` ou `mg` retombe sur le français, jamais sur le nom de la clé.
- Devise par défaut : ariary, affiché « 25 000 Ar », sans décimales. Montants stockés en entiers.
- Le public cible navigue souvent sur un téléphone Android modeste et une connexion lente : la page d'accueil et le catalogue ne chargent jamais la 3D d'office, et tout reste utilisable sans WebGL.
- Largeur minimale supportée : 320 px. Les mots malgaches sont longs (« Alatsinainy », « fandoavam-bola ») : aucun libellé ne doit déborder ni être tronqué sans alternative.
- Accessibilité : navigation clavier complète, focus visible, `prefers-reduced-motion` respecté, contrastes AA.
- Règles de design et pièges connus : voir `CLAUDE.md`.
- Node 22, `npm`. Pas de dépendance ajoutée sans raison écrite dans `PROGRESS.md`.

## Points de vigilance à tester

Cas que les tâches ne couvrent pas d'elles-mêmes et qui ont le plus de chances de gêner un vrai utilisateur. Chacun doit avoir son test dans la tâche indiquée.

1. **Téléphone sans WebGL ou trop lent** : le client voit un aperçu 2D du produit personnalisé et peut commander (tâche 4.6).
2. **Image envoyée inadaptée** : photo de 12 Mo, HEIC d'iPhone, fichier renommé en `.jpg`, SVG : refus avec un message qui dit quoi faire (tâche 4.3).
3. **Texte de personnalisation inattendu** : émojis, apostrophes, 200 caractères, uniquement des espaces (tâche 4.2).
4. **Changement de langue en cours de commande** : le panier, le code promo et la saisie du formulaire sont conservés (tâche 1.5).
5. **Traduction manquante d'un produit** : la fiche s'affiche en français avec les libellés d'interface dans la langue choisie, sans champ vide (tâche 1.4).
6. **Gros montants en ariary** : « 1 250 000 Ar » tient dans les cartes produit, le panier et les tableaux du back-office à 320 px (tâche 3.1).
7. **Paiement Mobile Money déclaré mais jamais reçu** : la commande reste « en attente », le stock est rendu à l'annulation (tâche 3.3).

---

## Phase 0 — Outillage et point de départ

Poser les garde-fous avant de modifier quoi que ce soit.

### 0.1 Tests unitaires
- **Fichiers** : `vitest.config.ts`, `src/lib/__tests__/pricing.test.ts`, `format.test.ts`, `form.test.ts` ; script `npm test`.
- **Contenu** : couvrir la logique déjà écrite et jamais testée unitairement : `shippingCost` (seuil de gratuité, seuil à 0), `parseAmountToCents`, `slugify`, `safeNext` (refus des redirections externes), `discountPercent`.
- **Vérification** : `npm test` passe ; chaque test a été vu en échec une fois (en cassant volontairement la fonction).

### 0.2 Tests navigateur dans le dépôt
- **Fichiers** : `playwright.config.ts`, `e2e/achat.spec.ts`, `e2e/compte.spec.ts`, `e2e/admin.spec.ts`, `e2e/mobile.spec.ts` ; script `npm run test:e2e`.
- **Contenu** : porter le parcours de 19 étapes écrit hors dépôt pendant la première version. Le serveur de test démarre sur le port 3100 avec une base dédiée (`prisma/test.db`), réinitialisée avant chaque exécution.
- **Vérification** : `npm run test:e2e` passe deux fois de suite.

### 0.3 Node 22 et commit de référence
- Passer sur Node 22 (`.nvmrc` déjà présent), retirer l'`overrides` `magic-string`, vérifier build et tests.
- Committer l'état actuel comme point de retour (si le propriétaire l'autorise : décision D1).

**Livrable** : un dépôt où `npm test`, `npm run test:e2e`, `npm run lint` et `npm run build` passent.

---

## Phase 1 — Trois langues

L'infrastructure d'abord, pour que les pages redessinées en phase 2 soient écrites directement traduites.

### 1.1 Routage par langue
- **Fichiers** : `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`, `src/middleware.ts`, déplacement de `src/app/(store)` et `src/app/admin` sous `src/app/[locale]/`.
- **Décisions** : préfixe toujours présent (`/fr`, `/en`, `/mg`) ; `/` redirige selon le cookie de langue puis l'en-tête du navigateur, sinon `fr`. Segments d'URL communs aux trois langues, en anglais (`/products`, `/cart`, `/checkout`, `/account`) : aucun mot malgache dans une URL tant qu'il n'a pas été relu. Les anciennes URL françaises redirigent.
- **Interfaces produites** : `Link`, `redirect`, `useRouter`, `usePathname` de `@/i18n/navigation` remplacent ceux de Next dans tout le projet.
- **Piège** : le middleware doit enchaîner la détection de langue puis le contrôle d'accès (`/admin`, `/account`) sur le chemin privé de son préfixe.
- **Tests** : unitaires sur la fonction qui retire le préfixe et décide de la protection ; navigateur : `/` redirige, `/mg/admin` sans session renvoie vers `/mg/login`.

### 1.2 Fichiers de messages
- **Fichiers** : `messages/fr.json`, `en.json`, `mg.json`, `src/i18n/__tests__/messages.test.ts`, `docs/glossaire.md`.
- **Structure** : un espace de noms par zone (`common`, `nav`, `home`, `catalog`, `product`, `cart`, `checkout`, `account`, `auth`, `help`, `errors`, `customizer`, `admin.*`).
- **Test** : les trois fichiers ont exactement les mêmes clés et les mêmes variables (`{count}`, `{price}`) ; le test échoue en nommant la clé fautive.
- **Glossaire** : les termes récurrents et leur traduction retenue (panier → *harona*, livraison → *fanaterana*, paiement → *fandoavam-bola*, compte → *kaonty*…), pour que le vocabulaire reste le même d'un écran à l'autre.
- **Malgache** : rédigé par Claude, donc **à relire par un locuteur natif** avant mise en ligne (décision D2). Les clés non relues sont listées dans `docs/glossaire.md`.

### 1.3 Formats selon la langue
- **Fichiers** : `src/lib/format.ts` et ses tests.
- **Interfaces** : `formatPrice(cents, currency, locale)`, `formatDate(date, locale, style)`, `weekdayName(date, locale)`.
- **Détail** : si le moteur ne connaît pas les noms de jours ou de mois malgaches, une table écrite à la main prend le relais (Alatsinainy, Talata, Alarobia, Alakamisy, Zoma, Sabotsy, Alahady). Le test vérifie le résultat réel dans les trois langues.

### 1.4 Contenu du catalogue traduit
- **Fichiers** : `prisma/schema.prisma` (`ProductTranslation`, `CategoryTranslation`, annonce de la boutique par langue), `src/lib/localize.ts` et ses tests, `src/lib/catalog.ts`.
- **Modèle** : les champs actuels du produit restent la version française de référence ; une ligne de traduction par langue supplémentaire (nom, accroche, description, caractéristiques).
- **Interface** : `localizeProduct(product, locale)` renvoie le produit avec chaque champ traduit s'il existe et non vide, sinon le français.
- **Recherche** : cherche dans la langue active et dans le français.

### 1.5 Sélecteur de langue et messages d'erreur
- **Fichiers** : `src/components/store/language-switcher.tsx`, `src/lib/schemas.ts`, toutes les actions de `src/actions/`.
- **Sélecteur** : dans l'en-tête et le pied de page, reste sur la même page, mémorise le choix. Noms affichés dans leur propre langue : Français, English, Malagasy.
- **Erreurs** : les schémas Zod deviennent des fabriques recevant la fonction de traduction ; les actions renvoient des messages traduits.
- **Test navigateur** : point de vigilance 4.

**Livrable** : le site actuel, inchangé visuellement, entièrement navigable dans les trois langues.

---

## Phase 2 — Identité Alarobia

Méthode du skill `frontend-design` : plan, relecture contre les clichés, construction, critique sur captures. Les pages sont réécrites ici, avec leurs textes dans `messages/`.

### 2.1 Jetons de design et typographie
- **Fichiers** : `src/app/globals.css`, `src/app/[locale]/layout.tsx`.
- **Palette** (à ajuster sur captures) : blanc `#FFFFFF` (fond), pierre `#F3F2EE` (fond des photos), indigo `#1F2547` (texte, boutons), latérite `#B4401F` (marque, promotions), raphia `#EBC45A` (surbrillance : nouveauté, jour sélectionné), ligne `#E3E1DA`.
- **Typographie** : une seule famille, Archivo, dont on exploite l'axe de largeur. Titres : étroite et grasse, comme une enseigne peinte de marché. Texte : largeur normale. Échelle typographique définie une fois, chiffres tabulaires pour les prix.
- **Vérification** : contrastes AA mesurés pour chaque paire texte/fond utilisée.

### 2.2 Logo
- **Fichiers** : `src/components/logo.tsx`, `src/app/icon.svg`, `src/app/apple-icon.png`, `public/og.png`.
- **Idée** : une étiquette de prix à œillet portant « Ar ». C'est l'abréviation de l'ariary et le début d'Alarobia. À côté, le nom en minuscules, Archivo étroite grasse.
- **Livrable** : SVG en trois versions (complet, pictogramme seul, monochrome), lisible à 16 px.

### 2.3 En-tête, pied de page, navigation
- Recherche mise en avant (on vient chercher un objet), rayons en liste, sélecteur de langue, panier.
- Pied de page indigo. Suppression des libellés en majuscules, des points médians et des flèches décoratives.

### 2.4 Accueil
- **Structure** :
  ```
  ┌───────────────────────────────────────────────────────────┐
  │ Titre large, étroit, gras, aligné à gauche                │
  │ Recherche                    [démo 3D en phase 4]         │
  ├───────────────────────────────────────────────────────────┤
  │ Alatsinainy  Talata  ALAROBIA  Alakamisy  Zoma  Sabotsy … │
  │   aujourd'hui ▢                livré ici ■                │
  ├───────────────────────────────────────────────────────────┤
  │ Rayons : liste typographique avec le nombre d'articles    │
  │ Nouveautés de la semaine : grille de produits             │
  │ Commander en trois temps : choisir, payer, recevoir       │
  └───────────────────────────────────────────────────────────┘
  ```
- **L'élément mémorable** : la frise de la semaine en malgache. Elle a une fonction : montrer quel jour arrive une commande passée maintenant. Elle rappelle le nom de la marque sans le commenter.
- **Retiré** : le bloc éditorial « notre parti pris », la grille de catégories en photos, le bandeau de garanties à quatre icônes.
- La numérotation « trois temps » est justifiée : c'est une vraie séquence.

### 2.5 Catalogue, carte produit, fiche produit
- Carte : photo carrée sur fond pierre, nom, prix en ariary bien visible, note. Pas d'effet de zoom au survol sur chaque carte.
- Fiche : estimation de livraison avec le jour en clair (« Commandé aujourd'hui, livré d'ici Talata 17 »).

### 2.6 Panier, commande, compte, pages d'aide
- Même système. La page « À propos » est réécrite autour du nom et du projet (texte à valider par le propriétaire, décision D3).

### 2.7 Critique sur captures
- Captures à 320, 390, 768 et 1440 px dans les trois langues. Chaque page est relue contre la liste des clichés de `CLAUDE.md`, puis un élément décoratif est retiré.

**Livrable** : une boutique qu'on ne confond pas avec un modèle, vérifiée sur captures.

---

## Phase 3 — Commerce malgache

### 3.1 Ariary et catalogue de démonstration
- **Fichiers** : `prisma/seed.mjs`, réglages par défaut du schéma.
- Devise par défaut MGA. Nouveau catalogue d'objets du quotidien (cuisine, maison, vannerie et textile, épicerie, soin, électronique), prix réalistes en ariary, traduit dans les trois langues, clients et adresses malgaches.
- Photos : celles déjà présentes dans `public/products/` ; le propriétaire peut fournir les siennes (décision D4).
- **Test** : point de vigilance 6.

### 3.2 Adresses et zones de livraison
- **Fichiers** : `prisma/schema.prisma` (`ShippingZone`), `src/lib/shipping.ts` et ses tests, formulaire de commande.
- Adresse adaptée : nom, téléphone (+261), adresse ou lot, quartier, ville, province (Antananarivo, Antsiranana, Fianarantsoa, Mahajanga, Toamasina, Toliara). Code postal facultatif.
- Zones modifiables dans le back-office : nom, tarif, délai minimal et maximal. Seuil de gratuité conservé.
- **Interface** : `estimateDelivery(date, zone)` renvoie la date de livraison prévue en sautant le dimanche. C'est elle qui alimente la frise de la semaine.

### 3.3 Paiement Mobile Money et à la livraison
- **Fichiers** : `src/actions/checkout.ts`, `src/actions/admin/orders.ts`, réglages (numéros marchands), pages de confirmation.
- **Fonctionnement, sans intégration technique** : le client choisit MVola, Orange Money ou Airtel Money. La confirmation affiche le numéro du marchand, le montant et la référence à indiquer. Le client saisit la référence de sa transaction. La commande reste « en attente » jusqu'à ce que le vendeur confirme la réception dans le back-office. C'est ainsi que travaillent beaucoup de petits vendeurs, et c'est utilisable en vrai dès maintenant.
- Paiement à la livraison conservé. Carte bancaire retirée (réactivable en phase 7).
- **Test** : point de vigilance 7.

### 3.4 Renommage
- Nom de boutique, adresses e-mail de démonstration, métadonnées, `README.md`.

**Livrable** : un parcours d'achat crédible pour un client à Madagascar, en ariary, payé par Mobile Money.

---

## Phase 4 — Personnalisation en direct et en 3D

Le client choisit une couleur, écrit un texte, ajoute une image, et voit le résultat tourner sous ses yeux.

### 4.1 Modèle de données
- **Fichiers** : `prisma/schema.prisma`, `src/lib/customization.ts` et ses tests.
- Produit : gabarit 3D (`mug`, `gourde`, `carnet`, `tote`, ou aucun), couleurs proposées, longueur maximale du texte, image autorisée ou non, supplément de prix.
- `Customization` : produit, couleur, texte, police, couleur du texte, image, position et taille, aperçu, fichier d'impression.
- Ligne de panier : `{ id, q, c }` où `c` est l'identifiant de personnalisation. Deux personnalisations différentes du même produit font deux lignes.
- Ligne de commande : copie figée de la personnalisation, de l'aperçu et du fichier d'impression.

### 4.2 Dessin de la surface imprimée
- **Fichiers** : `src/lib/customizer/layout.ts` (fonctions pures, testées), `src/components/customizer/texture.ts`.
- Une fonction pure calcule où et à quelle taille placer le texte et l'image dans la zone imprimable de chaque gabarit. Le même dessin sert à la texture 3D, à l'aperçu 2D et au fichier d'impression haute définition : ce que le client voit est ce que le vendeur reçoit.
- **Test** : point de vigilance 3.

### 4.3 Envoi d'image par le client
- **Fichiers** : `src/app/api/customizer/upload/route.ts`, `src/lib/upload.ts` et ses tests.
- Point d'envoi public, donc strict : type vérifié sur le contenu réel du fichier et non sur son nom, 5 Mo maximum, image réduite à 2048 px dans le navigateur avant l'envoi (économie de données mobiles), nom généré par le serveur, nombre d'envois limité par adresse IP, SVG refusé.
- Script de nettoyage des images jamais commandées après sept jours.
- **Test** : point de vigilance 2.

### 4.4 Gabarits 3D
- **Fichiers** : `src/components/customizer/models/{mug,gourde,carnet,tote}.tsx`, `scene.tsx`.
- Modèles construits par le code, sans fichier externe à télécharger : léger et sans question de licence. Éclairage local, ombre de contact, rotation au doigt et à la souris, boutons de rotation accessibles au clavier.
- Rotation automatique lente uniquement jusqu'à la première interaction, désactivée si l'utilisateur a demandé moins d'animations.

### 4.5 Interface de personnalisation
- **Fichiers** : `src/components/customizer/customizer.tsx`, intégration dans la fiche produit, `src/actions/customizer.ts`.
- Sur la fiche d'un produit personnalisable : onglets « Photos » et « Personnaliser ». Réglages en vrais champs de formulaire (pastilles de couleur nommées, champ texte avec compteur, choix de police, envoi d'image, curseurs de taille et de position).
- « Ajouter au panier » enregistre la personnalisation, l'aperçu et le fichier d'impression, puis ajoute la ligne. L'aperçu apparaît dans le panier, la commande et l'espace client.
- Mention claire : un article personnalisé n'est ni repris ni échangé.

### 4.6 Chargement et solution de repli
- La 3D n'est téléchargée qu'à l'ouverture de l'onglet. Sans WebGL, ou si l'appareil peine, l'aperçu 2D prend le relais avec les mêmes réglages.
- **Test** : point de vigilance 1 ; mesure du poids de la page d'accueil et du catalogue avant et après (ils ne doivent pas grossir).

### 4.7 Démonstration sur l'accueil
- Dans le héros : « Écrivez votre prénom » et une tasse qui l'affiche en direct. Chargée seulement quand le visiteur touche le champ ; avant cela, une image fixe.
- C'est l'audace de la page d'accueil. La frise de la semaine reste, discrète.

**Livrable** : commander une tasse à son nom, la voir en 3D, et retrouver l'aperçu jusque dans la commande.

---

## Phase 5 — Back-office

### 5.1 Produits : traductions et personnalisation
- Onglets de langue dans le formulaire produit, avec indicateur de traduction manquante. Bloc « Personnalisation » : gabarit, couleurs, options, supplément.

### 5.2 Commandes personnalisées et paiements
- Détail de commande : aperçu, texte, couleur, téléchargement du fichier d'impression et de l'image d'origine. Bouton « Paiement reçu » pour le Mobile Money, avec la référence saisie par le client.

### 5.3 Réglages
- Zones de livraison, numéros Mobile Money, annonce par langue.

### 5.4 Interface du back-office en trois langues et aux couleurs d'Alarobia
- Sobre : le back-office reste un outil de travail.

**Livrable** : le vendeur gère seul traductions, produits personnalisables, paiements et livraisons.

---

## Phase 6 — Qualité

- **6.1 Accessibilité** : contrôle automatique (axe) sur chaque page dans les tests navigateur, puis parcours au clavier seul.
- **6.2 Performance** : mesure sur un profil « téléphone modeste, 3G lente » ; budget de poids par page noté dans `PROGRESS.md`.
- **6.3 Sécurité** : revue avec `/security-review` ; limitation de débit sur la connexion, l'inscription et l'envoi d'images.
- **6.4 Référencement** : balises `hreflang`, plan du site par langue, données structurées, image de partage.
- **6.5 Parcours complets** dans les trois langues, sur mobile et ordinateur, en production locale.
- **6.6 Documentation** : `README.md` et `CLAUDE.md` à jour.

---

## Phase 7 — Mise en ligne, puis ce qu'une vraie boutique demande

Décidé par le propriétaire le 18/11/2026 : **aucune option payante**.
- Hébergement sur l'offre gratuite de **Netlify**, mise à jour à chaque envoi sur `main`. Écartés :
  - Vercel, dont l'offre gratuite interdit l'usage commercial et dont l'offre Pro est payante ;
  - Cloudflare : code du serveur limité à 3 Mo, et changement de pilote pour Prisma.
- Base PostgreSQL sur l'offre gratuite de **Neon** ; fichiers envoyés dans **Netlify Blobs**, sans compte de plus.
- Adresse en `.netlify.app` d'abord. Un domaine se branchera plus tard en changeant `NEXT_PUBLIC_SITE_URL`.
- L'ancien projet Vercel (`anjahnyonys-projects/alarobia`) est à débrancher de GitHub, sinon chaque envoi le remettrait en ligne.

La phase est découpée en sous-phases indépendantes. **7A met la boutique en ligne** et se détaille ci-dessous. 7B à 7D se détaillent quand le propriétaire les demande.

### Contraintes propres à la phase 7A

- **Quotas gratuits** : Netlify compte en crédits (300 par mois sur l'offre gratuite). Au-delà, le site se met en pause jusqu'au mois suivant, sans jamais facturer. Chaque mise en ligne en consomme : on n'envoie sur GitHub que des lots finis et vérifiés.
- **Région** : la base Neon est créée dans la région des fonctions Netlify du site, pour que chaque requête n'ait pas à traverser un océan. Par défaut, fonctions et Netlify Blobs sont tous deux en `us-east-2` (Ohio) : Neon en `aws-us-east-2`. Si le propriétaire change la région des fonctions, passer la même `region` à `getStore` avant le premier envoi en ligne (les données écrites ne changent pas de région).
- **En local et dans les tests** : PostgreSQL 17 (Homebrew), installé le 18/11/2026.
  - Bases `alarobia` (développement) et `alarobia_test` (tests), créées en collation `C.UTF-8` (fournisseur `builtin`).
  - Utilisateur `mac`, sans mot de passe : `postgresql://mac@localhost:5432/<base>`.
- **Fichiers envoyés** : ils restent sur le disque en local et dans les tests (`uploads/`, `uploads-test/`). Netlify Blobs ne sert que quand le code tourne sur Netlify.
- **Fuseau** : les tests unitaires et navigateur tournent avec `TZ=UTC`, comme les fonctions Netlify.
- **Taille des envois** : les fonctions Netlify refusent les requêtes de plus de 6 Mo. Avec l'encodage d'un formulaire, aucun envoi ne doit dépasser 4 Mo.
- **Schéma** :
  - `prisma db push` en local et dans les tests ;
  - en production, migrations versionnées (`prisma/migrations/`), appliquées par `prisma migrate deploy` à la compilation.
- **Dépendances** : une seule ajoutée, `@netlify/blobs` (stockage des envois sur Netlify).
- **GitHub** : rien n'y part sans la demande du propriétaire, puisqu'un envoi met le site en ligne.

### Points de vigilance de la phase 7A

Ils complètent les sept points du début du plan. Chacun a son test dans la tâche indiquée.

8. **Recherche et majuscules** : « CAFÉ », « Café » et « café » trouvent les mêmes produits, dans la boutique et dans le back-office. PostgreSQL, contrairement à SQLite, compare `contains` à la lettre près, majuscules comprises (7.1).
9. **Commandes simultanées sur le dernier stock** : vingt commandes arrivent en même temps sur un article qui n'a plus que cinq exemplaires. Cinq passent, quinze sont refusées pour rupture, et le stock finit à 0 sans jamais devenir négatif (7.1).
10. **Commande tard le soir** : une commande passée à 23 h 30 à Antananarivo (20 h 30 UTC) s'affiche à 23:30 et compte pour ce jour-là dans le tableau de bord, même sur un serveur en UTC (7.3).
11. **Photo de téléphone de 8 Mo**, envoyée par le vendeur ou par un client : elle est réduite dans le navigateur, ou refusée avec un message qui dit quoi faire. Jamais une erreur muette de l'hébergeur (7.2).
12. **Réglage de production manquant** (Netlify Blobs injoignable, `AUTH_SECRET`, `CRON_SECRET`) : l'échec est explicite et nomme ce qui manque. Jamais d'écriture sur le disque éphémère des fonctions, qui perdrait le fichier en silence (7.2, 7.4).

### 7.0 Prénom de démonstration « Anjah »
- Le propriétaire a changé le prénom dans le code et les tests.
- Photo fixe refaite au même cadrage (`public/home/tasse-anjah.jpg`) ; `DEMO_STILL` et `README.md` à jour.

### 7.1 PostgreSQL
- **Fichiers** :
  - modifiés : `prisma/schema.prisma`, `.env.example`, `playwright.config.ts`, `src/lib/__tests__/promo-consume.test.ts` ;
  - les quatre recherches : `src/app/[locale]/(store)/products/page.tsx`, `src/app/[locale]/admin/{products,orders,customers}/page.tsx` ;
  - créés : `prisma/migrations/0_init/migration.sql`, `prisma/migrations/migration_lock.toml`, `src/lib/__tests__/migrations.test.ts`, `src/lib/__tests__/stock.test.ts`.
- **Connexion** : `datasource db { provider = "postgresql", url = env("DATABASE_URL"), directUrl = env("DATABASE_URL_UNPOOLED") }`.
  - L'adresse regroupée de Neon (pooler) sert à l'application, l'adresse directe aux migrations. Le propriétaire les copie depuis Neon dans les variables du site Netlify.
  - En local, les deux valent `postgresql://mac@localhost:5432/alarobia`.
- **Nettoyage du schéma** (la base de production part vide) :
  - retirer les colonnes obsolètes `StoreSettings.shippingStandardCents` et `shippingExpressCents` ;
  - retirer le `@map("shippingMethod")` de `Order.shippingZone`.
- **Migration initiale** : générée sans base, par `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.
  - Test `migrations.test.ts` : `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code`, avec une base fantôme dans un schéma temporaire de `alarobia_test`. Sortie 0 attendue. Un changement de schéma sans migration fait échouer `npm test`.
- **Recherche** : `mode: "insensitive"` sur chaque `contains` des quatre recherches, traductions comprises. Test du point 8 dans `e2e/langues.spec.ts` ou `e2e/admin.spec.ts`.
- **Tests sur PostgreSQL** :
  - les tests unitaires qui ont besoin d'une base créent un schéma temporaire (`?schema=<nom>_<aléatoire>`) dans `TEST_DATABASE_URL`, qui vaut par défaut `postgresql://mac@localhost:5432/alarobia_test`, et le suppriment à la fin ;
  - les tests navigateur utilisent `alarobia_test`, schéma `public`.
- **Stock** : le décrément conditionnel de `src/actions/checkout.ts` passe dans `reserveStock(tx: Prisma.TransactionClient, lines: { productId: string; quantity: number }[]): Promise<boolean>` (`src/lib/stock.ts`), si ce n'est pas déjà une fonction. `stock.test.ts` couvre le point 9 contre une vraie base.
- `prisma/seed.mjs` doit produire les mêmes données qu'avant (`demo-catalog.test.ts` reste vert).
- **Fini quand** : `npm test` et toute la suite `npm run test:e2e` passent contre PostgreSQL en local ; `lint`, `tsc` et la compilation sont propres.

### 7.2 Fichiers envoyés dans Netlify Blobs
- **Fichiers** :
  - créés : `src/lib/storage.ts` et ses tests, `src/lib/cleanup.ts` et ses tests, `src/app/api/cron/nettoyage/route.ts`, `.github/workflows/nettoyage.yml` ;
  - modifiés : les deux points d'envoi (`api/customizer/upload`, `api/admin/upload`), `src/app/uploads/[name]/route.ts`, la route de téléchargement du back-office (`api/admin/orders/…/[file]`), `src/actions/customizer.ts`, `src/components/admin/image-uploader.tsx`, `src/lib/upload.ts`, les messages (fr, en, mg), le commentaire de `Customization` dans `prisma/schema.prisma` (il cite le script supprimé) ;
  - supprimé : `scripts/nettoyer-personnalisations.mjs`.
- **Interface** (`src/lib/storage.ts`, `server-only`) : plus aucun autre fichier ne touche au disque des envois.
  - `saveUpload(name: string, bytes: Uint8Array, contentType: string): Promise<void>`
  - `readUpload(name: string): Promise<{ bytes: Uint8Array; contentType: string } | null>`
  - `uploadExists(name: string): Promise<boolean>`
  - `listUploads(prefix: string): Promise<{ name: string; uploadedAt: Date }[]>`
  - `deleteUploads(names: string[]): Promise<void>`
- **Choix du stockage** :
  - Netlify Blobs quand le code tourne sur Netlify : magasin `uploads` en cohérence forte (`getStore({ name: "uploads", consistency: "strong" })`), chaque fichier avec ses métadonnées `{ contentType, uploadedAt }`. Le signe « on tourne sur Netlify » est celui que donne la documentation de `@netlify/blobs` (à relever et à citer dans le code).
  - Sinon le disque, comme aujourd'hui (`upload-dir.ts`).
  - Sur Netlify, si le magasin est injoignable : erreur explicite (point 12), jamais de repli sur le disque.
- **Adresses des fichiers** : celles qui sont en base ne changent pas (`/uploads/<nom>`).
  - La route `/uploads/[name]` lit par `readUpload`, garde ses en-têtes et ajoute `Netlify-CDN-Cache-Control: public, max-age=31536000, immutable`, pour que le réseau de Netlify serve les demandes suivantes sans relancer la fonction.
  - Le fichier d'impression peut-il dépasser 4 Mo (sac, image en grand) ? À mesurer. Si oui, vérifier que le téléchargement passe sous la limite de réponse des fonctions Netlify, sinon le dire avant de choisir.
- **Taille des envois** (point 11) :
  - `MAX_UPLOAD_BYTES` passe de 5 à 4 Mo, avec les textes « 4 Mo », « 4 MB » dans les trois langues ;
  - les photos envoyées par le vendeur sont réduites dans le navigateur à 2048 px, comme l'image du client (même fonction que `send-image.ts`).
  - Tests : une photo de 8 Mo envoyée depuis le back-office et depuis la fiche arrive réduite, sous 4 Mo.
- **Nettoyage** :
  - `staleFiles` passe du script à `src/lib/cleanup.ts`, avec ses tests, à côté de `cleanupCustomizations({ dryRun, now }): Promise<{ abandoned: number; files: string[] }>` ;
  - route `GET /api/cron/nettoyage` : `Authorization: Bearer <CRON_SECRET>`, 401 sinon, 503 si `CRON_SECRET` n'est pas défini, `?dry-run=1` pour un essai à blanc ;
  - déclenchée chaque jour par GitHub Actions (`.github/workflows/nettoyage.yml`, `schedule: "0 1 * * *"`, soit 4 h à Antananarivo, plus `workflow_dispatch` pour un lancement à la main). Le flux de travail appelle la route avec `curl --fail`, en lisant les secrets du dépôt `SITE_URL` et `CRON_SECRET`. C'est gratuit, et cela ne dépend pas de l'hébergeur.
- **Tests** :
  - le disque dans un dossier temporaire (les cinq fonctions) ;
  - Netlify Blobs avec `vi.mock("@netlify/blobs")` : nom et options du magasin, métadonnées écrites, lecture, liste, suppression ;
  - magasin injoignable sur Netlify ;
  - la route de nettoyage : sans secret, avec un mauvais secret, sans variable, à blanc ;
  - les tests navigateur existants restent sur le disque et passent tels quels.
- **Fini quand** : tests unitaires et suite navigateur verts, et `grep -rn "node:fs" src` ne trouve plus que `storage.ts`, `upload-dir.ts` et ce qui ne concerne pas les envois (image de partage, tests).

### 7.3 Heures du back-office à l'heure de Madagascar
- **Fichiers** : `src/lib/format.ts` et ses tests, `src/app/[locale]/admin/page.tsx`, `vitest.config.mts` (`test.env.TZ = "UTC"`), `playwright.config.ts` (`TZ: "UTC"` dans l'environnement du serveur).
- **Affichage** : toute date ou heure affichée passe `timeZone: "Indian/Antananarivo"` à `Intl`, ou part de `madagascarTime()` pour le malgache écrit à la main.
- **Tableau de bord** : les clés de jour et la fenêtre de 7 ou 30 jours partent de `madagascarTime()`, avec `madagascarDayKey(date: Date): string` (`src/lib/format.ts`).
- **Tests** (point 10), vus rouges avec `TZ=UTC` avant le correctif :
  - `2026-11-17T20:30:00Z` s'affiche le 17 novembre à 23:30, en fr, en et mg ;
  - `2026-11-17T21:30:00Z` s'affiche le 18 novembre à 00:30 ;
  - ces deux instants tombent dans deux jours différents du tableau de bord.
  - Les dates de livraison promises restent justes (tests de `shipping` verts sous `TZ=UTC`).

### 7.4 Réglages de production
- **`netlify.toml`** : commande de compilation `npx prisma migrate deploy && npm run build`. Node 22 vient de `.nvmrc`. Le reste est laissé à l'adaptateur Next.js de Netlify, sans réglage de plus.
- **Adresse du site** : `siteBase()` (`src/lib/seo.ts`) se rabat sur `process.env.URL`, l'adresse principale que Netlify fournit, quand `NEXT_PUBLIC_SITE_URL` est vide. Vérifier d'abord que `siteBase` ne sert que côté serveur, sinon le signaler. Test unitaire.
- **Adresse du client** : sur Netlify, `clientIp()` (`src/lib/rate-limit.ts`) lit d'abord `x-nf-client-connection-ip`, posé par Netlify (vérifier dans sa documentation que le client ne peut pas l'imposer), puis `x-forwarded-for` comme aujourd'hui. Tests unitaires.
- **En-têtes de sécurité** sur toutes les adresses (`headers()` de `next.config.ts`), testés dans `e2e/securite.spec.ts` :
  - `X-Content-Type-Options: nosniff` ;
  - `Referrer-Policy: strict-origin-when-cross-origin` ;
  - `X-Frame-Options: DENY` ;
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
- **Données de départ en production** : `prisma/init-production.mjs`, lancé une fois à la main par `node --env-file=.env.production.local prisma/init-production.mjs`.
  - Il demande `ADMIN_EMAIL` et `ADMIN_PASSWORD` (12 caractères au moins), et refuse de tourner (sortie 1 avec un message) si la base contient déjà un utilisateur, un produit ou une commande.
  - Il crée les réglages (numéros Mobile Money vides : seul le paiement à la livraison est proposé tant que le vendeur n'a pas saisi les siens ; adresse de contact = `ADMIN_EMAIL`), les zones de livraison, les rayons et les 27 produits avec leurs traductions et leurs photos, et le compte administrateur.
  - Il ne crée rien d'autre : ni client, ni avis (jamais de faux avis sur une vraie boutique), ni commande, ni code promo, ni abonné.
  - Il lit les mêmes données que `seed.mjs`, sans les recopier. La sortie de `seed.mjs` ne change pas.
  - Test unitaire sur un schéma temporaire : 1 utilisateur ADMIN, 27 produits, 0 avis, 0 commande, 0 code promo ; une seconde exécution est refusée, de même qu'une exécution sans `ADMIN_PASSWORD`.
- **Documentation** : `.env.example` documente chaque variable avec sa provenance (Neon, Netlify, à générer), et `README.md` gagne une section « Mise en ligne ». `AUTH_SECRET` absent ou trop court arrête déjà le serveur (`src/lib/auth.ts`).

### 7.5 Mise en ligne (propriétaire et architecte)
1. **Propriétaire, avant l'envoi** :
   - débrancher l'ancien projet Vercel de GitHub, ou le supprimer ;
   - créer la base sur neon.tech (offre gratuite) et noter ses deux adresses, regroupée et directe ;
   - générer `AUTH_SECRET` et `CRON_SECRET` (`openssl rand -base64 32` chacun).
2. **Propriétaire, sur netlify.com** (offre gratuite) :
   - créer le site depuis le dépôt GitHub `AnjahNyOny/alarobia` et relever la région de ses fonctions (la base Neon doit être dans la même ; sinon la recréer au bon endroit) ;
   - ajouter, pour la production seulement, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `CRON_SECRET` et `NEXT_PUBLIC_SITE_URL` (l'adresse `.netlify.app` du site).
3. **Propriétaire, sur GitHub** : secrets du dépôt `SITE_URL` et `CRON_SECRET`, pour le nettoyage quotidien.
4. **Propriétaire, en local** : copier l'adresse directe de Neon dans `.env.production.local` (ignoré par git) sous le nom `DATABASE_URL_UNPOOLED` (et `DATABASE_URL`), avec `ADMIN_EMAIL` et `ADMIN_PASSWORD` de son choix.
5. **Architecte, quand le propriétaire le demande** :
   - `git push` : Netlify compile et applique les migrations ;
   - puis `node --env-file=.env.production.local prisma/init-production.mjs` ;
   - vérifier que la collation de la base Neon (`SHOW lc_collate`) est la même qu'en local, sinon le signaler.
6. **Contrôle en ligne (`verificateur`)** : `e2e/production.spec.ts`, lancé seulement si `PROD_URL` est défini.
   - Pages en fr, en et mg (accueil, catalogue, fiche, aide) : réponse 200, aucune erreur de console.
   - Envoi d'une image sur la fiche personnalisable, puis relecture de l'image par `/uploads/…` (le nettoyage l'effacera au bout de sept jours).
   - Connexion au back-office avec le compte du propriétaire.
   - En-têtes de sécurité, `hreflang` et adresse canonique sur l'adresse en ligne.
   - Poids des pages par `poids-pages.mjs` contre l'adresse en ligne, comparé aux budgets.
7. **Propriétaire** : une commande réelle de bout en bout (paiement à la livraison), puis son annulation dans le back-office.
8. **Nettoyage** : lancer une fois le flux de travail à la main depuis GitHub (onglet Actions), puis vérifier qu'il réussit.

**Livrable 7A** : la boutique tourne gratuitement sur son adresse `.netlify.app`, et les commandes, les comptes et les images survivent d'un déploiement à l'autre.

### Ce que la phase 7A ne fait pas (décidé)
- **Limites de débit partagées** : elles restent en mémoire, donc comptées par instance de fonction, ce qui les rend plus lâches. À revoir avec un stockage partagé si des abus apparaissent.
- **Politique CSP** : elle demande des nonces, incompatibles avec la mise en cache statique des pages. Plus tard.
- **Domaine personnalisé** : plus tard. Il suffira de l'ajouter dans Netlify et de changer `NEXT_PUBLIC_SITE_URL`.
- **Aperçus de déploiement** (branches, demandes de fusion) : aucun, on n'envoie que `main`. Les variables de la base ne sont définies que pour la production, donc un aperçu échouerait à la compilation au lieu de toucher la base réelle.
- **Surveillance des quotas** : le propriétaire consulte la consommation de crédits dans Netlify. Rien d'automatique.

### 7B à 7D (à détailler quand le propriétaire les demande)
- **7B E-mails et SMS** : confirmation de commande, changement de statut, et la lettre d'information (soit on la tient, soit on retire ses promesses). Service d'envoi à choisir.
- **7C Mobile Money par API** : il faut les comptes marchands MVola, Orange Money et Airtel Money.
- **7D Avant d'annoncer le site** :
  - mentions légales complètes (NIF, STAT, adresse) ;
  - conditions de retour sans contradiction avec la personnalisation ;
  - texte « Qui sommes-nous » ;
  - relecture finale du malgache.

---

## Ce que ce plan ne fait pas

- Pas de place de marché à plusieurs vendeurs : un seul vendeur, le propriétaire.
- Pas de modèles 3D importés (fichiers GLB) dans un premier temps : quatre gabarits intégrés. L'import pourra s'ajouter ensuite.
- Pas de variantes de produit (tailles, pointures) : à planifier à part si le besoin se confirme.
