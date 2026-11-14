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

## Phase 7 — Avant une vraie mise en ligne (hors périmètre tant que non demandé)

API Mobile Money réelle (compte marchand nécessaire), e-mails et SMS de confirmation, PostgreSQL, stockage de fichiers externe, hébergement, mentions légales, relecture finale du malgache.

---

## Ce que ce plan ne fait pas

- Pas de place de marché à plusieurs vendeurs : un seul vendeur, le propriétaire.
- Pas de modèles 3D importés (fichiers GLB) dans un premier temps : quatre gabarits intégrés. L'import pourra s'ajouter ensuite.
- Pas de variantes de produit (tailles, pointures) : à planifier à part si le besoin se confirme.
