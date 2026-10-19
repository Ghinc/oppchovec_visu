# Rapport : données téléchargées pour la série temporelle, et comparaison avec celles de la version « actuelle »

Date : 2026-10-14, mis à jour le 2026-10-19. Rédigé pour la doctorante qui pilote le projet (pas pour des décideurs). Les chiffres viennent de calculs refaits dans la session
(`construire_serie_temporelle.py`, scripts de recoupement) ; les tests du dépôt (`test_12_serie_temporelle.py`) vérifient les scores de la série et la cohérence de Vec1 et de Cho2 avec la version actuelle.
Mise à jour du 2026-10-19 : la série compte maintenant les **10 indicateurs** (Opp4, Cho1 et Vec4 ajoutés) ; Vec1 est le **revenu fiscal moyen par foyer fiscal** (IRCOM, DGFiP) par commune et non plus la médiane Filosofi ; Cho2 porte sur les 18 ans et plus. Le détail variable par variable est dans `RAPPORT_SOURCES_2016_2021_PAR_INDICATEUR`.

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
| Filosofi, médiane du niveau de vie | 2016 ; 2021 | INSEE 4190004 (`base-cc-filosofi-2016.xls`) ; data.gouv.fr « Niveau de vie médian » | médiane par commune et par département ; **n'est plus utilisée par la série** (remplacée par l'IRCOM : la médiane n'est pas diffusée pour 154 communes) | 11 Mo ; 1 Mo |
| **IRCOM (impôt sur le revenu par commune)** | revenus 2016 et 2021 | DGFiP, data.gouv.fr | revenu fiscal de référence et foyers fiscaux, ligne « Total » par commune ; **utilisé par la série pour Vec1** (revenu fiscal moyen par foyer) | 8 Mo / 9 Mo |
| **Observatoire France Très Haut Débit** (`thd_T4_2016.xlsx`) | T4 2016 | Agence du numérique, data.gouv.fr (archives) | part des locaux éligibles par classe de débit et par technologie (DSL, câble, FttH), par commune : débit ≥ 30 Mbit/s et fibre d'Opp4 en 2016 | 35 Mo |
| **ARCEP « Ma connexion internet »** (`commune_debit_filaire.csv`, `commune_techno.csv`) | T4 2021 | data.arcep.fr/fixe/maconnexioninternet/statistiques/2021_T4/commune/ | locaux éligibles par classe de débit (offres filaires) et par technologie, par commune : débit ≥ 30 Mbit/s et fibre d'Opp4 en 2021 | 2 Mo |
| **ARCEP, couvertures 4G théoriques** | mars 2017 (`archives/2017_T1`) ; décembre 2021 (`2021_T4`) | data.arcep.fr/mobile/couvertures_theoriques/ | un polygone de couverture 4G par opérateur (Orange, SFR, Free, Bouygues) : 4G d'Opp4 | 100 Mo ; 130 Mo |
| **Grille de population INSEE de 200 m** (Filosofi) | 2019 ; 2021 | data.gouv.fr, données carroyées | individus par carreau, pour pondérer la 4G par la population (`calculer_couverture_4g.py`) | 162 Mo ; 95 Mo |
| **Base permanente des équipements** (BPE) | 2016 ; 2021 | INSEE (`bpe2016.csv.gz` ; `bpe21_ensemble_xy.csv`) | équipements géolocalisés (type, coordonnées) : Vec4 | 43 Mo ; 276 Mo |
| **Quartiers prioritaires (QPV 2015)** | population 2013 ; 2018 | INSEE (`DEMO_2018_V1.xls` ; `pop_qpv_2018.xlsx`) | population des 5 quartiers de 2015 par commune : Cho1 | < 1 Mo |

Ces bases sont communales (France hors Mayotte) ; les 360 communes corses y figurent toutes, sans fusion ni changement de code entre 2016 et 2021.
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
| **Vec1 revenu** | médiane du niveau de vie Filosofi 2021, valeur départementale pour 154 communes | **revenu fiscal moyen par foyer fiscal** (IRCOM), aux deux dates ; 11 (2016) et 12 (2021) communes sous secret statistique | 21 942 € / 22 817 € / 20 029 € | | 0,45 | 0,35 |
| Vec2 logement | RP **2022** microdonnées (parquet), personnes par pièce moyennées par logement | base-cc logement, rapport des sommes | 0,791 / 0,793 / 0,788 | 0,026 | 0,96 | 0,94 |
| Vec3 emploi | RP 2021 (statistiques locales), effectifs entiers | base-cc emploi et population active | 0,858 / 0,858 / 0,834 | 0,003 | 0,999 | 0,998 |
| **Opp4 connectivité** | 4G, débit ≥ 30 Mbit/s et fibre (`Opp4.xlsx`, `fibre_corse.csv`) : 4G introuvable, fibre en classes grossières | 4G : cartes ARCEP × grille INSEE (au moins un opérateur) ; débit et fibre : locaux éligibles (THD 2016, ARCEP 2021) | 65,0 / 48,0 / 27,7 | | 0,71 | 0,74 |
| Cho1 quartiers prioritaires | −log(personnes en QPV), géographie **2024** | même formule, géographie **2015** aux deux dates, populations 2013 et 2018 | −0,066 / −0,067 / −0,070 | | 0,999 | 1,000 |
| Vec4 services à 20 minutes | BPE **2024**, tous les types d'équipements | BPE 2016 et 2021, **147 types** communs, même réseau routier | 516 / 303 / 304 | | 0,996 | 0,992 |

### Détail par indicateur

- **Vec1 (revenu fiscal moyen par foyer fiscal)** : la série n'utilise plus la médiane du niveau de vie de Filosofi, qui n'est pas diffusée pour 154 communes (elles recevaient la valeur de leur département). Elle prend le revenu fiscal de référence total divisé par le nombre de foyers fiscaux (ligne « Total » de l'IRCOM de la DGFiP), par commune, pour les revenus 2016 et 2021. Seules les communes sous secret statistique reçoivent la moyenne de leur département : 11 en 2016, 12 en 2021 (9 aux deux dates, 5 une seule année). Les valeurs de 2021 sont identiques à la variante « revenu fiscal » de l'appli (test automatique). Ce n'est pas le même concept que la médiane de l'indice actuel (moyenne et non médiane, par foyer fiscal et non par unité de consommation) : corrélation de 0,45 seulement avec la médiane actuelle, d'où le choix de dire « revenu fiscal moyen » dans l'onglet.
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
- **Opp4** : (4G + débit + fibre) ÷ 3. Le **débit** de l'appli est le fichier ARCEP « Ma connexion internet » du T4 2021 (offres filaires) : corrélation de 0,97 avec notre valeur, 347 communes sur 360 à ±1 point ; pour 2016, le fichier de l'Observatoire France Très Haut Débit (T4 2016, toutes technologies). La **4G** de l'appli est introuvable : aucune carte ARCEP (2021 ou 2024, quatre opérateurs, toutes définitions) ne la reproduit (corrélation de 0,03 à 0,10) ; on recalcule donc la même mesure aux deux dates (population couverte par au moins un opérateur). La **fibre** de l'appli est une classe grossière (0, 5, 25, 50 ou 80 %), non reproductible : on prend la mesure ARCEP (12,9 % en 2021, 0,2 % en 2016).
- **Cho1** : la géographie des quartiers prioritaires de 2024 (appli) et de 2015 (série) diffère ; sur les trois communes concernées, les valeurs restent corrélées à 0,999 en 2021.
- **Vec4** : l'appli utilise la BPE 2024 avec tous les types d'équipements (moyenne de 516 services par commune) ; la série utilise les 147 types présents et géolocalisés aux deux dates (moyenne de 303). Corrélation de 0,996 entre les deux. Les pharmacies et les gynécologues, recodés entre 2016 et 2021, sont rapprochés ; les autres types recodés (tribunaux, gares, culture) sont laissés de côté.

## 3. Indicateurs ajoutés ensuite : Opp4, Cho1 et Vec4

Ces trois indicateurs avaient d'abord été exclus faute de source homogène pour 2016. Ils sont maintenant dans la série :

| Indicateur | Ce qui a été fait | Ce qui reste différent de l'appli |
|---|---|---|
| Opp4 (4G, haut débit, fibre) | 4G : cartes ARCEP de mars 2017 et de décembre 2021 × grille de population INSEE de 200 m, couverture par au moins un opérateur ; débit et fibre : Observatoire France Très Haut Débit (T4 2016) puis ARCEP « Ma connexion internet » (T4 2021) | la 4G et la fibre de l'appli ne sont pas reproductibles ; le débit change de producteur et de base de locaux (rupture en 2020) |
| Cho1 (personnes en quartier prioritaire) | géographie 2015 aux deux dates (5 quartiers : Ajaccio, Bastia, Porto-Vecchio), populations 2013 et 2018 | l'appli utilise la géographie 2024 |
| Vec4 (services à 20 minutes) | BPE 2016 et BPE 2021 géolocalisées, 147 types communs, même réseau routier (serveur d'itinéraires local) | l'appli utilise la BPE 2024 et tous les types |

## 4. Limites à garder en tête

- **Euros courants.** Vec1 est le revenu fiscal moyen de chaque année en euros de l'année : la moyenne communale passe de 20 029 € à 22 817 € (+14 %), dont une part d'inflation que je n'ai pas corrigée (de l'ordre de +6 % entre les moyennes annuelles 2016 et 2021, d'après mes souvenirs, **non vérifié**).
  Conséquence : Vec monte pour 288 communes sur 360, en partie à cause de cette hausse nominale. À corriger (euros constants) si on veut interpréter l'évolution de Vec.
- **Recouvrement du recensement.** Un millésime regroupe cinq années d'enquête ; 2016 (enquêtes 2014-2018) et 2021 (2019-2023) ne se recouvrent pas, mais deux millésimes consécutifs se recouvriraient (d'où le choix de 5 ans d'écart).
- **Petites communes.** 146 communes ont moins de 100 personnes de 15 ans et plus non scolarisées ; pour la série, la corrélation entre 2016 et 2021 est de 0,33 pour Vec3, 0,61 pour Opp3, 0,74 pour Opp1 : une partie de l'« évolution » est du bruit.
- **Questionnaire 2018.** L'INSEE signale un changement de questionnaire en 2018 (repérage de la multi-résidence) qui touche la mesure de la population : prudence sur les évolutions qui en dépendent.
- **Géographie.** Les données 2016 sont diffusées avec les communes au 1er janvier 2019 ; aucune commune corse n'a changé, vérifié par la correspondance des 360 codes.
- **Corrections INSEE.** Plusieurs fichiers 2021 ont été republiés en décembre 2025 (poids des communes passant le seuil de 10 000 habitants, tableaux détaillés) : sans effet sur les petites communes corses, mais à re-télécharger si on veut la dernière version.

## 5. Résultat de la série (indice comparable, 10 indicateurs)

Moyenne 3,39 en 2016, 4,17 en 2021 (+0,79) ; 222 communes en progression de plus de 0,5 point, 106 stables, 32 en recul. Opp progresse beaucoup (4,54 contre 3,34 en moyenne, surtout par Opp4), Vec un peu (4,41 contre 3,97, en partie nominal : voir « euros courants »),
Cho est stable (8,63 contre 8,67). Poids de Betti : Opp 0,462 ; Cho 0,240 ; Vec 0,298. L'indice comparable 2021 et l'indice actuel ont une corrélation de 0,88 : mêmes dix indicateurs, mais des sources et des définitions qui diffèrent sur Opp1 (4 niveaux), Opp4, Cho1, Vec1 et Vec4. Voir `RAPPORT_VARIATIONS_EVOLUTION` pour la décomposition.

## 6. Pour refaire le calcul

`python construire_serie_temporelle.py "<dossier>"` avec un dossier contenant `2016/` et `2021/` (fichiers sous leurs noms d'origine) ; la liste exacte est dans `WEB/README_FICHIERS.md`
et `VERIFICATION_COHERENCE_DONNEES.md` (section « Série temporelle »). Trois fichiers intermédiaires sont lus dans `Données/` : `opp4_serie_2016_2021.json` (construit par `construire_opp4_serie.py` à partir du THD T4 2016, d'ARCEP T4 2021 et de `calculer_couverture_4g.py`), `vec4_serie_2016_2021.json` (`calculer_vec4_serie.py serie2021`, serveur OSRM Docker) et `qpv2015_population.json`. Un test rejoue le calcul si la variable d'environnement `OPPCHOVEC_SERIE` désigne le dossier.
