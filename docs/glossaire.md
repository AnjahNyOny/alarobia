# Glossaire et relecture du malgache

Le malgache de `messages/mg.json` est rédigé par Claude. **Il doit être relu par un locuteur natif avant toute mise en ligne.** Ce fichier fixe le vocabulaire pour qu'il reste le même d'un écran à l'autre ; corrigez ici d'abord, puis dans `messages/mg.json`.

## Termes retenus

| Français | English | Malagasy | Remarque |
| --- | --- | --- | --- |
| panier | cart | harona | |
| produit, article | product, item | entana | |
| stock | stock | tahiry | « lany tahiry » : en rupture |
| code promo | promo code | kaody | |
| adresse | address | adiresy | |
| e-mail | email | mailaka | |
| mot de passe | password | teny miafina | |
| compte | account | kaonty | |
| se connecter | sign in | miditra | |
| favoris | favourites | ny tianko | confirmé |
| avis | review | hevitra | |
| note (étoiles) | rating | naoty | confirmé |
| livraison | delivery | fanaterana | |
| paiement | payment | fandoavam-bola | |
| commande | order | komandy | confirmé |
| champ (de formulaire) | field | saha | confirmé |
| quartier | neighbourhood | fokontany | à confirmer |
| province | province | faritany | à confirmer |
| ville | town | tanàna | à confirmer |
| repère (pour le livreur) | landmark | famantarana | à confirmer |
| zone de livraison | delivery zone | faritra fanaterana | à confirmer |
| jours ouvrés | working days | andro fiasana | à confirmer |
| au plus tard | at the latest | farafahatarany | à confirmer |
| facultatif | optional | tsy voatery | à confirmer |
| livreur | courier | mpanatitra | à confirmer |

Jours de la semaine (écrits dans `src/lib/format.ts`) : Alatsinainy, Talata, Alarobia, Alakamisy, Zoma, Sabotsy, Alahady.
Mois : Janoary, Febroary, Martsa, Aprily, Mey, Jona, Jolay, Aogositra, Septambra, Oktobra, Novambra, Desambra.

## État de la relecture

| Espace de noms | Contenu | Relu |
| --- | --- | --- |
| `errors` | messages d'erreur des formulaires et du panier | non |
| `notices` | confirmations (ajout au panier, profil enregistré…) | non |
| `common` | libellés partagés | non |
| `nav`, `footer` | en-tête, menu, pied de page | non |
| `home` | page d'accueil, frise de livraison | non |
| `card` | carte produit | non |
| `catalog` | catalogue : rayons, filtres, tri, pagination | non |
| `product` | fiche produit : stock, livraison par zone, avis | non |
| `payment` | choix du moyen de paiement, indications Mobile Money | non |
| `meta` | titre du site | non |
| `address` | champs de l'adresse (commande et espace client) | non |
| `delivery` | zones de livraison, délais, date promise | non |
| zones de démonstration (`prisma/catalog.mjs`) | noms des quatre zones de livraison | non |
| catalogue de démonstration (`prisma/catalog.mjs`) | noms, accroches et descriptions des 27 produits et des 6 rayons, bandeau d'annonce | non |
