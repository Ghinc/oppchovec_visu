# Pourquoi l'indice varie entre 2016 et 2021 : décomposition des variations

Rapport du 19 octobre 2026 (mis à jour pour la série à 10 indicateurs ; la version du 17 octobre portait sur 7 indicateurs). Objet : savoir si l'indice comparable de l'onglet Évolution est **cohérent**, en expliquant d'où viennent ses variations. Rien n'est modifié dans l'indice : c'est une analyse de la série existante (10 indicateurs, 360 communes).

## En bref

- **La hausse moyenne de l'indice (3,39 → 4,18, soit +0,78) vient aux deux tiers d'Opp4**, la connectivité : effet moyen +0,53 point d'indice sur +0,78. La 4G (couverture par au moins un opérateur : 74,5 % → 99,7 % en moyenne des communes), le débit de 30 Mbit/s (8,2 % → 31,3 %) et la fibre (0,2 % → 12,9 %) progressent partout. Opp1 (niveau de diplôme, +0,16) et Vec1 (revenu fiscal moyen, +0,09, en euros courants) suivent de loin.
- **Les écarts entre communes viennent de trois indicateurs :** Opp4 (40 % de la variance des variations), Cho2 (24 %) et le drapeau « transports en commun » d'Opp3 (23 %). Cho2 ne bouge pas en moyenne (95,97 → 95,85) mais fait beaucoup varier l'indice d'une commune à l'autre ; Opp3 repose sur une personne dans la plupart des petites communes.
- **Opp4 rebat les cartes du classement :** sa corrélation entre 2016 et 2021 n'est que de 0,26. Deux mouvements s'additionnent : la 4G rattrape dans les petites communes (sous 50 % dans 89 communes en 2017, aucune en 2021) et le débit comme la fibre progressent surtout dans les bourgs et les villes.
- **Le bruit des petits effectifs reste présent** : corrélation de l'indice entre 2016 et 2021 de 0,95 pour les communes de 1 000 habitants et plus, de 0,41 sous 100 habitants.
- **Verdict de cohérence :** la série est cohérente pour les communes d'au moins 1 000 habitants et pour les EPCI. Pour les communes de moins de 100 habitants, une évolution individuelle ne dit presque rien. Aucune erreur de calcul n'a été trouvée (voir aussi `RAPPORT_AUDIT_EVOLUTION`).

## Méthode

Pour chaque commune, j'isole l'effet de chaque indicateur par un calcul « toutes choses égales par ailleurs » : je garde sa valeur de 2016, je laisse les autres indicateurs à leur valeur de 2021, je recalcule l'indice 2021 avec la même échelle, et la différence est l'effet de cet indicateur (en points d'indice sur 10). L'indice n'est pas additif : la somme des dix effets s'écarte de la variation d'une « interaction » dont la moyenne est de −0,01 point. La part de variance est la covariance entre l'effet d'un indicateur et la variation totale, divisée par la variance de la variation.

## 1. Pourquoi la moyenne monte de +0,78

| Dimension (0-10) | 2016 | 2021 | Variation |
|---|---|---|---|
| Opp (opportunités) | 3,34 | 4,54 | **+1,19** |
| Cho (choix) | 8,67 | 8,63 | −0,04 |
| Vec (vécu) | 3,88 | 4,31 | +0,44 |

| Indicateur | Moyenne 2016 → 2021 | Variation moyenne (échelle 0-1) | Communes en hausse / en baisse | Effet moyen sur l'indice |
|---|---|---|---|---|
| Opp4 connectivité (4G, débit, fibre, %) | 27,7 → 48,0 | +0,203 | 235 / 26 | **+0,53** |
| Opp1 niveau de diplôme (1-4) | 2,295 → 2,408 | +0,060 | 213 / 46 | **+0,16** |
| Vec1 revenu fiscal moyen (€) | 20 029 → 22 817 | +0,047 | 266 / 23 | +0,09 |
| Vec3 stabilité de l'emploi | 0,821 → 0,842 | +0,033 | 183 / 72 | +0,06 |
| Opp2 diversité sociale (Theil) | 0,388 → 0,364 | −0,016 | 65 / 126 | −0,05 |
| Vec2 logement | 0,691 → 0,698 | +0,013 | 126 / 91 | +0,02 |
| Cho2 part de Français 18+ | 95,97 → 95,85 | −0,006 | 105 / 116 | −0,02 |
| Opp3 mobilité | 136,27 → 136,25 | 0,000 | 88 / 60 | 0,00 |
| Vec4 services à 20 min | 304 → 303 | 0,000 | 11 / 9 | 0,00 |
| Cho1 quartiers prioritaires (−log) | −0,07 → −0,07 | 0,000 | 1 / 0 | 0,00 |

(« en hausse / en baisse » : variation de plus de 0,02 sur l'échelle 0-1.)

- **Opp4 monte dans 235 communes sur 360.** C'est la moyenne de trois composantes (4G, débit, fibre) qui progressent toutes : 4G 74,5 → 99,7 %, débit ≥ 30 Mbit/s 8,2 → 31,3 %, fibre 0,2 → 12,9 %. Deux réserves : le débit change de producteur entre les deux dates (Agence du numérique puis ARCEP, base de locaux modifiée en 2020), et la 4G de 2016 s'appuie sur des cartes de mars 2017.
- **Vec1** (revenu fiscal moyen par foyer, euros courants) monte dans 266 communes sur 360 : une hausse générale, non corrigée de l'inflation (voir la sensibilité ci-dessous). Son effet moyen sur l'indice est modeste (+0,09) parce que l'échelle de Vec1 est très étendue (7 325 à 66 166 euros).
- **Sensibilité de l'indice à l'inflation** (Vec1 2021 divisé par 1+x, le reste inchangé) :

| Hypothèse | Variation moyenne de l'indice | Variation moyenne de Vec | Communes en progression / en recul de plus de 0,5 point |
|---|---|---|---|
| Sans correction (série actuelle) | +0,78 | +0,44 | 220 / 31 |
| Inflation de 4 % | +0,76 | +0,37 | 216 / 33 |
| **Inflation de 6 %** | +0,74 | +0,33 | 213 / 33 |
| Inflation de 8 % | +0,73 | +0,30 | 213 / 34 |

  Le chiffre de +6 % repose sur des moyennes annuelles de l'INSEE dont une (2018) n'est pas confirmée. Corriger l'inflation réduirait la hausse de Vec, mais d'un montant faible sur l'indice complet.
- **Opp1** augmente dans 213 communes : le niveau de diplôme des 18 ans et plus monte, ce qui est attendu (les nouvelles générations sont plus diplômées).
- **Opp2, Cho1, Cho2, Opp3, Vec4** : leurs variations moyennes sont nulles ou très faibles. Cho1 et Vec4 ne bougent presque pas (trois communes ont un quartier prioritaire, et les équipements à 20 minutes sont presque stables). Les changements individuels d'Opp2, Cho2 et Opp3 sont de signes opposés et se compensent.

## 2. Pourquoi les communes diffèrent entre elles

Part de la variance de la variation de l'indice, par indicateur :

| Indicateur | Part de la variance | Écart-type de son effet (points d'indice) |
|---|---|---|
| **Opp4** | **40 %** | 0,61 |
| **Cho2** | **24 %** | 0,46 |
| **Opp3** | **23 %** | 0,53 |
| Vec3 | 8 % | 0,24 |
| Opp1 | 6 % | 0,26 |
| Opp2 | 3 % | 0,21 |
| Vec2 | 2 % | 0,14 |
| Vec1 | 2 % | 0,13 |
| Cho1 | 0 % | 0,00 |
| Vec4 | 0 % | 0,02 |
| interaction | −8 % | |

### Opp4 : un progrès réel, très inégal entre communes

La connectivité progresse partout, mais pas par les mêmes composantes selon la taille de la commune (moyennes par classe de taille, en points de pourcentage) :

| Habitants (2021) | 4G 2016 → 2021 | Débit 30 Mbit/s 2016 → 2021 | Fibre 2016 → 2021 |
|---|---|---|---|
| moins de 100 | 58 → 100 | 0 → 23 | 0 → 4 |
| 100 à 999 | 78 → 100 | 9 → 29 | 0 → 8 |
| 1 000 et plus | 99 → 100 | 25 → 56 | 1 → 46 |

La 4G rattrape surtout dans les petites communes (déjà bien couverte dans les grandes), alors que le débit de 30 Mbit/s et la fibre progressent surtout là où le réseau filaire a été modernisé, c'est-à-dire dans les communes les plus peuplées. D'où une corrélation de seulement 0,26 entre les deux dates pour Opp4, et une forte part de variance. La variation de 10 % de l'étendue d'Opp4 déplace l'indice de 0,24 point.

### Pourquoi Cho2 pèse autant dans les écarts

Sa variation moyenne est nulle, mais il fait bouger l'indice d'une commune à l'autre bien plus que la plupart des autres :

- **Une dimension à deux indicateurs seulement.** Cho1 (quartiers prioritaires) ne change que pour 3 communes ; la dimension Cho est donc presque entièrement Cho2. Variation de 10 % de l'étendue d'un indicateur : **+0,40 point d'indice pour Cho2**, contre 0,24 pour un indicateur d'Opp et 0,18 pour un indicateur de Vec.
- **Un poids élevé et une étendue étroite :** Cho2 ne varie que de 77 à 100, donc **1 point de pourcentage de Cho2 déplace l'indice de 0,18 point**.
- **Un indicateur bruité dans les petites communes.** La part d'étrangers de 18 ans et plus est estimée par (population de 18 à 24 ans − 0,7 × Français de 15 à 24 ans) + étrangers de 25 ans et plus. Sur 20 à 100 habitants, quelques personnes suffisent : l'écart-type de la variation de Cho2 est de 3,6 points sous 100 habitants, 2,3 de 100 à 999, 1,4 à partir de 1 000. L'estimation est même négative pour 39 communes en 2016 et 35 en 2021 (ramenée à 100 %).
- **Aucune tendance de fond :** 105 communes montent et 116 baissent ; la part d'étrangers de 18 ans et plus estimée pour toute la Corse est de 7,05 % en 2016 et de 7,02 % en 2021.

### Le drapeau « transports en commun » d'Opp3

Il vaut ±100 points d'Opp3 et change de statut pour 78 communes ; 42 le perdent (−1,11 point d'indice en moyenne) et 36 le gagnent (+1,14). Voir `RAPPORT_AUDIT_EVOLUTION` pour le détail et la variante « robuste ».

### Par taille de commune

| Habitants (2021) | Communes | Variation moyenne de l'indice | Écart-type | Corrélation 2016-2021 de l'indice | Part de variance d'Opp4 | Part de variance de Cho2 |
|---|---|---|---|---|---|---|
| moins de 100 | 121 | +0,83 | 1,14 | 0,41 | 27 % | 34 % |
| 100 à 999 | 183 | +0,63 | 0,89 | 0,67 | 40 % | 20 % |
| 1 000 et plus | 56 | +1,20 | 0,81 | 0,95 | 81 % | 7 % |

La variation moyenne est la plus forte dans les communes de 1 000 habitants et plus (+1,20, surtout par Opp4), mais c'est là aussi que la dispersion est la plus faible (0,81 contre 1,14 sous 100 habitants) : dans les petites communes, les variations sont davantage de hasard autour de la tendance. Corrélation 2016-2021 par indicateur (toutes communes) : Cho1 1,00, Vec4 1,00, Vec2 0,89, Vec1 0,80, Opp2 0,80, Cho2 0,79, Opp1 0,74, Opp3 0,61, Vec3 0,33, Opp4 0,26.

## 3. Les plus grandes communes : une lecture plus fiable

| Commune | Habitants 2021 | Indice 2016 → 2021 | Variation | Ce qui l'explique (points d'indice) |
|---|---|---|---|---|
| Ajaccio | 73 822 | 3,46 → 4,81 | **+1,35** | Opp4 +0,75, Opp1 +0,27, Vec1 +0,13 |
| Bastia | 48 768 | 2,09 → 3,33 | **+1,24** | Opp4 +0,94, Opp1 +0,19, Vec1 +0,13 |
| Porto-Vecchio | 11 229 | 1,57 → 2,72 | **+1,14** | Opp4 +0,54, Opp1 +0,26, Vec1 +0,13 |
| Borgo | 9 678 | 4,78 → 6,47 | **+1,69** | Opp4 +1,49, Opp1 +0,22, Vec3 +0,15 |
| Corte | 7 654 | 2,07 → 3,15 | **+1,08** | Opp4 +1,02, Cho2 −0,17, Vec3 +0,09 |
| Biguglia | 7 654 | 6,09 → 8,05 | **+1,96** | Opp4 +1,93, Vec1 +0,09, Vec4 −0,05 |
| Lucciana | 6 091 | 3,91 → 5,45 | **+1,54** | Opp4 +0,98, Opp1 +0,45, Vec2 −0,10 |
| Furiani | 6 032 | 6,10 → 7,59 | **+1,48** | Opp4 +1,75, Cho2 −0,22, Vec3 +0,17 |

Pour les communes de plus de 6 000 habitants, les moteurs sont en général Opp1 (niveau de diplôme), Opp4 (connectivité, quand elle n'était pas déjà acquise en 2017) et Vec1 ; Cho2 fait la différence d'une ville à l'autre (voir les effets ci-dessus).

## 4. Par EPCI (pro rata de la population de chaque année)

À l'échelle des EPCI, le bruit disparaît largement : tous les EPCI progressent (19 sur 19 avec une variation positive).

| EPCI | Indice 2016 → 2021 | Variation | Opp | Cho | Vec |
|---|---|---|---|---|---|
| CC de Marana-Golo | 4,83 → 6,47 | +1,64 | +2,4 | −0,1 | +0,2 |
| CC du Sartenais Valinco Taravo | 2,08 → 3,55 | +1,47 | +2,1 | +0,5 | +0,5 |
| CC Celavu-Prunelli | 5,56 → 6,99 | +1,43 | +1,9 | −0,3 | +0,7 |
| CA du Pays Ajaccien | 3,75 → 5,18 | +1,42 | +1,6 | +0,2 | +0,5 |
| CC de la Castagniccia-Casinca | 3,24 → 4,60 | +1,36 | +1,9 | +0,1 | +0,5 |
| CA de Bastia | 2,75 → 4,10 | +1,35 | +2,1 | −0,4 | +0,4 |
| CC de la Costa Verde | 2,90 → 4,19 | +1,28 | +1,9 | +0,1 | +0,5 |
| CC de l'Ile-Rousse - Balagne | 3,04 → 4,27 | +1,23 | +1,9 | 0,0 | +0,4 |
| CC de la Pieve de l'Ornano et du Taravo | 4,72 → 5,86 | +1,14 | +1,7 | −0,1 | +0,3 |
| CC du Sud Corse | 2,10 → 3,16 | +1,05 | +1,1 | +0,6 | +0,6 |
| CC du Centre Corse | 2,23 → 3,17 | +0,94 | +1,7 | −0,4 | +0,5 |
| CC Spelunca-Liamone | 3,26 → 3,71 | +0,45 | +0,8 | −0,2 | +0,5 |
| CC de l'Alta Rocca | 2,95 → 3,36 | +0,41 | +0,3 | −0,1 | +0,8 |
| CC du Cap Corse | 4,20 → 4,58 | +0,38 | +0,3 | 0,0 | +0,4 |
| CC de Fium'Orbu Castellu | 2,56 → 2,94 | +0,38 | +0,5 | −0,1 | +0,6 |
| CC Nebbiu - Conca d'Oro | 3,76 → 4,14 | +0,38 | +0,4 | −0,1 | +0,6 |
| CC Pasquale Paoli | 3,40 → 3,75 | +0,35 | +0,4 | 0,0 | +0,3 |
| CC de Calvi Balagne | 2,05 → 2,27 | +0,22 | +0,1 | +0,1 | +0,5 |
| CC de l'Oriente | 1,78 → 1,83 | +0,05 | −0,1 | −0,1 | +0,4 |

10 EPCI sur 19 ont une dimension Cho en baisse. Les différences d'Opp entre EPCI reflètent le rattrapage en connectivité.

## 5. Contrôles de cohérence

| Contrôle | Résultat |
|---|---|
| Les populations utilisées sont celles du recensement | égales à la population municipale officielle pour les 360 communes, aux deux dates (test automatique) |
| Aucune variation due à un changement de géographie | 360 communes aux mêmes codes dans tous les fichiers ; Vec1 provient de l'IRCOM (11 communes sous secret statistique en 2016, 12 en 2021, valeur du département) |
| L'évolution de l'indice suit-elle la croissance démographique ? | non, et c'est normal : corrélation de 0,17 pour les 125 communes de 300 habitants et plus (population de la Corse : +5,2 %) |
| Stabilité du classement des communes entre les deux dates | corrélation de l'indice 0,74 en général (0,95 pour les communes d'au moins 1 000 habitants) |
| Recalcul indépendant des scores | identique au fichier (tests automatiques : p_k de Betti, échelle 0-10, seuils de Jenks) |
| Cohérence de Vec1, Opp4, Cho1 et Vec4 avec leurs fichiers sources | tests automatiques sur chaque composante |

## 6. Ce qui reste incertain

- **Opp4** : la 4G de 2016 vient de cartes de mars 2017, le débit et la fibre changent de producteur (rupture de la base de locaux en 2020) ; la 4G de l'appli (`Opp4.xlsx`) est introuvable et n'est reproduite par aucune carte ARCEP, donc on ne la reprend pas. Détail dans `RAPPORT_SOURCES_2016_2021_PAR_INDICATEUR`.
- **Corriger Vec1 de l'inflation** : mon chiffre de +6 % repose sur des moyennes annuelles de l'INSEE dont une (2018) n'est pas confirmée.
- **Vec3** est l'un des indicateurs les plus instables (corrélation 0,33 entre les deux dates) : estimations sur de petits effectifs d'actifs, et une définition de la stabilité de l'emploi qui mélange des statuts déclarés lors du recensement.
- **Opp1** n'a que 4 niveaux de diplôme en 2016 : la hausse est mesurée sur une échelle grossière et ne se compare pas à l'Opp1 de l'appli (7 niveaux).
- **Cho1** est calculé sur la géographie des quartiers prioritaires de 2015 aux deux dates, avec des populations de 2013 et 2018 : il ne se compare pas au Cho1 de l'appli (géographie 2024).
- Les EPCI utilisent la population de chaque année : une commune qui grossit pèse plus en 2021 qu'en 2016.

## Fichiers

Calcul : `serie_temporelle.json` (série standard). Rapports liés : `RAPPORT_AUDIT_EVOLUTION` (écarts aberrants), `RAPPORT_DONNEES_SERIE_TEMPORELLE` (sources 2016 et 2021 comparées aux données actuelles), `RAPPORT_SOURCES_2016_2021_PAR_INDICATEUR` (sources et différences variable par variable).
