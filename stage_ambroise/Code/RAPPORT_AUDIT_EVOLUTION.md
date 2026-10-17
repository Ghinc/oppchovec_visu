# Audit des écarts aberrants de l'onglet Évolution (2016 → 2021)

Rapport du 17 octobre 2026. Objet : vérifier les données de la série temporelle, en particulier les communes dont l'évolution est très forte (grand écart entre 2016 et 2021), et dire si ce sont des erreurs ou autre chose.

## En bref

- **Aucune erreur de lecture ou de calcul n'a été trouvée.** Les plus gros écarts viennent de la **taille des effectifs** : dans une commune de 20 à 60 habitants, quelques personnes de plus ou de moins déplacent beaucoup un indicateur.
- **Un indicateur cause à lui seul l'essentiel du bruit de la dimension Opp : le drapeau « transports en commun » d'Opp3.** Il vaut ±100 points et repose, pour la plupart des petites communes, sur **une seule personne**. Il change de statut pour 78 communes sur 360.
- J'ai ajouté dans l'appli : des classements limités aux communes d'au moins 100 habitants, une option pour **griser** les communes de moins de 100 habitants, un **avertissement** dans la fiche, l'**effectif brut** du drapeau d'Opp3, et une **variante « Opp3 robuste »** à cocher. Les définitions par défaut ne sont pas modifiées.

## Ce qui a été vérifié et qui est correct

| Contrôle | Résultat |
|---|---|
| Population des tables INSEE utilisées (POP1B) comparée à la population municipale officielle (séries historiques INSEE) | identique pour les **360 communes**, aux deux dates : pas d'erreur de géographie ni de table |
| Vec1 (médiane du niveau de vie) des 4 plus fortes variations (Lama, Cagnano, Casalabriva, Manso) comparé aux fichiers sources bruts | valeurs identiques à la source (MED16 du fichier Filosofi 2016, `valeur` du fichier data.gouv 2021) |
| Plages des 7 indicateurs aux deux dates | plausibles, aucune valeur impossible (personnes par pièce de 0,27 à 0,74, parts comprises entre 0 et 1, Cho2 entre 77 et 100) |
| Les 360 communes dans les deux années, mêmes codes | oui (une seule commune absente du fichier Filosofi 2016 : 2B015, déjà traitée par la valeur départementale) |
| Recalcul indépendant des scores, des p_k de Betti et des seuils de Jenks depuis les indicateurs bruts | identique au fichier (tests automatiques) |

## Ce qui produit les écarts aberrants

### 1. Le drapeau « transports en commun » d'Opp3 (cause principale)

Opp3 = part de ménages avec voiture + **100 si des actifs occupés vont travailler en transports en commun** + 100 pour les trois villes à réseau de bus. Le « si » est un drapeau tout ou rien, levé dès qu'il y a **au moins une personne** (définition de l'appli).

- Cet effectif est une estimation du recensement. Dans les petites communes il vaut en général 0 ou environ 1 : pour les 78 communes dont le drapeau change entre 2016 et 2021, **l'effectif du côté « levé » a une médiane de 1,1 personne et un maximum de 6,7**.
- Le drapeau change pour **78 communes sur 360** (36 passent de non à oui, 42 de oui à non). Chaque changement vaut ±100 points d'Opp3, soit ±0,41 sur l'échelle 0-1.
- **99 % de la variance de la variation d'Opp3 vient de ce drapeau**, 1 % de la part de ménages avec voiture. Écart-type de la variation d'Opp : 1,71 point sur 10.

Nombre de communes dont le drapeau change selon le seuil d'effectif :

| Drapeau levé si l'effectif est ≥ | Communes levées en 2016 | en 2021 | Changent de statut |
|---|---|---|---|
| au moins une personne (appli) | 174 | 168 | **78** |
| 1 | 151 | 135 | 92 |
| 2 | 103 | 92 | 59 |
| 3 | 82 | 74 | 32 |
| **5 (variante robuste)** | 51 | 54 | **27** |
| 10 | 26 | 26 | 4 |

Avec le seuil de 5, l'écart-type de la variation d'Opp passe de 1,71 à 1,29 et les indices 2021 des deux versions ont une corrélation de 0,95. **L'Opp3 de l'appli (hors série temporelle) a la même fragilité** : une commune qui a une seule personne qui prend le bus reçoit +100.

### 2. Les très petites communes

Écart-type de la variation de l'indice OppChoVec selon la population (2021), en points sur 10 :

| Habitants | Communes | Écart-type | Part des variations > 1,5 point |
|---|---|---|---|
| moins de 50 | 46 | 1,79 | 30 % |
| 50 à 99 | 75 | 1,44 | 35 % |
| 100 à 199 | 88 | 1,15 | 18 % |
| 200 à 499 | 53 | 1,04 | 15 % |
| 500 à 999 | 42 | 0,96 | 10 % |
| 1 000 et plus | 56 | 0,58 | 5 % |

Les plus fortes variations de l'indice sont toutes dans des communes de 19 à 60 habitants : Piazzali (19 hab., −3,7), Stazzona (34, −3,7), Zévaco (51, −3,6), Vallica (28, −3,5), Porri (44, +4,0), Mazzola (25, +3,9). Exemple, Piazzali : le niveau de diplôme moyen passe de 2,00 à 2,89 (19 personnes), la part de Français de 98,2 % à 82,6 % (17 puis 19 habitants), la stabilité de l'emploi est calculée sur **7 actifs**.

### 3. Cho2 (droit de vote, proxy) : une approximation fragile dans les petites communes

Cho2 estime les étrangers de 18 ans et plus par (population de 18 à 24 ans − 0,7 × Français de 15 à 24 ans) + étrangers de 25 ans et plus. Dans les petites communes cette soustraction donne parfois un résultat **négatif** : 39 communes en 2016 et 35 en 2021 ; **46 et 47 communes sont plafonnées à 100 %**. Exemple, Muracciole : 2,0 étrangers estimés (Cho2 94,2) en 2016, 7,6 en 2021 (Cho2 77,6), pour 34 habitants.

### 4. Vec1 (niveau de vie)

- **148 communes ont la valeur de leur département aux deux dates** (l'INSEE ne diffuse pas la médiane pour les petites communes) : leur « évolution » est celle du département (+0,18 sur l'échelle 0-1, même valeur pour toutes). Ce n'est pas une erreur mais l'information ne dit rien d'elles.
- Les 200 communes avec médiane propre aux deux dates : hausse médiane de **+14,5 %** en euros courants (de −5,4 % à +43,6 %). Cette hausse est supérieure à l'inflation sur la période (non corrigée ici) : une partie peut venir d'un changement de méthode de la source entre 2016 et 2021, **non vérifié**.

## Ce que j'ai changé dans l'appli

1. **Classements** « plus fortes progressions / reculs » (menu « Résumé chiffré ») : limités aux communes d'**au moins 100 habitants**. Avant, ils étaient dominés par des communes de 19 à 60 habitants. Les moyennes et les effectifs portent toujours sur les 360 communes.
2. Case **« Griser les communes de moins de 100 habitants »** (121 communes) sur les trois cartes.
3. **Avertissement** dans la fiche d'une commune de moins de 100 habitants, et mention « évolution peu fiable » dans l'infobulle.
4. **Détail d'Opp3** : effectif brut estimé d'actifs en transports en commun aux deux dates, critère du drapeau, et mention « très fragile » quand l'effectif est inférieur à 5.
5. Case **« Opp3 robuste (≥ 5 actifs en transports en commun) »** : charge `serie_temporelle_robuste.json`, produit par `construire_serie_temporelle.py` avec le même calcul (scores, p_k, classes de Jenks recalculés). La série par défaut est **strictement inchangée**.

## Décisions à prendre

- Faut-il retenir la variante « robuste » comme série par défaut de l'onglet Évolution ? C'est un changement de définition d'Opp3 par rapport à l'appli.
- Faut-il corriger le même drapeau dans l'Opp3 de l'appli (indice hors série temporelle) ?
- Cho2 : garder l'approximation ou utiliser une définition moins sensible pour les petites communes (par exemple ne pas soustraire 0,7 × Français de 15 à 24 ans quand les effectifs sont inférieurs à 10) ?
- Vec1 : corriger de l'inflation (indice des prix de l'INSEE à vérifier) et vérifier la comparabilité de Filosofi 2016 et 2021.

## Fichiers

`Code/Python/construire_serie_temporelle.py` (paramètre `seuil_transports`), `Code/WEB/serie_temporelle.json` (inchangée hors nouveaux champs), `Code/WEB/serie_temporelle_robuste.json`, `Code/WEB/evolution.js`, tests `test_12_serie_temporelle.py`, `js/evolution.test.js`, `e2e/evolution.e2e.test.js`.
