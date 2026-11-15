# Suivi d'avancement — Alarobia

Le plan est dans [PLAN.md](PLAN.md). Ce fichier dit où on en est. Il est mis à jour à la fin de chaque tâche : case cochée, ce qui a été vérifié, décisions prises.

**État au 14/11/2026** : phases 0 à 3 faites. Restent en attente du propriétaire : la relecture du malgache (D2) et la validation du texte « Qui sommes-nous » (D3).

**Prochaine action** : phase 4, tâche 4.1 (modèle de données de la personnalisation).

## Décisions en attente

- **Texte « Qui sommes-nous »** (D3) : proposé par Claude dans `messages/*.json`, espace `about`. À corriger ou valider.
- **Retours** : la page d'aide annonce une reprise de l'article « convenue avec vous » et un remboursement par Mobile Money sous 5 jours ouvrés. Ce sont des hypothèses de Claude, à confirmer.
- **Préfixe « AL- »** des numéros de commande et des références : à confirmer.

## Décisions prises

| Date | Décision |
| --- | --- |
| 13/11/2026 | La boutique s'appelle Alarobia. Produits : objets du quotidien à Madagascar, catalogue libre. Logo à créer. |
| 13/11/2026 | Trois langues : français, anglais, malgache. |
| 13/11/2026 | Personnalisation des produits en direct (nom, image, couleur), avec de la 3D. |
| 13/11/2026 | Utiliser les skills GitHub pour le design et le développement (liste dans `CLAUDE.md`). |
| 13/11/2026 | Travailler selon un plan suivi dans ce fichier. |
| 14/11/2026 | D1 : un commit par tâche, sans pousser vers un dépôt distant. |
| 14/11/2026 | D2 : le propriétaire relit le malgache à la fin de la phase 1. |
| 14/11/2026 | D3 : Claude propose le texte « À propos », le propriétaire corrige. |
| 14/11/2026 | D4 : photos existantes pour la démonstration. |
| 14/11/2026 | D5 : premiers produits personnalisables : tasse, gourde, carnet, sac en toile. |
| 14/11/2026 | Phase 3 commencée avant la fin de la phase 2, à la demande du propriétaire. Les pages 2.5 et 2.6 gardent leur ancienne mise en page en attendant. |
| 14/11/2026 | Plafond de 20 000 000 Ar par montant validé par le propriétaire. |
| 14/11/2026 | Passage à Next 16 et React 19.3 : seule façon trouvée d'éliminer les erreurs d'hydratation intermittentes (mesuré). |

## Avancement

### Déjà fait : première version « Sève »
- [x] Boutique : accueil, catalogue filtrable, fiche produit, panier, codes promo, commande avec ou sans compte, espace client, avis, favoris
- [x] Back-office : tableau de bord, commandes, produits avec envoi de photos, catégories, clients, codes promo, avis, réglages
- [x] Vérifié le 13/11/2026 : parcours navigateur de 19 étapes en production locale sans erreur, lint et compilation propres
- [x] Skills installés dans `.claude/skills/`, `CLAUDE.md` et plan rédigés

Verdict du propriétaire : fonctionnel, mais visuellement « comme tous les sites e-commerce ». D'où la refonte.

### Phase 0 — Outillage et point de départ
- [x] 0.1 Tests unitaires (Vitest) sur la logique existante : 18 tests ; vérifiés en cassant volontairement deux fonctions (2 échecs attendus obtenus)
- [x] 0.2 Tests navigateur (Playwright) dans le dépôt : 8 parcours, 3 passages complets consécutifs au vert
- [x] 0.3 Node 22, retrait de l'épinglage `magic-string`, commit de référence
- [x] 0.4 (ajoutée) Erreur d'hydratation intermittente : cause trouvée, Next 16 adopté ; 0 erreur sur 2 400 chargements au banc d'essai

### Phase 1 — Trois langues
- [x] 1.1 Routage par langue et proxy combiné : `/fr`, `/en`, `/mg`, adresses communes en anglais ; 3 tests navigateur dédiés. Écart au plan : pas de redirection des anciennes adresses françaises, le site n'ayant jamais été en ligne.
- [x] 1.2 Fichiers de messages, test de parité des clés, glossaire (`docs/glossaire.md`). Les textes des pages sont ajoutés au fil de leur réécriture (phases 2, 3 et 5), pour ne pas traduire un texte qui va changer.
- [x] 1.3 Formats selon la langue : « 25 000 Ar », dates et jours en fr, en, mg (malgache écrit à la main, indépendant du navigateur). Les appels existants passent encore `"fr"` ; ils reçoivent la langue du visiteur quand leur page est réécrite.
- [x] 1.4 Contenu du catalogue traduit : tables de traduction et `localize()` avec repli champ par champ. Branchement dans les pages en phase 2, saisie dans le back-office en 5.1.
- [x] 1.5 Sélecteur de langue (en-tête, menu mobile, pied de page) ; erreurs et confirmations des actions de la boutique dans la langue du visiteur
- [ ] Relecture du malgache par le propriétaire (D2)

### Phase 2 — Identité Alarobia
- [x] 2.1 Jetons de design et typographie : blanc, indigo, latérite, raphia ; Archivo seule, titres resserrés
- [x] 2.2 Logo (étiquette « Ar ») et icône du site. Reste à faire : image de partage (og.png) et icône Apple
- [x] 2.3 En-tête, menu mobile, pied de page : traduits, recherche au centre
- [x] 2.4 Accueil : frise de la semaine en malgache avec estimation de livraison (5 tests), rayons en liste, étapes. Vérifié sur captures en fr, en, mg, à 390 et 1440 px
- [x] 2.5 Catalogue, carte produit, fiche produit : rayons en rangée d'enseignes, filtres en ligne, grille à quatre colonnes ; fiche avec prix en grand et jour de livraison par zone ; tout traduit en fr, en, mg. Vérifié : 105 tests unitaires, 26 parcours navigateur, captures à 320, 390, 768 et 1440 px
- [x] 2.6 Panier, commande, compte, pages d'aide : tiroir et page du panier, commande, confirmation, connexion, inscription, espace client, aide, « Qui sommes-nous », mentions légales, pages 404 et d'erreur ; tout traduit en fr, en, mg. Vérifié : 105 tests unitaires, 26 parcours navigateur
- [x] 2.7 Critique sur captures : toutes les pages de la boutique à 320, 390, 768 et 1440 px, en fr, en, mg ; aucun débordement horizontal, aucune erreur navigateur

### Phase 3 — Commerce malgache
- [x] 3.1 Ariary et nouveau catalogue de démonstration : devise MGA par défaut, 27 produits et 6 rayons en fr, en, mg (`prisma/catalog.mjs`), clients malgaches, plafond de 20 000 000 Ar par montant. Vérifié : 65 tests unitaires, 15 parcours navigateur, captures à 320 et 1440 px
- [x] 3.2 Adresses et zones de livraison : adresse malgache (lot, quartier, repère, ville, province, téléphone +261, code postal facultatif), zones gérées dans le back-office (`/admin/shipping`), date promise calculée par zone. Vérifié : 86 tests unitaires, 18 parcours navigateur, captures à 320 et 1440 px
- [x] 3.3 Paiement Mobile Money et à la livraison : MVola, Orange Money, Airtel Money (numéros du vendeur dans les réglages), référence de transaction saisie par le client, bouton « Paiement reçu » dans le back-office ; carte bancaire retirée. Vérifié : 105 tests unitaires, 23 parcours navigateur, captures à 320 et 1440 px en fr, en, mg
- [x] 3.4 Renommage complet : comptes de démonstration `@alarobia.example`, numéros de commande et références produit en « AL- », titre et description du site dans la langue du visiteur, `README.md` réécrit. Vérifié : 105 tests unitaires, 24 parcours navigateur

### Phase 4 — Personnalisation en direct et en 3D
- [ ] 4.1 Modèle de données
- [ ] 4.2 Dessin de la surface imprimée
- [ ] 4.3 Envoi d'image par le client
- [ ] 4.4 Gabarits 3D
- [ ] 4.5 Interface de personnalisation, tres visuelle, couleur taille etc
- [ ] 4.6 Chargement et solution de repli
- [ ] 4.7 Démonstration sur l'accueil

### Phase 5 — Back-office
- [ ] 5.1 Produits : traductions et personnalisation
- [ ] 5.2 Commandes personnalisées et paiements
- [ ] 5.3 Réglages : zones, Mobile Money, annonce par langue
- [ ] 5.4 Interface en trois langues, aux couleurs d'Alarobia

### Phase 6 — Qualité
- [ ] 6.1 Accessibilité
- [ ] 6.2 Performance sur téléphone modeste
- [ ] 6.3 Sécurité et limitation de débit
- [ ] 6.4 Référencement multilingue
- [ ] 6.5 Parcours complets dans les trois langues
- [ ] 6.6 Documentation à jour

### Phase 7 — Avant mise en ligne
Hors périmètre tant que non demandé. Voir `PLAN.md`.

## Points de vigilance (voir PLAN.md)

- [ ] 1. Téléphone sans WebGL : aperçu 2D et commande possible
- [ ] 2. Image envoyée inadaptée : refus expliqué
- [ ] 3. Texte de personnalisation inattendu
- [x] 4. Changement de langue en cours de commande : panier, code promo et saisie conservés (test `e2e/langues.spec.ts`)
- [x] 5. Traduction de produit manquante : repli sur le français (test `e2e/langues.spec.ts`, fiche en malgache)
- [x] 6. Gros montants en ariary à 320 px : cartes, fiche, panier, commande (3 langues) et tableaux du back-office (test `e2e/mobile-montants.spec.ts`)
- [x] 7. Mobile Money déclaré mais non reçu : la commande reste « en attente », l'annulation rend le stock, le client ne peut plus déclarer ensuite (test `e2e/paiement.spec.ts`)

## Journal

### 13/11/2026
- Première version construite et testée.
- Retour du propriétaire : design générique, skills non utilisés. Installation de six skills après lecture de leur contenu.
- Nouvelles demandes : nom Alarobia, produits malgaches du quotidien, personnalisation 3D, trois langues, plan suivi.
- Recherche de photos via l'interface non officielle d'Unsplash bloquée par l'environnement : on réutilise les photos existantes.
- Plan rédigé avec le skill `writing-plans`. Aucun code de la refonte écrit.

### 14/11/2026
- Plan validé par le propriétaire, décisions D1 à D5 actées.
- Phase 0 faite. La base de test est créée sans réinitialisation forcée : Prisma interdit `--force-reset` à un agent, et le seed suffit à la vider.
- Les tests navigateur ont révélé que l'erreur d'hydratation de la première version n'était pas corrigée (le déplacement du script JSON-LD ne traitait qu'un symptôme). Enquête par élimination, treize essais mesurés : ce n'était ni les notifications, ni les panneaux latéraux, ni le pied de page en lui-même, mais tout composant serveur asynchrone produisant beaucoup de HTML. Défaut du React embarqué dans Next 15.5 ; disparu sous Next 16.
- Poids ajouté : `vitest`, `@playwright/test` (tests), `next@16`, `react@19.3` (correctif).
- Tâche 1.1 faite : pages déplacées sous `src/app/[locale]/`, `next-intl` installé, socle de messages avec repli sur le français et test de parité des clés.
- Phase 1 faite côté infrastructure : 44 tests unitaires, 13 parcours navigateur. Ajustement du plan : les textes des pages ne sont pas traduits « à l'identique » puis réécrits ; chaque page est traduite au moment de sa réécriture.
- Phase 2 commencée (2.1 à 2.4). Critique sur captures : un libellé malgache débordait dans la frise sur mobile, corrigé. La boutique s'appelle Alarobia dans les réglages.
- Pas encore redessinés ni traduits : catalogue, fiche produit, panier, commande, compte, pages d'aide (2.5 et 2.6). Ils héritent déjà des couleurs et de la police, mais gardent l'ancienne mise en page et leurs textes en français.
- État des vérifications : 49 tests unitaires, 13 parcours navigateur, lint et types propres.
- Phase 3 commencée à la demande du propriétaire, avant 2.5 à 2.7.
- Tâche 3.1 faite. Le catalogue de démonstration vit dans `prisma/catalog.mjs` (données seules, testées) ; `seed.mjs` l'écrit en base. Un montant s'écrit toujours en unités mineures : 25 000 Ar = 2 500 000.
- Limite découverte : les colonnes de montant sont des entiers 32 bits, la base refuse tout montant au-delà de 21 474 836 Ar (dix canapés à 2 850 000 Ar faisaient planter la commande). Plafond posé à 20 000 000 Ar : prix d'un produit refusé au-delà dans le back-office, commande refusée avec un message traduit. Si le propriétaire veut vendre plus cher, il faudra passer ces colonnes en BigInt (à décider).
- Le contrôle « pas de défilement horizontal » des tests mobiles ne voyait rien : en émulation mobile, `window.innerWidth` s'élargit avec le contenu. Corrigé (`clientWidth`). Il a alors révélé des débordements à 320 px qui existaient déjà : pied de page en malgache, bouton d'ajout au panier, panier, commande, tableaux du back-office (libellés `sr-only` qui s'échappaient du conteneur défilant). Tous corrigés.
- Malgache : le catalogue de démonstration est rédigé par Claude et reste à relire ; les caractéristiques des produits ne sont pas traduites en malgache et s'affichent en français (repli prévu). Les termes confirmés dans le glossaire (komandy, ny tianko) sont appliqués à `messages/mg.json`.
- Non fait en 3.1, prévu plus loin : adresses et téléphone du formulaire de commande (3.2), carte bancaire encore proposée (3.3), références « SV- » et adresses `@seve.example` (3.4).
- État des vérifications : 65 tests unitaires, 15 parcours navigateur, lint, types et compilation propres.
- Tâche 3.2 faite. Choix retenus, à corriger si le propriétaire voit les choses autrement :
  - **Le client choisit sa zone de livraison** à la commande (liste avec tarif, délai et date promise). Elle n'est pas déduite de l'adresse : « Antananarivo ville » et « environs » ne se distinguent pas par la province. Le vendeur vérifie la cohérence en préparant la commande.
  - **Les modes « standard » et « express » disparaissent** au profit des zones. Le seuil de gratuité vaut pour toutes les zones.
  - **Téléphone malgache obligatoire** (03x ou 020, avec ou sans +261), enregistré sous la forme « 034 12 345 67 ». Un numéro étranger est refusé : le livreur doit pouvoir appeler.
  - **Plus de champ « pays »** : la boutique ne livre qu'à Madagascar. Le « complément d'adresse » devient un **repère** pour le livreur.
  - La commande garde le nom de la zone (en français) et la date promise ; supprimer ou modifier une zone ne touche pas l'historique. La dernière zone ouverte ne peut être ni fermée ni supprimée.
  - Les dates promises sont calculées à l'heure de Madagascar (`madagascarTime`), pas à celle du serveur.
- Base : aucune colonne supprimée (Prisma refuse de supprimer une colonne remplie sans option destructive). `StoreSettings.shippingStandardCents` et `shippingExpressCents` ne servent plus ; `Order.shippingZone` occupe l'ancienne colonne `shippingMethod`. À nettoyer lors du passage à PostgreSQL (phase 7).
- Débordement à 320 px corrigé sur la commande en malgache (un `fieldset` ne rétrécit pas sans `min-w-0`).
- Reste français en dur dans la commande et le compte : titres d'étapes, paiement, récapitulatif (tâche 2.6). Les champs d'adresse et les zones sont traduits.
- État des vérifications : 86 tests unitaires, 18 parcours navigateur, lint, types et compilation propres.
- Tâche 3.3 faite. Choix retenus, à corriger si le propriétaire voit les choses autrement :
  - **Aucune commande n'est « payée » à sa création.** Toutes naissent « en attente » : le Mobile Money est confirmé par le vendeur, la livraison se paie au livreur (encaissement daté à la remise du colis).
  - **Le client paie après avoir commandé** : la confirmation affiche le montant, le numéro du vendeur et le nom du titulaire, avec un bouton de copie, puis demande la référence reçue par SMS. Il peut la corriger tant que le vendeur n'a pas tranché.
  - **Déclarer ne vaut pas paiement.** La référence est signalée au vendeur (« Référence à vérifier » dans la liste des commandes) ; seul le bouton « Paiement reçu » passe la commande à « payée ».
  - **Le stock est réservé dès la commande** et rendu à l'annulation. Il n'y a pas d'annulation automatique d'une commande restée impayée : c'est le vendeur qui annule (à décider si un délai doit le faire à sa place).
  - **Un opérateur sans numéro n'est pas proposé.** Un numéro du mauvais réseau est refusé dans les réglages (034 et 038 MVola, 032 et 037 Orange, 033 Airtel) : il ferait envoyer l'argent à quelqu'un d'autre.
  - La référence de transaction n'est contrôlée que sur sa forme (4 à 40 lettres, chiffres, points, tirets) : rien ne la relie à l'opérateur tant qu'il n'y a pas d'API marchande (phase 7).
- Base : colonnes ajoutées avec valeur par défaut (`Order.paymentReference`, `paymentDeclaredAt`, `paidAt` ; quatre champs Mobile Money dans `StoreSettings`). Rien de supprimé.
- Reste en français en dur : la partie paiement du back-office (prévu en 5.4) et, sur la page de confirmation, le titre, l'introduction et le récapitulatif (2.6). Le panneau de paiement et le choix du moyen de paiement sont traduits dans les trois langues ; le malgache est à relire (D2).
- Relevé sur les captures, non corrigé : le numéro de commande se coupe après « SV- » à 320 px (il change de préfixe en 3.4).
- Le parcours « les messages d'erreur suivent la langue » a échoué une fois quand la machine était très chargée (charge moyenne à 16), puis est repassé sans changement. À surveiller ; ne pas allonger le délai sans avoir trouvé la cause.
- État des vérifications : 105 tests unitaires, 23 parcours navigateur, lint, types et compilation propres.
- Tâche 3.4 faite. Plus aucune trace de « Sève » hors de l'historique (`PLAN.md`, ce fichier, une phrase de `CLAUDE.md`).
  - Préfixe « AL- » pour les numéros de commande et les références produit : choix de Claude, à changer si le propriétaire préfère autre chose.
  - Les commandes déjà en base gardent leur numéro « SV- » ; les comptes `@alarobia.example` n'existent qu'après `npm run db:seed` (qui efface les données de la base de développement).
  - Le titre du site vient de `meta.title` dans les fichiers de messages, la description reprend l'accroche de l'accueil. Les titres des autres pages restent en français jusqu'à leur réécriture (2.5, 2.6).
- État des vérifications : 105 tests unitaires, 24 parcours navigateur, lint, types et compilation propres.
- Tâche 2.5 faite, avec le skill `frontend-design` (plan, relecture contre les clichés, captures).
  - **Catalogue** : la colonne latérale disparaît. Les rayons forment une rangée d'enseignes, le rayon ouvert surligné en raphia comme « aujourd'hui » dans la frise ; sur téléphone la rangée défile et se cale sur le rayon ouvert. Filtres sur une ligne (repliés derrière un bouton sur téléphone), un seul formulaire dans la page.
  - **Fiche produit** : photo carrée sur fond pierre, prix en très grand, et un tableau « commandé aujourd'hui, livré au plus tard » qui donne le jour et le tarif pour chaque zone ouverte (« Offerte » si le produit atteint seul le seuil). Description et caractéristiques en clair, sans accordéons. Moyens de paiement réellement ouverts rappelés sous le tableau.
  - **Retiré** : fil d'Ariane à trois niveaux (reste le lien vers le rayon), « 4,5 · 12 avis », liste de garanties à icônes, « expédié sous 24 h » (promesse que rien ne garantit).
  - La recherche porte aussi sur les traductions (« basket » trouve le panier tressé en anglais). Le filtre garde la langue en cours.
  - La navigation des rayons du catalogue s'appelle « Choisir un rayon » pour ne pas porter le même nom que celle de l'en-tête.
- Malgache : espaces de noms `catalog` et `product` rédigés par Claude, à relire (D2).
- Relevé, non traité : plusieurs produits de démonstration (baskets, veste en cuir, clavier) viennent de la première version et ne sont pas des objets du quotidien malgache ; ils sont rangés dans « Vannerie et textile » ou « Électronique ». À revoir avec les photos du propriétaire.
- État des vérifications : 105 tests unitaires, 26 parcours navigateur, lint, types et compilation propres.

### 15/11/2026
- Tâche 2.6 faite. Plus aucun texte en dur dans la boutique : dix nouveaux espaces de noms (`cart`, `checkout`, `order`, `status`, `auth`, `account`, `help`, `about`, `legal`, `pages`).
  - **Panier** : la barre de progression vers la livraison offerte est remplacée par une phrase sur fond raphia ; le code promo appliqué s'affiche comme une étiquette ; récapitulatif encadré d'un trait indigo, comme le panneau de paiement.
  - **Commande** : étapes numérotées en chiffres latérite (vraie séquence), choix de zone et de paiement sans icônes, le choix retenu est surligné.
  - **Compte** : même rangée d'enseignes que les rayons ; le libellé en majuscules « Espace client » disparaît. Statuts de commande traduits.
  - **Aide** : tableau des zones, retours en trois étapes numérotées, questions en liste lisible d'un coup (plus d'accordéons).
  - **Qui sommes-nous** : réécrite autour du nom. « Alarobia veut dire mercredi », la semaine en malgache avec le mercredi marqué, trois engagements. La photo de salon de la première version n'est plus utilisée (`public/editorial/hero.jpg` reste dans le dépôt).
  - Dans le panier et la commande, le nom du produit suit la langue du visiteur ; la commande enregistrée garde le nom français (c'est lui que voit le vendeur).
- Tâche 2.7 faite. Relecture contre la liste des clichés de `CLAUDE.md` : recherche dans le code des libellés en majuscules, points médians, flèches, numérotations décoratives, zooms au survol et animations d'apparition, rien trouvé. Éléments décoratifs retirés au passage : barre de progression du panier, icônes des choix de livraison et de paiement, photo de la page « Qui sommes-nous », accordéons de l'aide et de la fiche produit, fil d'Ariane.
- Les libellés du back-office restent en français (phase 5.4), y compris le mot « facultatif » par défaut des champs.
- Le serveur de développement tournait depuis 19 h avec un ancien client Prisma (erreur 500 sur l'accueil) : redémarré. La base de développement a été rechargée (`npm run db:seed`) pour les comptes `@alarobia.example`.
- État des vérifications : 105 tests unitaires, 26 parcours navigateur, lint, types et compilation propres.
