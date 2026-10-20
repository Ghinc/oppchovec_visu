# Audit des sources de l'indice courant : ce qui est sourcé, ce qui ne l'est pas, et comment homogénéiser sur 2023-2025

Rapport du 19 octobre 2026. Rédigé pour la doctorante qui pilote le projet. Objet : pour l'onglet principal (l'indice « courant »), lister toutes les données utilisées, dire lesquelles n'ont pas de source connue, et proposer pour chacune un remplacement dont la source est connue, avec un millésime homogène (2024, à plus ou moins un an). **Rien n'est modifié dans l'indice** : c'est un audit et un plan, à valider avant tout changement.

## En bref

- **17 variables** composent les 10 indicateurs : **5 sont sourcées et reproduites**, **7 sont sourcées mais reproduites seulement en partie** (ou dont le fichier d'origine est hors du dépôt), et **5 n'ont pas de source connue** : la 4G et la fibre d'Opp4, la liste des villes à réseau de bus d'Opp3, la salle de bain et le chauffage de Vec2.
- **Un précédent à ne pas oublier :** l'ancien fichier d'Opp1 était un compteur artificiel (5,75 ; 5,76 ; 5,77…), découvert le 13 octobre et remplacé. Les autres fichiers hérités du stage de 2025 (`Opp2`, `Opp4`, `Vec1`, `Vec3`, `Vec4`) ont depuis été recoupés avec les sources officielles : ils sont corrects, sauf la 4G d'`Opp4.xlsx` ; la fibre vient d'un fichier distinct, créé en novembre 2025, qui ne l'est pas non plus.
- **Découverte de cet audit :** le Cho1 actuel n'est pas la population des quartiers prioritaires. Il donne 3 717 / 780 / 6 797 personnes (Ajaccio, Porto-Vecchio, Bastia) contre 5 778 / 1 127 / 11 027 dans le fichier officiel de l'INSEE (QPV 2024) : environ **62 à 69 %** de la population officielle.
- **Les millésimes vont de 2020 à 2024** (Opp1 2020 ; Opp2, Opp3, Vec1, Vec3 2021 ; Cho1, Cho2, Vec2 2022 ; Vec4 2024). Une cible homogène est possible : **recensement 2023 pour tout ce qui vient de l'INSEE**, revenus 2024, ARCEP et BPE 2024. Le recensement 2023 vient d'être publié (la base « Diplômes - Formation 2023 » date du 19 octobre 2026), mais je n'ai pas encore confirmé que toutes ses bases sont en ligne.
- **Le chantier est lourd, mais mécanique** : changer les sources oblige à tout régénérer (scores, Jenks, LISA, CAH, Excel, chatbot, documentation, tests de référence). Je propose un ordre en bas de page.

## Mise à jour du 19 octobre 2026 : l'indice v2 est en place

Vos décisions (revenu fiscal moyen pour Vec1, 4G « au moins un opérateur », recensement 2023, bus d'Ajaccio, Bastia et Porto-Vecchio validés, remplacement entier avec archive de l'ancien) ont été appliquées. **Les 17 variables ont maintenant une source officielle et un millésime**, détaillés dans `Données/indice_v2/sources_indice_v2.json` et `VERIFICATION_COHERENCE_DONNEES.md`. L'ancien indice reste reconstructible (étiquette Git `indice-courant-v1-2020-2024`, `Données/archive_indice_v1_2020_2024/`).

| Indicateur | Source v2 | Millésime |
|---|---|---|
| Opp1, Opp2, Opp3, Cho2, Vec2, Vec3 | INSEE, bases communales et tables détaillées du recensement | 2023 |
| Opp4 (4G, débit, fibre) | ARCEP, cartes de couverture et « Ma connexion internet » | T4 2024 |
| Cho1 | INSEE, population communale en QPV 2024 | référence 1er janvier 2020 (publiée en 2025) |
| Vec1 | DGFiP, IRCOM (revenu fiscal moyen par foyer fiscal) | revenus 2024 |
| Vec4 | INSEE, base permanente des équipements | 2024 |

**Réponse à votre question sur les quartiers prioritaires :** entre 2023 et 2025, l'INSEE ne publie pas de population en nombre d'habitants pour les QPV de la géographie 2024. Les estimations démographiques 2022 sont des parts (jeunes, étrangers, etc.), sans effectif ; la seule population en nombre est la population de référence au 1er janvier 2020 (publiée le 10 juillet 2025), utilisée ici.

**Trois écarts à connaître :**
- **Vec3** : le recensement 2023 ne distingue plus les CDD, l'intérim, les emplois aidés et les apprentis ; ils sont regroupés en « autres contrats » au poids 0,5 (corrélation de 0,98 avec l'ancien calcul sur 2021).
- **Vec2** : le terme de confort (salle de bain + chauffage) est retiré : le chauffage valait 1 partout et la salle de bain n'est plus publiée par commune pour la France métropolitaine dans le recensement 2023 (« nd » pour 34 747 communes sur 34 858 ; seuls les DOM ont des valeurs) ; le combustible principal, seule variable de chauffage publiée, partage toutes les résidences et vaut donc toujours 100 %. Cela ne change pas les scores normalisés. **Décision du 20 octobre 2026 : on garde cette formule** (plutôt que d'aller chercher la salle de bain du recensement 2022, hors de la fenêtre 2023-2025).
- **Opp4** : avec « au moins un opérateur », la 4G est à 94,6 % ou plus partout (moyenne 99,9 %) ; la fibre vaut 55,7 % en moyenne et le débit 65,0 %.

L'onglet Évolution a été aligné sur les mêmes définitions de Vec2 et de Vec3 (« l'indicateur doit être le même partout »).

*Ce qui suit est l'audit initial, tel que rédigé avant le remplacement.*

## 1. Comment j'ai classé

| Statut | Signification |
|---|---|
| **A · Sourcé et reproduit** | la source officielle est identifiée et je retrouve les valeurs de l'indice depuis elle (exactement, ou à l'arrondi près) |
| **B · Sourcé, reproduction partielle** | la source semble connue, mais je ne retrouve pas tout à fait les valeurs, ou le fichier d'origine et son script ne sont pas dans le dépôt |
| **C · Non sourcé** | aucune source connue, ou valeur impossible à retrouver depuis une source officielle |

Les vérifications viennent de recalculs refaits dans cette session et dans les précédentes : comparaison avec les bases du recensement 2021 et 2022, le fichier « Niveau de vie médian » de data.gouv, la base permanente des équipements 2024 (avec le serveur d'itinéraires), les fichiers ARCEP « Ma connexion internet » et les cartes de couverture mobile 2021 et 2024, et le fichier INSEE des populations en quartier prioritaire.

## 2. Variable par variable : ce qui est utilisé aujourd'hui

| Indicateur · variable | Fichier actuel (où il se trouve) | Origine | Millésime | Ce que j'ai vérifié | Statut |
|---|---|---|---|---|---|
| **Opp1** · niveau de diplôme moyen (1-7) | `education_communes_opp1.json`, produit par `calculer_education_opp1.py` | INSEE, base IRIS « Diplômes - Formation » | 2020 | recalculé depuis la base IRIS agrégée par commune ; script au dépôt, fichier IRIS hors dépôt | **A** |
| **Opp2** · indice de Theil sur 8 catégories socioprofessionnelles | `Opp2.xlsx` (hors dépôt, hérité du stage, modifié le 24/04/2025) | INSEE, statistiques locales, CSP 15 ans et plus | 2021 | recalculé depuis la base communale : 196 communes à moins de 0,005 d'écart, 55 à plus de 0,05, maximum 0,65 (Érone) : arrondi des effectifs à l'entier | **B** |
| **Opp3** · part de ménages avec au moins une voiture | `Opp3.xlsx` (hors dépôt, créé le 06/11/2025, script de production non conservé) | INSEE, recensement | 2021 | recalculé : corrélation 0,99, écart moyen 0,003 | **B** |
| **Opp3** · accès aux transports en commun (0 ou 100) | colonne « Accès aux réseaux de transport » du même fichier | non documentée ; correspond à « au moins un actif occupé va au travail en transports en commun » | 2021 | 166 communes à 100 contre 168 avec le recensement 2021 (Aléria et Poggio-Mezzana diffèrent) ; repose sur environ une personne dans la plupart des petites communes | **B** |
| **Opp3** · réseau de bus urbain (+100) | liste de trois codes dans `exporter_sous_composantes.py` et `script.js` | aucune (Ajaccio, Bastia, Porto-Vecchio) | non datée | aucune source datée ; Porto-Vecchio sans réseau urbain trouvé sur transport.data.gouv.fr | **C** |
| **Opp4** · population couverte par la 4G | `Opp4.xlsx` (hérité du stage, modifié le 29/04/2025) | « ARCEP » dans le rapport de stage, sans fichier ni date | non datée | **aucune carte ARCEP ne la reproduit** : corrélation de 0,03 à 0,10 avec 2021 et 2024, quatre opérateurs, toutes définitions ; des communes littorales sont à un tiers (L'Île-Rousse 34 %, Lucciana 32 %, Patrimonio 22 %, Cargèse 35 %), 45 communes sous 70 % contre 0 sur les cartes | **C** |
| **Opp4** · population avec un débit de 30 Mbit/s ou plus | `Opp4.xlsx`, autre colonne | « ARCEP, maconnexioninternet » | T4 2021 (identifié par recoupement) | correspond au fichier ARCEP « Ma connexion internet » T4 2021, offres filaires : 347 communes sur 360 à ±1 point, corrélation 0,97 ; 13 communes diffèrent | **B** |
| **Opp4** · fibre | `fibre_corse.csv` (hors dépôt, créé le 09/11/2025) | aucune | non datée | valeurs en classes grossières (0, 5, 25, 50, 80 % : 309 communes à 80 %), corrélation de 0,09 avec la mesure ARCEP T4 2021 | **C** |
| **Cho1** · personnes vivant en quartier prioritaire | `Cho1_personnes.xlsx` (hors dépôt, 09/11/2025), produit par `calculer_inper_par_ville.py` depuis `RP2022_logemt_quartiers_selectionnes.csv` (absent du dépôt) | INSEE, recensement 2022, logements des quartiers sélectionnés (somme de la variable INPER) | 2022 ; quartiers 2024 | **ne donne que 62 à 69 % de la population officielle des QPV** : 3 717 / 780 / 6 797 contre 5 778 / 1 127 / 11 027 (INSEE, population communale en QPV 2024) | **B** |
| **Cho2** · part de Français de 18 ans et plus (proxy du droit de vote) | `Cho2_francais_18plus.xlsx` (hors dépôt, 11/11/2025), méthode de `proportion_etrangers_18plus_final.py` | INSEE, tables NAT1 et POP1B | 2022 | reproduit à moins de 0,01 point pour 357 communes sur 360 (3 écarts, maximum 1,5 point) ; l'approximation « 0,7 × Français de 15-24 ans » est une règle de la méthode | **A** |
| **Vec1** · médiane du niveau de vie | `Vec1.xlsx` (hérité du stage, 07/04/2025) | INSEE, Filosofi, data.gouv « Niveau de vie médian » | 2021 | identique à la source pour les 360 communes ; **mais 154 communes ont la valeur de leur département** (la médiane n'est pas diffusée) | **A** (206 communes) · imputation pour 154 |
| **Vec2** · personnes par pièce | `vec2_lb.csv` (hors dépôt, 05/11/2025, script de production absent) | INSEE, recensement, probablement les microdonnées | 2022 | corrélation de 0,92 avec la base communale ; moyenne des logements (actuel) contre rapport des sommes (série) | **B** |
| **Vec2** · part de maisons | `vec2_lb.csv` | idem | 2022 | corrélation de 0,97 avec la base communale | **B** |
| **Vec2** · part de logements avec salle de bain | `vec2_lb.csv` | idem | 2022 | corrélation de **0,38** avec la base communale ; je n'ai pas pu retrouver la règle | **C** |
| **Vec2** · chauffage | `vec2_lb.csv`, colonne `pct_chauffage` | aucune | non datée | **vaut 1,0 pour les 360 communes** : ce n'est pas une donnée, c'est une constante | **C** |
| **Vec3** · statuts d'emploi (chômeur, aidé, ponctuel, CDD, stable) | `Vec3.xlsx` (hérité du stage, 07/04/2025) | INSEE, recensement, statistiques locales | 2021 | effectifs retrouvés à l'unité près (exemple d'Afa : 119 chômeurs, 4 aidés, 21 ponctuels, 98 CDD, 1 472 stables), corrélation 0,999 | **A** |
| **Vec4** · services accessibles en 20 minutes | `services_accessibles_20min_local.csv` (hors dépôt) | INSEE, base permanente des équipements, et serveur d'itinéraires OSRM sur OpenStreetMap | 2024 | **retrouvé exactement pour les 360 communes** avec la BPE 2024 complète | **A** |

Total : 5 variables en **A** (Opp1, Cho2, Vec1, Vec3, Vec4), 7 en **B**, 5 en **C**.

### Pourquoi la 4G et la fibre sont les deux gros problèmes

- Opp4 pèse un quart de la dimension Opp, et deux de ses trois composantes (4G et fibre) n'ont pas de source. Seul le débit se retrouve.
- La 4G de l'appli situe des communes bien desservies à un tiers de couverture. Les cartes théoriques de l'ARCEP (quatre opérateurs) donnent au contraire presque partout 100 % en 2021 comme en 2024. Soit la source est une mesure d'un autre type, soit elle contient des erreurs : je ne peux pas le dire.
- La fibre de l'appli est une classe (0, 5, 25, 50 ou 80 %), pas un taux. Elle fait gagner 80 % à 309 communes sur 360.

## 3. Les années sont hétérogènes

| Millésime | Indicateurs |
|---|---|
| 2020 | Opp1 |
| 2021 | Opp2, Opp3 (voiture et transports), Opp4 (débit, T4 2021), Vec1, Vec3 |
| 2022 | Cho1, Cho2, Vec2 |
| 2024 | Vec4 |
| non datés | Opp4 (4G, fibre), Opp3 (réseau de bus) |

L'écart va de 2020 à 2024, soit quatre ans, et plusieurs données n'ont pas d'année. Comme la période compte (la couverture 4G et la fibre de la Corse ont beaucoup bougé entre 2021 et 2024, l'inflation de Vec1 aussi), l'indice mélange des états différents du territoire.

## 4. Plan de remplacement, avec un millésime homogène (2023 à 2025)

Cible proposée : **recensement 2023** pour tout ce qui vient de l'INSEE (dans la fenêtre « 2024 ± 1 »), **revenus 2024**, **ARCEP T4 2024**, **BPE 2024**. J'ai vérifié que les sources existent ; les points marqués « à confirmer » demandent encore un contrôle du fichier précis.

| Indicateur · variable | Remplacement proposé | Millésime | Disponibilité | Ce qui change |
|---|---|---|---|---|
| Opp1 | INSEE, base communale « Diplômes - Formation 2023 » (`base_cc_diplomes_formation_2023`) | 2023 | **confirmée** (publiée le 19/10/2026 ; communes à la géographie 2026) | on passe de la base IRIS agrégée à la base communale ; les colonnes de niveau (7 niveaux) sont à contrôler |
| Opp2 | INSEE, base « Évolution et structure de la population 2023 » (CSP des 15 ans et plus) | 2023 | page confirmée, fichier à confirmer | effectifs non arrondis (plus fidèles) |
| Opp3 · voiture | INSEE, base « Logement 2023 » | 2023 | page confirmée (mise à jour du 08/10/2026) | même variable (ménages avec voiture) |
| Opp3 · transports en commun | INSEE, base « Caractéristiques de l'emploi 2023 » **ou**, mieux, la présence d'un arrêt desservi (fichiers GTFS de transport.data.gouv.fr) | 2023 ou 2024-2026 | INSEE page confirmée ; GTFS à explorer (vous cherchez de votre côté) | le drapeau « au moins une personne » est fragile ; l'idée « au moins un arrêt » est préférable |
| Opp3 · réseau de bus | remplacé par les mêmes fichiers GTFS (réseaux Via Bastia, Muvistrada, interurbain Corse…) | 2024-2026 | à explorer | remplace une liste écrite à la main par une donnée sourcée |
| Opp4 · 4G | recalculée depuis les **cartes de couverture théorique ARCEP T4 2024** (quatre opérateurs) croisées avec la grille de population INSEE de 200 m, couverture « au moins un opérateur » : exactement la méthode déjà utilisée pour l'onglet Évolution | T4 2024 (cartes) ; grille 2021 | **confirmée** (cartes téléchargées et calculées) | **la valeur change beaucoup** : environ 99,9 % presque partout, au lieu des valeurs actuelles |
| Opp4 · débit | ARCEP, « Ma connexion internet », T4 2024, offres filaires (`commune_debit_filaire.csv`) | T4 2024 | **confirmée** (dossier `2024_T4` présent) | même fichier que l'actuel, trimestre plus récent |
| Opp4 · fibre | ARCEP, « Ma connexion internet », T4 2024 (`commune_techno.csv`, FttH) | T4 2024 | **confirmée** | un taux réel à la place des classes |
| Cho1 | INSEE, population communale en quartier prioritaire (QPV 2024), `pop_reference_communales_QPV24.xlsx` | référence 1er janvier 2020 (hors fenêtre) | **confirmée**, mais millésime ancien ; sinon garder le fichier du recensement 2022 en corrigeant ce qui manque | on obtient la vraie population des QPV (5 778 / 1 127 / 11 027) au lieu de 62 à 69 % de celle-ci |
| Cho2 | INSEE, tables du recensement 2023 sur la nationalité et la population par âge | 2023 | **à confirmer** (tables détaillées « Étrangers - Immigrés » et « Évolution et structure » de 2023) | même méthode |
| Vec1 | **choix à faire** : (a) **revenu fiscal moyen par foyer fiscal, DGFiP IRCOM revenus 2024** (publié en mai 2026), couvre presque toutes les communes (environ 12 sous secret) ; (b) rester sur la médiane Filosofi 2023, mais elle n'est pas diffusée pour environ 150 communes | revenus 2024 ou 2023 | (a) **confirmée** ; (b) fichier communal à confirmer | (a) change le concept : moyenne et non médiane ; (b) garde le concept mais impose encore l'imputation par le département |
| Vec2 · personnes par pièce, maisons, salle de bain | INSEE, base communale « Logement 2023 » (`NPER_RP`, `NBPI_RP`, `RPMAISON`, `RP_SDB`) | 2023 | page confirmée | remplace des valeurs dont la règle est perdue |
| Vec2 · chauffage | à explorer : la base « Logement 2023 » vient de recevoir la variable **« combustible »** (ajout du 08/10/2026), qui pourrait donner un vrai terme de chauffage | 2023 | **à confirmer** | remplace une constante par une donnée |
| Vec3 | INSEE, bases « Caractéristiques de l'emploi 2023 » et « Population active - Emploi - Chômage 2023 » | 2023 | pages confirmées | même variables |
| Vec4 | BPE 2024, déjà en place | 2024 | **en place** | aucun changement (une BPE 2025 existe peut-être : à vérifier) |

### Ce que le changement entraîne

- **Les valeurs de l'indice vont bouger.** Les plus gros changements viendront de la 4G (presque 100 % partout), de la fibre (un vrai taux), de Cho1 (population des QPV) et de Vec1 si on passe aux revenus 2024.
- **Il faut tout régénérer :** les scores bruts et normalisés, les classes de Jenks, la CAH, la LISA, les parangons, l'Excel téléchargeable, le chatbot, la documentation, et les tests de référence (en particulier celui qui compare à l'état d'avant). Les anciennes valeurs doivent être gardées comme référence pour comparer avant et après.
- **Les curseurs de l'appli** (sliders) reposent sur les sous-composantes brutes : `sous_composantes.json` doit être régénéré en même temps.
- **Une partie du travail est déjà faite** : le calcul de la 4G, du débit et de la fibre, de Vec4 et de la lecture des bases du recensement existe pour l'onglet Évolution (`construire_serie_temporelle.py`, `construire_opp4_serie.py`, `calculer_couverture_4g.py`).

## 5. Ordre proposé

1. **D'abord ce qui n'a pas de source** (les 5 variables en C) : 4G, fibre, salle de bain et chauffage de Vec2, réseau de bus. C'est là que le gain de crédibilité est le plus grand. La 4G, la fibre et le débit (Opp4) sont prêts à calculer avec l'ARCEP T4 2024.
2. **Ensuite Cho1** (corriger la population des QPV) et **Vec2** (reprendre la base communale de 2023).
3. **Puis le passage de tout le recensement à 2023** (Opp1, Opp2, Opp3, Cho2, Vec3), une fois confirmée la disponibilité de chaque base. Pour ces indicateurs on remplace un millésime par le suivant avec la même méthode : peu de risque.
4. **Vec1 en dernier**, après décision sur le concept (revenu fiscal moyen ou médiane).

## 6. Décisions à prendre avant de toucher à l'indice

1. **Année cible :** je propose 2023 pour le recensement (le plus récent publié) et 2024 pour le reste ; est-ce que cela vous convient, ou préférez-vous exactement 2024 (le recensement 2022 serait alors à deux ans, hors fenêtre) ?
2. **Vec1 :** revenu fiscal moyen (IRCOM 2024, presque complet) ou médiane Filosofi (concept d'origine, mais imputation pour 150 communes) ?
3. **Opp4 · 4G :** la définition « au moins un opérateur » comme dans l'onglet Évolution ? Cela supprime les écarts entre communes (presque toutes à 100 %), donc la 4G perd beaucoup de pouvoir discriminant dans l'indice courant.
4. **Opp3 · transports :** attendre vos fichiers GTFS, ou garder provisoirement le drapeau du recensement 2023 (et la liste de trois villes, signalée comme non sourcée) ?
5. **Cho1 :** la population officielle des QPV (référence 2020) ou rester sur le recensement 2022 en le corrigeant ?
6. **Conservation de l'ancien indice :** gardez-vous une version « 2020-2024 » consultable (par exemple sous forme d'une case à cocher), ou la remplace-t-on entièrement ?

## Fichiers

Scripts existants : `Code/Python/exporter_sous_composantes.py` (lit les fichiers hors dépôt), `calculer_education_opp1.py`, `calculer_inper_par_ville.py` (à la racine), `construire_serie_temporelle.py`, `construire_opp4_serie.py`, `calculer_couverture_4g.py`, `calculer_vec4_serie.py`. Rapports liés : `RAPPORT_DONNEES_SERIE_TEMPORELLE`, `RAPPORT_SOURCES_2016_2021_PAR_INDICATEUR`, `VERIFICATION_COHERENCE_DONNEES.md`.
