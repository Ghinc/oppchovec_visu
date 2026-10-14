# Rapport : données téléchargées pour la série temporelle, et comparaison avec celles de la version « actuelle »

Date : 2026-10-14. Rédigé pour la doctorante qui pilote le projet (pas pour des décideurs). Les chiffres viennent de calculs refaits dans la session
(`construire_serie_temporelle.py`, scripts de recoupement) ; les tests du dépôt (`test_12_serie_temporelle.py`) vérifient les scores de la série, pas les fichiers sources.

## 1. Ce qui a été téléchargé

Tout vient de sites officiels (INSEE, DGFiP via data.gouv.fr). Les fichiers sont dans un dossier **temporaire de la session** (`…\scratchpad\serie`, `rp2016`, `rp2021`, `nat*`, `ircom*`),
pas dans le dépôt : à copier ailleurs si on veut les garder (environ 1 Go décompressés, 400 Mo compressés).

| Fichier | Millésime | Source (page INSEE / jeu data.gouv) | Contenu utile | Poids (CSV décompressé) |
|---|---|---|---|---|
| base-cc-evol-struct-pop | 2016 et 2021 | INSEE 4171334 / 8201904 | 15 ans et plus par catégorie socioprofessionnelle (8 postes) | 84 Mo / 139 Mo |
| base-cc-logement | 2016 et 2021 | INSEE 4171415 / 8202349 | résidences principales : pièces, personnes, salle de bain, chauffage, maisons, ménages avec voiture | 62 Mo / 99 Mo |
| base-cc-carac-emploi (caract_emp) | 2016 et 2021 | INSEE 4171449 / 8200707 | emplois par statut (CDI, CDD, intérim, aidés, apprentis, non-salariés), transports en commun | 48 Mo / 75 Mo |
| base-cc-emploi-pop-active | 2016 et 2021 | INSEE 4171446 / 8202916 | chômeurs et actifs de 15 à 64 ans | 158 Mo (2021) |
| base-cc-diplomes-formation | 2016 et 2021 | INSEE 4171395 / 8202319 | non scolarisés de 15 ans et plus par diplôme ; 15-17 ans et scolarisés | 55 Mo / 90 Mo |
| TD_NAT1 (nationalité) | 2016 et 2021 | INSEE 4171501 / 8202752 | population par âge (4 classes), sexe, nationalité (français / étranger) | 22 Mo / 20 Mo |
| IRCOM (impôt sur le revenu par commune) | revenus 2016 et 2021 | DGFiP, data.gouv.fr | foyers fiscaux et revenu fiscal de référence, ligne « Total » par commune | 8 Mo / 9 Mo |

Ces bases sont communales (France hors Mayotte) ; les 360 communes corses y figurent toutes, sans fusion ni changement de code entre 2016 et 2021.
Déjà présents sur le disque avant la session, et utilisés pour la comparaison : `Opp1`, `Opp2`, `Opp3`, `Vec1`, `Vec3`, `Cho2_francais_18plus`, `vec2_lb.csv`, `Cho1_personnes`,
`data_scores_0_10.json`, la base diplômes IRIS 2020 (Téléchargements).

## 2. Comparaison avec les données de la version actuelle

« Actuel » = le contenu de `data_scores_0_10.json` (indicateurs bruts). « Recalculé 2021 » = le même indicateur refait par `construire_serie_temporelle.py` depuis les bases ci-dessus.
Corrélations de Pearson et de rang sur les 360 communes ; écart moyen absolu après remise de chaque série sur 0-1 (min-max).

| Indicateur | Source actuelle (millésime) | Source de la série | Moyenne actuel / recalculé 2021 / 2016 | Écart moyen (0-1) | Pearson | Rang |
|---|---|---|---|---|---|---|
| Opp1 éducation | INSEE diplômes IRIS **2020**, 7 niveaux, 18 ans et plus | diplômes commune 2016 et 2021, **4 niveaux** (le détail à 7 niveaux n'existe pas en 2016) | 3,40 (sur 7) / 2,41 (sur 4) / 2,30 | 0,041 | 0,91 | 0,91 |
| Opp2 diversité sociale | INSEE statistiques locales, CSP 2021, effectifs entiers | base-cc CSP, effectifs non arrondis | 0,338 / 0,364 / 0,388 | 0,038 | 0,92 | 0,95 |
| Opp3 mobilité | voiture 2021 (INSEE) + accès transports en commun (0/100) + 100 pour 3 villes | base-cc logement et emploi | 135,7 / 136,3 / 136,3 | 0,003 | 0,99 | 0,99 |
| Cho2 droit de vote | Français 18 ans et plus, **2022** (TD_NAT1 + TD_POP1B, règle 15-24 × 7/10) | Français parmi les 15 ans et plus, NAT1 | 95,7 / 95,2 / 95,3 | 0,066 | 0,85 | 0,83 |
| Vec1 revenu | médiane du niveau de vie Filosofi 2021, **valeur départementale pour 154 communes** | revenu fiscal moyen par foyer (IRCOM) | 21 942 € / 22 817 € / 20 029 € | 0,209 | 0,45 | 0,35 |
| Vec2 logement | RP **2022** microdonnées (parquet), personnes par pièce moyennées par logement | base-cc logement, rapport des sommes | 0,791 / 0,793 / 0,788 | 0,026 | 0,96 | 0,94 |
| Vec3 emploi | RP 2021 (statistiques locales), effectifs entiers | base-cc emploi et population active | 0,858 / 0,858 / 0,834 | 0,003 | 0,999 | 0,998 |

### Détail par indicateur

- **Opp3, Vec3, Opp2 (RP 2021)** : ce sont les mêmes données du recensement. Les écarts viennent seulement des arrondis (statistiques locales arrondies à l'entier) et, pour Opp3, de deux communes où le test
  « des actifs vont travailler en transports en commun » diffère : Aléria et Poggio-Mezzana n'ont pas le +100 dans le fichier actuel mais l'ont dans le recensement (168 communes à 100 contre 166 ; écart de 100 points sur Opp3 pour ces deux communes, 0,05 au plus pour les 358 autres). Pour Vec3, les effectifs retombent à l'unité près (Afa : 119 chômeurs, 4 emplois aidés, 21 ponctuels, 98 CDD, 1 472 stables, 1 714 actifs).
  Pour Opp2, 196 communes sont à moins de 0,005 du fichier actuel, mais 55 s'en écartent de plus de 0,05 et le maximum est de 0,65 (Érone, justement la commune la plus basse de l'indice actuel ; puis Aiti, Tarrano, Piazzali) : ce sont des communes de quelques dizaines d'habitants où l'arrondi à l'entier des effectifs par catégorie (fichier actuel) change fortement l'indice de Theil.
- **Opp1** : la définition diffère par le nombre de niveaux (4 contre 7) et le millésime (2021 contre 2020). La corrélation reste de 0,91.
  Au passage, rappel : l'ancien `Opp1.xlsx` était un compteur sans rapport avec l'éducation (corrélation de 0,01 avec le niveau de diplôme INSEE) ; il a été remplacé le 2026-10-13 (voir `VERIFICATION_COHERENCE_DONNEES.md`).
- **Cho2** : l'indicateur actuel combine deux tables de 2022 et une règle de proportionnalité (Français 15-24 ans × 7/10) pour approcher les 18 ans et plus. La série utilise les 15 ans et plus,
  directement dans NAT1, aux deux dates. Même ordre de grandeur (95 %), corrélation 0,85.
- **Vec1** : trois remarques. (1) La médiane Filosofi actuelle n'est pas diffusée pour 154 communes sur 360 (108 en Haute-Corse, 46 en Corse-du-Sud) : elles ont reçu 21 460 € et 23 420 €, la valeur de leur département.
  (2) L'IRCOM a une ligne pour chacune des 360 communes, mais 11 communes (2016) et 12 (2021) sont « non communiquées » (secret statistique) : elles reçoivent la moyenne de leur département.
  (3) Le revenu fiscal moyen par foyer n'est pas la médiane du niveau de vie : moyenne et non médiane, par foyer fiscal et non par unité de consommation, foyers non imposés inclus.
  Sur les 206 communes où la médiane existe, la corrélation de rang avec le revenu fiscal moyen est de 0,67 ; sur les 360, de 0,35.
- **Vec2** : les personnes par pièce sont calculées différemment (moyenne des logements pour l'actuel, rapport des sommes pour la série) : corrélation 0,92 pour cette composante, 0,97 pour la part de maisons.
  La salle de bain est peu comparable (corrélation 0,38 : mêmes noms de variable mais origine différente, fichier détail 2022 pour l'actuel et comptage communal pour la série ; je n'ai pas pu reconstituer la règle exacte de l'actuel) mais sa part dans Vec2 est faible. Le chauffage vaut 1 partout dans
  les deux (constant, comme déjà signalé dans le dépôt).

## 3. Ce que ces données ne permettent pas

| Indicateur exclu de la série | Pourquoi |
|---|---|
| Opp4 (4G, haut débit, fibre) | pas de fichier communal homogène pour 2016 trouvé (l'ARCEP publie des taux de couverture trimestriels, mais je n'ai pas pu obtenir la série communale 2016 ; rupture de base de locaux en 2020 pour la fibre) |
| Cho1 (population en quartiers prioritaires) | deux géographies seulement : 2015 (5 QPV dont les Jardins de l'Empereur) et 2024 (Nord rocade en plus, Jardins de l'Empereur en moins) ; pas de série annuelle |
| Vec4 (services à moins de 20 minutes) | calculé avec le réseau routier actuel (serveur d'itinéraires local) sur la BPE 2024 ; la BPE 2016 existe mais sans le même traitement ; l'INSEE signale des changements de nomenclature |

## 4. Limites à garder en tête

- **Recouvrement du recensement.** Un millésime regroupe cinq années d'enquête ; 2016 (enquêtes 2014-2018) et 2021 (2019-2023) ne se recouvrent pas, mais deux millésimes consécutifs se recouvriraient (d'où le choix de 5 ans d'écart).
- **Petites communes.** 146 communes ont moins de 100 personnes de 15 ans et plus non scolarisées ; pour la série, la corrélation entre 2016 et 2021 est de 0,33 pour Vec3, 0,61 pour Opp3, 0,74 pour Opp1 : une partie de l'« évolution » est du bruit.
- **Questionnaire 2018.** L'INSEE signale un changement de questionnaire en 2018 (repérage de la multi-résidence) qui touche la mesure de la population : prudence sur les évolutions de population-dépendantes.
- **Géographie.** Les données 2016 sont diffusées avec les communes au 1er janvier 2019 (diplômes IRIS 2016 : 2018) ; aucune commune corse n'a changé, vérifié par la correspondance des 360 codes.
- **Corrections INSEE.** Plusieurs fichiers 2021 ont été republiés en décembre 2025 (poids des communes passant le seuil de 10 000 habitants, tableaux détaillés) : sans effet sur les petites communes corses, mais à re-télécharger si on veut la dernière version.

## 5. Pour refaire le calcul

`python construire_serie_temporelle.py "<dossier>"` avec un dossier contenant `2016/` et `2021/` (fichiers sous leurs noms d'origine) ; la liste exacte est dans `WEB/README_FICHIERS.md`
et `VERIFICATION_COHERENCE_DONNEES.md` (section « Série temporelle »). Un test rejoue le calcul si la variable d'environnement `OPPCHOVEC_SERIE` désigne ce dossier.
