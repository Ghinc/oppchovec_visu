# Pourquoi l'indice varie entre 2016 et 2021 : décomposition des variations

Rapport du 17 octobre 2026. Objet : savoir si l'indice comparable de l'onglet Évolution est **cohérent**, en expliquant d'où viennent ses variations. Rien n'est modifié dans l'indice : c'est une analyse de la série existante (7 indicateurs sur 10, 360 communes).

## En bref

- **La hausse moyenne de l'indice (5,10 → 5,59, soit +0,49) est surtout nominale.** Elle vient pour près de 70 % de Vec1 (niveau de vie en euros courants, +14 % entre 2016 et 2021, pour une inflation d'environ 6 %). La part d'Opp1 (niveau de diplôme) est plus faible, et les autres indicateurs se compensent.
- **Les écarts entre communes viennent presque entièrement d'un seul indicateur : Cho2** (part de Français parmi les 18 ans et plus). Il explique **67 % de la variance** des variations de l'indice, alors que sa moyenne ne bouge pas (95,97 % → 95,85 %). Deux raisons : dans la série la dimension Cho n'est composée que de Cho2 (Cho1 est exclu), et l'indice y est 3,5 fois plus sensible qu'aux autres indicateurs.
- **Le deuxième facteur est le drapeau « transports en commun » d'Opp3** (18 % de la variance), qui repose sur une personne dans la plupart des petites communes.
- **La plupart des écarts spectaculaires sont du bruit de petits effectifs**, pas un changement réel : corrélation entre 2016 et 2021 de 0,97 pour les communes de 1 000 habitants et plus, de 0,53 sous 100 habitants.
- **Verdict de cohérence :** la série est cohérente pour les communes d'au moins 1 000 habitants et pour les EPCI. Pour les communes de moins de 100 habitants, une évolution individuelle ne dit presque rien. Aucune erreur de calcul n'a été trouvée (voir aussi `RAPPORT_AUDIT_EVOLUTION`).

## Méthode

Pour chaque commune, j'isole l'effet de chaque indicateur par un calcul « toutes choses égales par ailleurs » : je garde sa valeur de 2016, je laisse les autres indicateurs à leur valeur de 2021, je recalcule l'indice 2021 avec la même échelle, et la différence est l'effet de cet indicateur (en points d'indice sur 10). La somme des sept effets retrouve la variation de l'indice (écart moyen nul : l'indice n'est pas additif mais l'interaction est négligeable). La part de variance est la covariance entre l'effet d'un indicateur et la variation totale, divisée par la variance de la variation.

## 1. Pourquoi la moyenne monte de +0,49

| Dimension (0-10) | 2016 | 2021 | Variation |
|---|---|---|---|
| Opp (opportunités) | 4,60 | 4,94 | +0,34 |
| Cho (choix) | 8,24 | 8,18 | −0,06 |
| Vec (vécu) | 4,92 | 6,24 | **+1,32** |

| Indicateur | Moyenne 2016 → 2021 | Variation moyenne (échelle 0-1) | Communes en hausse / en baisse | Effet moyen sur l'indice |
|---|---|---|---|---|
| Vec1 niveau de vie (€) | 19 176 → 21 942 | +0,185 | 354 / 4 | **+0,34** |
| Opp1 niveau de diplôme (1-4) | 2,295 → 2,408 | +0,060 | 213 / 46 | **+0,17** |
| Vec3 stabilité de l'emploi | 0,834 → 0,858 | +0,037 | 186 / 64 | +0,07 |
| Vec2 logement | 0,788 → 0,793 | +0,012 | 122 / 87 | +0,02 |
| Opp3 mobilité | 136,27 → 136,25 | 0,000 | 88 / 60 | 0,00 |
| Cho2 part de Français 18+ | 95,97 → 95,85 | −0,006 | 105 / 116 | −0,05 |
| Opp2 diversité sociale (Theil) | 0,388 → 0,364 | −0,016 | 65 / 126 | −0,05 |

(« en hausse / en baisse » : variation de plus de 0,02 sur l'échelle 0-1.)

- **Vec1 monte dans 354 communes sur 360** : c'est une hausse générale en euros courants, pas corrigée de l'inflation. L'indice des prix de l'INSEE (moyenne annuelle) est de +1,0 % en 2017, +1,1 % en 2019, +0,5 % en 2020 et +1,6 % en 2021 ; je n'ai pas retrouvé le chiffre de 2018, que je situe de mémoire autour de +1,8 %, soit **environ +6 % sur la période**. La hausse de Vec1 (+14 %) est plus du double.
- **Sensibilité à l'inflation** (Vec1 2021 divisé par 1+x, le reste inchangé) :

| Hypothèse | Variation moyenne de l'indice | Variation moyenne de Vec | Communes en progression / en recul de plus de 0,5 point |
|---|---|---|---|
| Sans correction (série actuelle) | +0,49 | +1,32 | 162 / 58 |
| Inflation de 4 % | +0,39 | +1,00 | 147 / 66 |
| **Inflation de 6 %** | **+0,34** | **+0,85** | 137 / 67 |
| Inflation de 8 % | +0,29 | +0,71 | 129 / 69 |

  La hausse reste positive : même corrigée, Vec progresse, mais d'environ un tiers de moins. Le reste de l'écart entre +6 % et +14 % peut venir d'une vraie hausse des revenus ou d'un changement de méthode de la source (Filosofi 2016 contre 2021) : **je n'ai pas vérifié ce second point**.
- **Opp1** augmente dans 213 communes sur 259 qui bougent : le niveau de diplôme des 18 ans et plus monte, ce qui est attendu (les nouvelles générations sont plus diplômées).
- **Opp2, Cho2, Opp3** : leurs variations moyennes sont nulles ou très faibles. Les changements individuels sont de signes opposés et se compensent.

## 2. Pourquoi les communes diffèrent entre elles

Part de la variance de la variation de l'indice, par indicateur :

| Indicateur | Part de la variance | Écart-type de son effet (points d'indice) |
|---|---|---|
| **Cho2** | **67 %** | 1,01 |
| **Opp3** | **18 %** | 0,58 |
| Vec3 | 7 % | 0,25 |
| Opp1 | 5 % | 0,28 |
| Opp2 | 3 % | 0,24 |
| Vec2 | 3 % | 0,15 |
| Vec1 | 2 % | 0,13 |
| interaction | −6 % | |

### Pourquoi Cho2 pèse autant dans les écarts

Sa variation moyenne est nulle, mais il fait bouger l'indice d'une commune à l'autre bien plus que les autres :

- **Une dimension à un seul indicateur.** Les dimensions Opp et Vec moyennent trois indicateurs, ce qui amortit le bruit ; Cho, dans la série, n'a que Cho2 (Cho1, les quartiers prioritaires, n'a pas de source comparable pour 2016). Variation de 10 % de l'étendue d'un indicateur : **+0,97 point d'indice pour Cho2**, contre 0,28 pour un indicateur d'Opp et 0,18 pour un indicateur de Vec.
- **Un poids élevé (p_k = 0,338)** et une étendue étroite : Cho2 ne varie que de 77 à 100, donc **1 point de pourcentage de Cho2 déplace l'indice de 0,43 point**.
- **Un indicateur bruité dans les petites communes.** La part d'étrangers de 18 ans et plus est estimée par (population de 18 à 24 ans − 0,7 × Français de 15 à 24 ans) + étrangers de 25 ans et plus. Sur 20 à 100 habitants, quelques personnes suffisent : l'écart-type de la variation de Cho2 est de 3,6 points sous 100 habitants, 2,3 points de 100 à 999, 1,4 point à partir de 1 000. L'estimation est même négative pour 35 à 39 communes selon l'année (ramenée à 100 %).
- **Aucune tendance de fond :** 116 communes baissent et 105 montent ; la part d'étrangers de 18 ans et plus estimée pour toute la Corse est de 7,05 % en 2016 et de 7,02 % en 2021.

### Le drapeau « transports en commun » d'Opp3

Il vaut ±100 points d'Opp3 et change de statut pour 78 communes ; 42 communes le perdent (−1,23 point d'indice en moyenne) et 36 le gagnent (+1,20). Voir `RAPPORT_AUDIT_EVOLUTION` pour le détail et la variante « robuste ».

### Par taille de commune

| Habitants (2021) | Communes | Variation moyenne de l'indice | Écart-type | Corrélation 2016-2021 de l'indice | Part de variance de Cho2 |
|---|---|---|---|---|---|
| moins de 100 | 121 | +0,57 | 1,58 | 0,53 | 69 % |
| 100 à 999 | 183 | +0,42 | 1,07 | 0,79 | 65 % |
| 1 000 et plus | 56 | +0,58 | 0,58 | **0,97** | 68 % |

La variation moyenne est la même dans les trois classes (≈ +0,5), mais la dispersion est trois fois plus grande dans les plus petites : ce sont des variations de hasard autour de la même tendance. Corrélation 2016-2021 par indicateur (toutes communes) : Vec2 0,87, Vec1 0,86, Opp2 0,80, Cho2 0,79, Opp1 0,74, Opp3 0,61, **Vec3 0,33**.

## 3. Les plus grandes communes : une lecture plus fiable

| Commune | Habitants 2021 | Indice 2016 → 2021 | Variation | Ce qui l'explique (points d'indice) |
|---|---|---|---|---|
| Ajaccio | 73 822 | 4,57 → 5,58 | **+1,01** | Cho2 +0,34, Vec1 +0,30, Opp1 +0,27 |
| Bastia | 48 768 | 3,84 → 4,10 | +0,26 | Vec1 +0,21, Opp1 +0,19, **Cho2 −0,28** |
| Porto-Vecchio | 11 229 | 2,96 → 3,93 | **+0,97** | Vec1 +0,36, Opp1 +0,28, Cho2 +0,22 |
| Borgo | 9 678 | 4,27 → 4,63 | +0,36 | Vec1 +0,36, Opp1 +0,18, Cho2 −0,19, Vec2 −0,10 |
| Corte | 7 654 | 1,55 → 1,63 | +0,07 | Cho2 −0,22, Vec1 +0,15 |
| Biguglia | 7 654 | 5,57 → 5,91 | +0,33 | Vec1 +0,35 |
| Lucciana | 6 091 | 3,04 → 3,72 | +0,68 | Opp1 +0,35, Vec1 +0,26 |
| Furiani | 6 032 | 5,78 → 5,52 | −0,26 | **Cho2 −0,43**, Vec1 +0,26, Vec3 +0,12 |

Pour les communes de plus de 6 000 habitants, la hausse de Vec1 (+0,15 à +0,36) et d'Opp1 sont les moteurs, et Cho2 est le facteur qui fait la différence (positif à Ajaccio et à Porto-Vecchio, négatif à Bastia, Corte et Furiani).

## 4. Par EPCI (pro rata de la population de chaque année)

À l'échelle des EPCI, le bruit disparaît largement : **tous les EPCI ont Vec qui monte de +1,0 à +1,7** (la hausse nominale du niveau de vie), et ce sont Opp et Cho qui les distinguent.

| EPCI | Indice 2016 → 2021 | Variation | Opp | Cho | Vec |
|---|---|---|---|---|---|
| CC du Sartenais Valinco Taravo | 2,30 → 3,31 | +1,02 | +0,9 | +0,6 | +1,3 |
| CA du Pays Ajaccien | 4,92 → 5,85 | +0,93 | +0,6 | +0,3 | +1,4 |
| CC du Sud Corse | 3,14 → 4,01 | +0,87 | +0,4 | +0,4 | +1,7 |
| CC du Cap Corse | 5,67 → 6,37 | +0,70 | +0,5 | +0,1 | +1,3 |
| CC de la Castagniccia-Casinca | 3,47 → 4,01 | +0,54 | +0,2 | +0,1 | +1,4 |
| CC Nebbiu - Conca d'Oro | 4,94 → 5,43 | +0,49 | +0,7 | −0,1 | +1,3 |
| CC de l'Ile-Rousse - Balagne | 3,27 → 3,74 | +0,48 | +0,3 | 0,0 | +1,4 |
| CC de la Pieve de l'Ornano et du Taravo | 6,43 → 6,91 | +0,47 | +0,3 | −0,1 | +1,3 |
| CC de la Costa Verde | 3,35 → 3,83 | +0,47 | 0,0 | +0,1 | +1,5 |
| CC de Fium'Orbu Castellu | 2,71 → 3,12 | +0,41 | +0,5 | −0,2 | +1,5 |
| CC de Calvi Balagne | 1,68 → 2,09 | +0,41 | +0,2 | +0,1 | +1,5 |
| CC de Marana-Golo | 4,30 → 4,68 | +0,38 | +0,5 | −0,2 | +1,1 |
| CC Pasquale Paoli | 4,93 → 5,30 | +0,37 | 0,0 | +0,1 | +1,0 |
| CC Spelunca-Liamone | 4,63 → 4,97 | +0,35 | +0,7 | −0,3 | +1,3 |
| CC de l'Alta Rocca | 3,35 → 3,68 | +0,34 | +0,2 | −0,2 | +1,4 |
| CC Celavu-Prunelli | 6,52 → 6,80 | +0,29 | +0,4 | −0,4 | +1,6 |
| CA de Bastia | 4,38 → 4,61 | +0,22 | +0,5 | −0,3 | +1,2 |
| CC du Centre Corse | 1,98 → 2,14 | +0,15 | +0,5 | −0,5 | +1,3 |
| CC de l'Oriente | 1,66 → 1,73 | +0,07 | −0,5 | −0,2 | +1,4 |

Aucun EPCI ne recule. Dix EPCI sur 19 ont une dimension Cho en baisse, parfois assez nette (Centre Corse −0,5, Celavu-Prunelli −0,4).

## 5. Contrôles de cohérence

| Contrôle | Résultat |
|---|---|
| Les populations utilisées sont celles du recensement | égales à la population municipale officielle pour les 360 communes, aux deux dates |
| Aucune variation due à un changement de géographie | 360 communes aux mêmes codes ; une seule absente d'un fichier source (2B015, Filosofi 2016, remplacée par la valeur du département) |
| L'évolution de l'indice suit-elle la croissance démographique ? | non, et c'est normal : corrélation de −0,05 pour les 125 communes de 300 habitants et plus (population de la Corse : +5,2 %, 330 455 → 347 597) |
| Stabilité du classement des communes entre les deux dates | corrélation de l'indice 0,77 en général (0,97 pour les communes d'au moins 1 000 habitants) |
| Correspondance du Vec1 avec les sources | identique à la source pour les valeurs vérifiées (voir l'audit) |
| Recalcul indépendant des scores | identique au fichier (tests automatiques) |

## 6. Ce qui reste incertain

- **Corriger Vec1 de l'inflation** : mon chiffre de +6 % repose sur des moyennes annuelles de l'INSEE dont une (2018) n'est pas confirmée. La comparabilité de la méthode de Filosofi entre 2016 et 2021 n'est pas vérifiée.
- **Vec3** est l'indicateur le plus instable (corrélation 0,33 entre les deux dates) : estimations sur de petits effectifs d'actifs, et une définition de la stabilité de l'emploi qui mélange des statuts déclarés lors du recensement.
- **Opp1** n'a que 4 niveaux de diplôme en 2016 : la hausse est mesurée sur une échelle grossière et ne se compare pas à l'Opp1 de l'appli (7 niveaux).
- **Cho1 est absent** de la série : la dimension Cho de la série n'est pas celle de l'appli, ce qui amplifie le poids de Cho2.
- Les EPCI utilisent la population de chaque année : une commune qui grossit pèse plus en 2021 qu'en 2016.

## Fichiers

Calcul : `serie_temporelle.json` (série standard, inchangée). Rapports liés : `RAPPORT_AUDIT_EVOLUTION` (écarts aberrants), `RAPPORT_DONNEES_SERIE_TEMPORELLE` (sources 2016 et 2021 comparées aux données actuelles).
