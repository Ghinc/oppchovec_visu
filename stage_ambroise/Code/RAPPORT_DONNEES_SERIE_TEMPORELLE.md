# Rapport : données téléchargées pour la série temporelle, et comparaison avec celles de la version « actuelle »

Date : 2026-10-14. Rédigé pour la doctorante qui pilote le projet (pas pour des décideurs). Les chiffres viennent de calculs refaits dans la session
(`construire_serie_temporelle.py`, scripts de recoupement) ; les tests du dépôt (`test_12_serie_temporelle.py`) vérifient les scores de la série et la cohérence de Vec1 et de Cho2 avec la version actuelle.
Version mise à jour le jour même : Vec1 est maintenant la **médiane du niveau de vie** aux deux dates et Cho2 porte sur les **18 ans et plus**.

## 1. Ce qui a été téléchargé

Tout vient de sites officiels (INSEE, data.gouv.fr). Les fichiers sont dans un dossier **temporaire de la session** (`…\scratchpad\serie`, `rp2016`, `rp2021`, `nat*`, `pop*`, `filo16`, `nv`, `ircom*`),
pas dans le dépôt : à copier ailleurs si on veut les garder (environ 1,5 Go décompressés, 500 Mo compressés).

| Fichier | Millésime | Source (page INSEE / jeu data.gouv) | Contenu utile | Poids (décompressé) |
|---|---|---|---|---|
| base-cc-evol-struct-pop | 2016 et 2021 | INSEE 4171334 / 8201904 | 15 ans et plus par catégorie socioprofessionnelle (8 postes) | 84 Mo / 139 Mo |
| base-cc-logement | 2016 et 2021 | INSEE 4171415 / 8202349 | résidences principales : pièces, personnes, salle de bain, chauffage, maisons, ménages avec voiture | 62 Mo / 99 Mo |
| base-cc-carac-emploi (caract_emp) | 2016 et 2021 | INSEE 4171449 / 8200707 | emplois par statut (CDI, CDD, intérim, aidés, apprentis, non-salariés), transports en commun | 48 Mo / 75 Mo |
| base-cc-emploi-pop-active | 2016 et 2021 | INSEE 4171446 / 8202916 | chômeurs et actifs de 15 à 64 ans | 90 Mo / 158 Mo |
| base-cc-diplomes-formation | 2016 et 2021 | INSEE 4171395 / 8202319 | non scolarisés de 15 ans et plus par diplôme ; 15-17 ans et scolarisés | 55 Mo / 90 Mo |
| TD_NAT1 (nationalité) | 2016 et 2021 | INSEE 4171501 / 8202752 | population par âge (4 classes), sexe, nationalité (français / étranger) | 22 Mo / 20 Mo |
| **TD_POP1B (population par âge)** | 2016 et 2021 | INSEE 4171341 / 8202264 | population par sexe et année d'âge (sert à isoler les 18 ans et plus pour Cho2) | 268 Mo / 239 Mo |
| **Filosofi, médiane du niveau de vie** | 2016 ; 2021 | INSEE 4190004 (fichier `base-cc-filosofi-2016.xls`) ; data.gouv.fr « Niveau de vie médian » (communes et départements) | médiane par commune et par département, valeurs vides quand elle n'est pas diffusée | 11 Mo ; 1 Mo |
| IRCOM (impôt sur le revenu par commune) | revenus 2016 et 2021 | DGFiP, data.gouv.fr | revenu fiscal de référence et foyers fiscaux, ligne « Total » par commune ; **n'est plus utilisé par la série** (reste utilisé par la variante Vec1 de l'appli) | 8 Mo / 9 Mo |

Ces bases sont communales (France hors Mayotte) ; les 360 communes corses y figurent toutes, sans fusion ni changement de code entre 2016 et 2021, sauf **une** : la commune 2B015 est absente du fichier Filosofi 2016.
Déjà présents sur le disque avant la session, et utilisés pour la comparaison : `Opp1`, `Opp2`, `Opp3`, `Vec1`, `Vec3`, `Cho2_francais_18plus`, `vec2_lb.csv`, `Cho1_personnes`,
`data_scores_0_10.json`, la base diplômes IRIS 2020 (Téléchargements), `TD_NAT1_2022.xlsx` et `TD_POP1B_2022.csv`.

## 2. Comparaison avec les données de la version actuelle

« Actuel » = le contenu de `data_scores_0_10.json` (indicateurs bruts). « Recalculé 2021 » = le même indicateur refait par `construire_serie_temporelle.py` depuis les bases ci-dessus.
Corrélations de Pearson et de rang sur les 360 communes ; écart moyen absolu après remise de chaque série sur 0-1 (min-max).

| Indicateur | Source actuelle (millésime) | Source de la série | Moyenne actuel / recalculé 2021 / 2016 | Écart moyen (0-1) | Pearson | Rang |
|---|---|---|---|---|---|---|
| Opp1 éducation | INSEE diplômes IRIS **2020**, 7 niveaux, 18 ans et plus | diplômes commune 2016 et 2021, **4 niveaux** (le détail à 7 niveaux n'existe pas en 2016), 18 ans et plus | 3,40 (sur 7) / 2,41 (sur 4) / 2,30 | 0,041 | 0,91 | 0,91 |
| Opp2 diversité sociale | INSEE statistiques locales, CSP 2021, effectifs entiers | base-cc CSP, effectifs non arrondis | 0,338 / 0,364 / 0,388 | 0,038 | 0,92 | 0,95 |
| Opp3 mobilité | voiture 2021 (INSEE) + accès transports en commun (0/100) + 100 pour 3 villes | base-cc logement et emploi | 135,7 / 136,3 / 136,3 | 0,003 | 0,99 | 0,99 |
| **Cho2 droit de vote (proxy)** | Français 18 ans et plus (approximation des personnes qui ont le droit de vote), **2022** (TD_NAT1 + TD_POP1B, règle 15-24 ans × 0,7) | **même méthode**, tables 2016 et 2021 | 95,7 / 95,8 / 96,0 | 0,051 | 0,89 | 0,91 |
| **Vec1 revenu** | médiane du niveau de vie Filosofi 2021, **valeur départementale pour 154 communes** | **identique** pour 2021 ; Filosofi 2016 construit de la même façon | 21 942 € / 21 942 € / 19 176 € | 0,000 | 1,000 | 1,000 |
| Vec2 logement | RP **2022** microdonnées (parquet), personnes par pièce moyennées par logement | base-cc logement, rapport des sommes | 0,791 / 0,793 / 0,788 | 0,026 | 0,96 | 0,94 |
| Vec3 emploi | RP 2021 (statistiques locales), effectifs entiers | base-cc emploi et population active | 0,858 / 0,858 / 0,834 | 0,003 | 0,999 | 0,998 |

### Détail par indicateur

- **Vec1 (médiane du niveau de vie)** : en 2021, la série reprend exactement vos valeurs, pour les 360 communes. Le fichier data.gouv.fr « Niveau de vie médian » a une valeur vide pour les 154 communes où l'INSEE ne diffuse pas la médiane,
  et vos valeurs départementales (23 420 € en Corse-du-Sud, 21 460 € en Haute-Corse) sont exactement les médianes départementales de l'INSEE. Pour 2016, le fichier Filosofi 2016 a 206 médianes numériques (comme en 2021),
  153 cases vides et la commune 2B015 absente : 154 communes reçoivent la médiane de leur département en 2016 (20 367 € en Corse-du-Sud, 18 803 € en Haute-Corse). **148 communes sont départementales aux deux dates** : leur « évolution » est donc seulement celle de leur département.
  Pour ces 148 communes, Vec1 ne dit rien d'elles-mêmes.
- **Cho2 (18 ans et plus)** : la méthode de `proportion_etrangers_18plus_final.py` (étrangers 18+ = population de 18-24 ans en POP1B − 0,7 × Français de 15-24 ans en NAT1, + étrangers de 25 ans et plus en NAT1, rapportés à la population totale ; Cho2 = 100 − cette proportion, plafonné à 100)
  a été réécrite sur les fichiers au format long de l'INSEE et **vérifiée sur 2022** : elle retrouve votre fichier actuel à moins de 0,01 point pour 357 communes sur 360 (3 écarts, maximum 1,5 point). Appliquée à 2016 et 2021, elle donne 96,0 % et 95,8 % en moyenne.
  L'écart avec la valeur actuelle en 2021 (corrélation 0,89, maximum de 28,6 points sur une petite commune) vient du millésime (2021 contre 2022), pas de la méthode.
  Rappel : « 18 ans et plus » est approché en retranchant 0,7 × les Français de 15-24 ans (règle d'approximation de la méthode actuelle).
- **Opp3, Vec3, Opp2 (RP 2021)** : ce sont les mêmes données du recensement. Les écarts viennent seulement des arrondis (statistiques locales arrondies à l'entier) et, pour Opp3, de deux communes où le test
  « des actifs vont travailler en transports en commun » diffère : Aléria et Poggio-Mezzana n'ont pas le +100 dans le fichier actuel mais l'ont dans le recensement (168 communes à 100 contre 166 ; écart de 100 points sur Opp3 pour ces deux communes, 0,05 au plus pour les 358 autres).
  Pour Vec3, les effectifs retombent à l'unité près (Afa : 119 chômeurs, 4 emplois aidés, 21 ponctuels, 98 CDD, 1 472 stables, 1 714 actifs).
  Pour Opp2, 196 communes sont à moins de 0,005 du fichier actuel, mais 55 s'en écartent de plus de 0,05 et le maximum est de 0,65 (Érone, justement la commune la plus basse de l'indice actuel ; puis Aiti, Tarrano, Piazzali) : ce sont des communes de quelques dizaines d'habitants où l'arrondi à l'entier des effectifs par catégorie (fichier actuel) change fortement l'indice de Theil.
- **Opp1** : la définition diffère par le nombre de niveaux (4 contre 7) et le millésime (2021 contre 2020). La corrélation reste de 0,91.
  Au passage, rappel : l'ancien `Opp1.xlsx` était un compteur sans rapport avec l'éducation (corrélation de 0,01 avec le niveau de diplôme INSEE) ; il a été remplacé le 2026-10-13 (voir `VERIFICATION_COHERENCE_DONNEES.md`).
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

- **Euros courants.** Vec1 est la médiane de chaque année en euros de l'année : la moyenne communale passe de 19 176 € à 21 942 € (+14 %), dont une part d'inflation que je n'ai pas corrigée (de l'ordre de +6 % entre les moyennes annuelles 2016 et 2021, d'après mes souvenirs, **non vérifié**).
  Conséquence : Vec monte pour 306 communes sur 360, en grande partie à cause de cette hausse nominale. À corriger (euros constants) si on veut interpréter l'évolution de Vec.
- **Recouvrement du recensement.** Un millésime regroupe cinq années d'enquête ; 2016 (enquêtes 2014-2018) et 2021 (2019-2023) ne se recouvrent pas, mais deux millésimes consécutifs se recouvriraient (d'où le choix de 5 ans d'écart).
- **Petites communes.** 146 communes ont moins de 100 personnes de 15 ans et plus non scolarisées ; pour la série, la corrélation entre 2016 et 2021 est de 0,33 pour Vec3, 0,61 pour Opp3, 0,74 pour Opp1 : une partie de l'« évolution » est du bruit.
- **Questionnaire 2018.** L'INSEE signale un changement de questionnaire en 2018 (repérage de la multi-résidence) qui touche la mesure de la population : prudence sur les évolutions qui en dépendent.
- **Géographie.** Les données 2016 sont diffusées avec les communes au 1er janvier 2019 ; aucune commune corse n'a changé, vérifié par la correspondance des 360 codes (la commune 2B015 manque seulement dans Filosofi 2016).
- **Corrections INSEE.** Plusieurs fichiers 2021 ont été republiés en décembre 2025 (poids des communes passant le seuil de 10 000 habitants, tableaux détaillés) : sans effet sur les petites communes corses, mais à re-télécharger si on veut la dernière version.

## 5. Résultat de la série (indice comparable, 7 indicateurs)

Moyenne 5,10 en 2016, 5,59 en 2021 (+0,49) ; 162 communes en progression de plus de 0,5 point, 140 stables, 58 en recul. Vec progresse beaucoup (6,24 contre 4,92 en moyenne : voir « euros courants »), Opp un peu (4,94 contre 4,60),
Cho est stable (8,18 contre 8,24). Poids de Betti : Opp 0,447 ; Cho 0,338 ; Vec 0,215. L'indice comparable 2021 et l'indice actuel ont une corrélation de 0,78 : ce ne sont pas le même indice (7 indicateurs au lieu de 10).

## 6. Pour refaire le calcul

`python construire_serie_temporelle.py "<dossier>"` avec un dossier contenant `2016/` et `2021/` (fichiers sous leurs noms d'origine) ; la liste exacte est dans `WEB/README_FICHIERS.md`
et `VERIFICATION_COHERENCE_DONNEES.md` (section « Série temporelle »). La lecture du `.xls` Filosofi 2016 demande la bibliothèque `xlrd` (installée pendant la session). Un test rejoue le calcul si la variable d'environnement `OPPCHOVEC_SERIE` désigne ce dossier.
