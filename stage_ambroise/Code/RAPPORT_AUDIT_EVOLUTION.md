# Audit des écarts aberrants de l'onglet Évolution (2016 → 2021)

Rapport du 19 octobre 2026 (mis à jour pour la série à 10 indicateurs ; la version du 17 octobre portait sur 7 indicateurs). Objet : vérifier les données de la série temporelle, en particulier les communes dont l'évolution est très forte (grand écart entre 2016 et 2021), et dire si ce sont des erreurs ou autre chose.

## En bref

- **Aucune erreur de lecture ou de calcul n'a été trouvée.** Les plus gros écarts viennent de la **taille des effectifs** (dans une commune de 20 à 60 habitants, quelques personnes de plus ou de moins déplacent beaucoup un indicateur) et, depuis l'ajout d'Opp4, d'une **vraie progression de la connectivité**, très inégale selon les communes.
- **Le drapeau « transports en commun » d'Opp3 est la principale source de bruit propre à la dimension Opp, avec la connectivité (Opp4), dont la progression est réelle mais très inégale entre communes.** Le drapeau vaut ±100 points et repose, pour la plupart des petites communes, sur **une seule personne**. Il change de statut pour 78 communes sur 360.
- Dans l'appli : des classements limités aux communes d'au moins 100 habitants, une option pour **griser** les communes de moins de 100 habitants, un **avertissement** dans la fiche, l'**effectif brut** du drapeau d'Opp3, et une **variante « Opp3 robuste »** à cocher. Les définitions par défaut ne sont pas modifiées.

## Ce qui a été vérifié et qui est correct

| Contrôle | Résultat |
|---|---|
| Population des tables INSEE utilisées (POP1B) comparée à la population municipale officielle (séries historiques INSEE) | identique pour les **360 communes**, aux deux dates : pas d'erreur de géographie ni de table (test automatique) |
| Vec1 (revenu fiscal moyen par foyer) | recalculé depuis les lignes « Total » des fichiers IRCOM 2016 et 2021 ; identique à la variante « revenu fiscal » de l'appli pour 2021 (test automatique) ; 11 communes en 2016 et 12 en 2021 sous secret statistique |
| Plages des 10 indicateurs aux deux dates | plausibles, aucune valeur impossible (personnes par pièce de 0,27 à 0,74, Cho2 de 77 à 100, composantes d'Opp4 comprises entre 0 et 100 : oui) |
| Les 360 communes dans les deux années, mêmes codes | oui, pour toutes les sources (recensement, IRCOM, BPE, ARCEP, grille INSEE) |
| Recalcul indépendant des scores, des p_k de Betti et des seuils de Jenks depuis les indicateurs bruts | identique au fichier (tests automatiques) |
| Opp4, Cho1 et Vec4 | chacun recalculé depuis son fichier source par un test automatique |

## Ce qui produit les écarts aberrants

### 1. Le drapeau « transports en commun » d'Opp3 (cause principale pour Opp3)

Opp3 = part de ménages avec voiture + **100 si des actifs occupés vont travailler en transports en commun** + 100 pour les trois villes à réseau de bus. Le « si » est un drapeau tout ou rien, levé dès qu'il y a **au moins une personne** (définition de l'appli).

- Cet effectif est une estimation du recensement. Dans les petites communes il vaut en général 0 ou environ 1 : pour les 78 communes dont le drapeau change entre 2016 et 2021, **l'effectif du côté « levé » a une médiane de 1,1 personne et un maximum de 6,7**.
- Le drapeau change pour **78 communes sur 360** (36 passent de non à oui, 42 de oui à non). Chaque changement vaut ±100 points d'Opp3, soit ±0,41 sur l'échelle 0-1.
- **99 % de la variance de la variation d'Opp3 vient de ce drapeau**, le reste de la part de ménages avec voiture. Écart-type de la variation de la dimension Opp : 1,45 point sur 10 (qui inclut aussi Opp4).

Nombre de communes dont le drapeau change selon le seuil d'effectif :

| Drapeau levé si l'effectif est ≥ | Communes levées en 2016 | en 2021 | Changent de statut |
|---|---|---|---|
| au moins une personne (appli) | 174 | 168 | 78 |
| 1 | 151 | 135 | 92 |
| 2 | 103 | 92 | 59 |
| 3 | 82 | 74 | 32 |
| **5 (variante robuste)** | 51 | 54 | **27** |
| 10 | 26 | 26 | 4 |

Avec le seuil de 5, l'écart-type de la variation de la dimension Opp passe de 1,45 à 1,20 et les indices 2021 des deux versions ont une corrélation de 0,93. **L'Opp3 de l'appli (hors série temporelle) a la même fragilité** : une commune qui a une seule personne qui prend le bus reçoit +100.

### 2. Les très petites communes

Écart-type de la variation de l'indice OppChoVec selon la population (2021), en points sur 10 :

| Habitants | Communes | Écart-type | Part des variations > 1,5 point |
|---|---|---|---|
| moins de 50 | 48 | 1,25 | 25 % |
| 50 à 99 | 73 | 1,08 | 27 % |
| 100 à 199 | 84 | 0,95 | 20 % |
| 200 à 499 | 59 | 0,78 | 8 % |
| 500 à 999 | 40 | 0,94 | 18 % |
| 1 000 et plus | 56 | 0,82 | 38 % |

**Depuis l'ajout d'Opp4, ce tableau n'est plus un pur indicateur de bruit :** la connectivité progresse réellement, surtout dans les communes de 1 000 habitants et plus (débit et fibre), si bien que la part de variations de plus de 1,5 point n'est plus décroissante avec la taille. Le bruit des petits effectifs et la progression réelle se mélangent ; la décomposition par indicateur est dans `RAPPORT_VARIATIONS_EVOLUTION`.

Les plus fortes variations de l'indice : Porri (43 hab., +4,9), Occhiatana (254 hab., +3,8), Altiani (53 hab., +3,5), Novella (79 hab., +3,4), Prato-di-Giovellina (48 hab., +3,2), Santa-Reparata-di-Moriani (57 hab., +3,2).
Exemple, Porri (43 habitants en 2021) : le niveau de diplôme moyen passe de 2,21 à 2,56, la part de Français de 98,6 % à 100,0 %, la stabilité de l'emploi est calculée sur **22 actifs** en 2021, et la couverture 4G de 100 % à 100 %.

### 3. Cho2 (droit de vote, proxy) : une approximation fragile dans les petites communes

Cho2 estime les étrangers de 18 ans et plus par (population de 18 à 24 ans − 0,7 × Français de 15 à 24 ans) + étrangers de 25 ans et plus. Dans les petites communes cette soustraction donne parfois un résultat **négatif** : 39 communes en 2016 et 35 en 2021 ; **46 et 47 communes sont plafonnées à 100 %**.

### 4. Vec1 (revenu fiscal moyen par foyer)

- **9 communes ont la valeur de leur département aux deux dates** et 5 une seule année (secret statistique de la DGFiP). Leur « évolution » est celle du département, ou un mélange : ce n'est pas une erreur, mais l'information ne dit rien d'elles. Avant le passage à l'IRCOM, 148 communes étaient dans ce cas avec la médiane Filosofi.
- Les 346 communes avec une valeur propre aux deux dates : hausse médiane de **+12,3 %** en euros courants (de −32,5 % à +107,8 %). Cette hausse est supérieure à l'inflation sur la période (non corrigée ici).

### 5. Opp4 (connectivité) : un progrès réel, avec deux changements de producteur

La hausse d'Opp4 est réelle (4G, débit, fibre), mais le débit et la fibre changent de producteur entre 2016 (Agence du numérique) et 2021 (ARCEP), avec une base de locaux modifiée en 2020 ; la 4G de 2016 vient de cartes de mars 2017. Voir `RAPPORT_SOURCES_2016_2021_PAR_INDICATEUR` et `RAPPORT_VARIATIONS_EVOLUTION`.

## Ce que j'ai changé dans l'appli

1. **Classements** « plus fortes progressions / reculs » (menu « Résumé chiffré ») : limités aux communes d'**au moins 100 habitants**. Avant, ils étaient dominés par des communes de 19 à 60 habitants. Les moyennes et les effectifs portent toujours sur les 360 communes.
2. Case **« Griser les communes de moins de 100 habitants »** (121 communes) sur les trois cartes.
3. **Avertissement** dans la fiche d'une commune de moins de 100 habitants, et mention « évolution peu fiable » dans l'infobulle.
4. **Détail d'Opp3** : effectif brut estimé d'actifs en transports en commun aux deux dates, critère du drapeau, et mention « très fragile » quand l'effectif est inférieur à 5.
5. Case **« Opp3 robuste (≥ 5 actifs en transports en commun) »** : charge `serie_temporelle_robuste.json`, produit par `construire_serie_temporelle.py` avec le même calcul (scores, p_k, classes de Jenks recalculés). La série par défaut est **strictement inchangée**.

## Décisions à prendre

- Faut-il retenir la variante « robuste » comme série par défaut de l'onglet Évolution ? C'est un changement de définition d'Opp3 par rapport à l'appli (décision actuelle : non, on ne change pas).
- Faut-il corriger le même drapeau dans l'Opp3 de l'appli (indice hors série temporelle) ?
- Cho2 : garder l'approximation ou utiliser une définition moins sensible pour les petites communes (par exemple ne pas soustraire 0,7 × Français de 15 à 24 ans quand les effectifs sont inférieurs à 10) ?
- Vec1 : corriger de l'inflation (indice des prix de l'INSEE à vérifier).

## Fichiers

`Code/Python/construire_serie_temporelle.py` (paramètre `seuil_transports`), `Code/WEB/serie_temporelle.json`, `Code/WEB/serie_temporelle_robuste.json`, `Code/WEB/evolution.js`, tests `test_12_serie_temporelle.py`, `js/evolution.test.js`, `e2e/evolution.e2e.test.js`.
