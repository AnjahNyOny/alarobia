# Suivi d'avancement — Alarobia

Le plan est dans [PLAN.md](PLAN.md). Ce fichier dit où on en est. Il est mis à jour à la fin de chaque tâche : case cochée, ce qui a été vérifié, décisions prises.

**État au 13/11/2026** : plan rédigé, en attente de validation. Aucune tâche de la refonte n'est commencée.

**Prochaine action** : réponse du propriétaire aux décisions D1 à D5, puis phase 0.

## Décisions en attente

| N° | Question | Proposition par défaut |
| --- | --- | --- |
| D1 | Puis-je committer à la fin de chaque tâche ? Le dépôt ne contient que le commit initial ; tout le reste est non commité. | Oui, un commit par tâche, sans pousser vers un dépôt distant. |
| D2 | Qui relit le malgache ? Je peux le rédiger, mais il faut une relecture par un locuteur natif. | Vous relisez `messages/mg.json` et le glossaire à la fin de la phase 1. |
| D3 | Texte de la page « À propos » : l'histoire d'Alarobia. | Je rédige une proposition courte, vous corrigez. |
| D4 | Photos des produits. | Celles déjà présentes pour la démonstration ; les vôtres dès que vous en avez. |
| D5 | Premiers produits personnalisables en 3D. | Tasse, gourde, carnet, sac en toile. |

## Décisions prises

| Date | Décision |
| --- | --- |
| 13/11/2026 | La boutique s'appelle Alarobia. Produits : objets du quotidien à Madagascar, catalogue libre. Logo à créer. |
| 13/11/2026 | Trois langues : français, anglais, malgache. |
| 13/11/2026 | Personnalisation des produits en direct (nom, image, couleur), avec de la 3D. |
| 13/11/2026 | Utiliser les skills GitHub pour le design et le développement (liste dans `CLAUDE.md`). |
| 13/11/2026 | Travailler selon un plan suivi dans ce fichier. |

## Avancement

### Déjà fait : première version « Sève »
- [x] Boutique : accueil, catalogue filtrable, fiche produit, panier, codes promo, commande avec ou sans compte, espace client, avis, favoris
- [x] Back-office : tableau de bord, commandes, produits avec envoi de photos, catégories, clients, codes promo, avis, réglages
- [x] Vérifié le 13/11/2026 : parcours navigateur de 19 étapes en production locale sans erreur, lint et compilation propres
- [x] Skills installés dans `.claude/skills/`, `CLAUDE.md` et plan rédigés

Verdict du propriétaire : fonctionnel, mais visuellement « comme tous les sites e-commerce ». D'où la refonte.

### Phase 0 — Outillage et point de départ
- [ ] 0.1 Tests unitaires (Vitest) sur la logique existante
- [ ] 0.2 Tests navigateur (Playwright) dans le dépôt
- [ ] 0.3 Node 22, retrait de l'épinglage `magic-string`, commit de référence

### Phase 1 — Trois langues
- [ ] 1.1 Routage par langue et middleware combiné
- [ ] 1.2 Fichiers de messages, test de parité des clés, glossaire
- [ ] 1.3 Formats selon la langue (prix, dates, jours)
- [ ] 1.4 Contenu du catalogue traduit, avec repli sur le français
- [ ] 1.5 Sélecteur de langue et messages d'erreur traduits
- [ ] Relecture du malgache par le propriétaire (D2)

### Phase 2 — Identité Alarobia
- [ ] 2.1 Jetons de design et typographie
- [ ] 2.2 Logo et icônes
- [ ] 2.3 En-tête, pied de page, navigation
- [ ] 2.4 Accueil
- [ ] 2.5 Catalogue, carte produit, fiche produit
- [ ] 2.6 Panier, commande, compte, pages d'aide
- [ ] 2.7 Critique sur captures (4 largeurs, 3 langues)

### Phase 3 — Commerce malgache
- [ ] 3.1 Ariary et nouveau catalogue de démonstration
- [ ] 3.2 Adresses et zones de livraison
- [ ] 3.3 Paiement Mobile Money et à la livraison
- [ ] 3.4 Renommage complet

### Phase 4 — Personnalisation en direct et en 3D
- [ ] 4.1 Modèle de données
- [ ] 4.2 Dessin de la surface imprimée
- [ ] 4.3 Envoi d'image par le client
- [ ] 4.4 Gabarits 3D
- [ ] 4.5 Interface de personnalisation
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
- [ ] 4. Changement de langue en cours de commande
- [ ] 5. Traduction de produit manquante : repli sur le français
- [ ] 6. Gros montants en ariary à 320 px
- [ ] 7. Mobile Money déclaré mais non reçu

## Journal

### 13/11/2026
- Première version construite et testée.
- Retour du propriétaire : design générique, skills non utilisés. Installation de six skills après lecture de leur contenu.
- Nouvelles demandes : nom Alarobia, produits malgaches du quotidien, personnalisation 3D, trois langues, plan suivi.
- Recherche de photos via l'interface non officielle d'Unsplash bloquée par l'environnement : on réutilise les photos existantes.
- Plan rédigé avec le skill `writing-plans`. Aucun code de la refonte écrit.
