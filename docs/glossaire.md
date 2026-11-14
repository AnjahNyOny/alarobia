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
| favoris | favourites | ny tianao | à confirmer |
| avis | review | hevitra | |
| note (étoiles) | rating | naoty | à confirmer |
| livraison | delivery | fanaterana | |
| paiement | payment | fandoavam-bola | |
| commande | order | baiko | à confirmer (« commande » est aussi courant) |
| champ (de formulaire) | field | saha | à confirmer |

Jours de la semaine (écrits dans `src/lib/format.ts`) : Alatsinainy, Talata, Alarobia, Alakamisy, Zoma, Sabotsy, Alahady.
Mois : Janoary, Febroary, Martsa, Aprily, Mey, Jona, Jolay, Aogositra, Septambra, Oktobra, Novambra, Desambra.

## État de la relecture

| Espace de noms | Contenu | Relu |
| --- | --- | --- |
| `errors` | messages d'erreur des formulaires et du panier | non |
| `notices` | confirmations (ajout au panier, profil enregistré…) | non |
| `common` | libellés partagés | non |
