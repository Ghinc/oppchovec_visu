# Vérification de la cohérence des données OppChoVec

## Résumé

Les données affichées par l'appli sont **celles de `WEB/data_scores_0_10.json`**, et elles se **recalculent exactement** à partir
des 10 indicateurs bruts qu'il contient (écart < 1e-9 sur les 360 communes). Cette vérification n'est plus manuelle : elle est
rejouée par la suite de tests (`python tests/run_tests.py`, voir `tests/README.md`), avec en plus :

- le recalcul de chaque indicateur depuis les fichiers sources bruts (quand ils sont disponibles) ;
- la comparaison avec l'état antérieur aux dernières corrections (non-régression) ;
- la cohérence entre l'appli (JavaScript), les scripts Python, les fichiers dérivés et cette documentation.

## Formules utilisées

### Python (oppchovec.py)
```python
ALPHA = 2.5
BETA = 1.5
Pondérations Opp: [0.25, 0.25, 0.25, 0.25]
Pondérations Cho: [0.50, 0.50]
Pondérations Vec: [0.25, 0.25, 0.25, 0.25]

# Formule OppChoVec
somme_ponderee = sum(pk * (dik ** BETA))
oppchovec = (1/3) * (somme_ponderee ** (ALPHA / BETA))
```

### JavaScript (script.js)
```javascript
const alpha = 2.5;
const beta = 1.5;
// Pondérations identiques

// Formule OppChoVec (identique à Python)
const dik = scores.map(score => Math.pow(score, beta));
const sommePonderee = sum(pk * dik[i]);
const indice = (1/3) * Math.pow(sommePonderee, alpha / beta);
```

Chaque indicateur est d'abord normalisé par un min-max sur les 360 communes (`(x - min) / (max - min)`), puis moyenné dans sa
dimension avec les pondérations ci-dessus. Les `p_k` valent 1 (mode « égal ») ou sont calculés selon Betti et al. (2008) à partir des
scores de dimension (mode « Betti », mode par défaut de l'appli).

## Exemple de vérification : Ajaccio

| Champ | Valeur dans `data_scores_0_10.json` | Recalcul indépendant (tests) | Différence |
|------------|---------------|-------------|------------|
| **OppChoVec** | 0.461630 | 0.461630 | **0.000000** |
| **Score_Opp** | 0.678505 | 0.678505 | **0.000000** |
| **Score_Cho** | 0.430935 | 0.430935 | **0.000000** |
| **Score_Vec** | 0.519077 | 0.519077 | **0.000000** |

## Si vous observez des différences

### Cas possibles :

1. **Versions de fichiers différentes**
   - Vérifiez que vous utilisez les fichiers les plus récents (voir la procédure de régénération dans `WEB/README_FICHIERS.md`)
   - Les poids de Vec3 (chômeur 0, emploi aidé 0,25) ont été corrigés le 2026-10-11 : les résultats antérieurs diffèrent légèrement

2. **Confusion entre valeurs avec et sans suffixe `_0_10`**
   - Les **indicateurs bruts** (Opp1, Opp2, etc.) ne sont PAS normalisés
   - `Score_Opp`, `Score_Cho`, `Score_Vec` et `OppChoVec` sont les valeurs avant mise à l'échelle (scores de dimension dans [0, 1])
   - `Score_Opp_0_10`, `Score_Cho_0_10`, `Score_Vec_0_10` et `OppChoVec_0_10` sont leur min-max sur 0-10 (c'est ce que l'appli affiche)

3. **Mode p_k**
   - `OppChoVec_0_10` correspond au mode « égal » ; l'appli affiche par défaut le mode « Betti », qui donne d'autres valeurs

4. **Arrondis d'affichage**
   - Les valeurs affichées peuvent être arrondies (2 décimales)
   - Les valeurs stockées ont 6+ décimales de précision

## Comment vérifier vous-même

### Méthode 1 : suite de tests
```bash
python tests/run_tests.py            # tests rapides (Python + JavaScript + navigateur si disponible)
OPPCHOVEC_SLOW=1 python tests/run_tests.py   # ajoute le rejeu complet de LISA (9999 permutations)
```

### Méthode 2 : inspecter dans le navigateur
```javascript
// Ouvrir la console du navigateur (F12)
// Taper dans la console :
console.log(indiceFinale["Ajaccio"]);
console.log(scoresParCommune["Ajaccio"]);
```

## Indice courant v2 : sources officielles de 2023 à 2025 (19 octobre 2026)

L'indice courant a été **entièrement reconstruit** à partir de sources officielles de millésimes homogènes (2023 à 2025) ; l'ancien indice v1 (millésimes 2020-2024, dont plusieurs sources inconnues) est archivé
(`Données/archive_indice_v1_2020_2024/`, étiquette Git `indice-courant-v1-2020-2024`). Audit et décisions : `RAPPORT_AUDIT_SOURCES_INDICE_COURANT`. Les composantes brutes de chaque indicateur, avec leur provenance, sont dans
`Données/indice_v2/sources_indice_v2.json`, produit par `Code/Python/construire_indice_v2.py` ; `regenerer_data_scores.py` et `exporter_sous_composantes.py` en tirent `data_scores_0_10.json` et `sous_composantes.json`
(chaque recomposition des curseurs doit redonner exactement l'indicateur : contrôle à la génération).

| Indicateur | Définition | Source | Millésime |
|---|---|---|---|
| Opp1 | niveau de diplôme moyen (1 à 7) des 18 ans et plus non scolarisés ; les 15-17 ans non scolarisés sont retirés du niveau 1 | INSEE, base communale Diplômes - Formation | recensement 2023 |
| Opp2 | indice de Theil sur les 8 catégories socioprofessionnelles des 15 ans et plus | INSEE, base Évolution et structure de la population | recensement 2023 |
| Opp3 | % de ménages avec au moins une voiture + 100 si des actifs occupés vont travailler en transports en commun (au moins une personne) + 100 pour Ajaccio, Bastia, Porto-Vecchio (liste fournie) | INSEE, bases Logement et Caractéristiques de l'emploi | recensement 2023 |
| Opp4 | (4G + débit ≥ 30 Mbit/s + fibre) / 3, en % ; 4G = population couverte par au moins un opérateur (cartes ARCEP × grille de population de 200 m) ; débit et fibre = locaux éligibles, offres filaires | ARCEP, couvertures théoriques et « Ma connexion internet » | T4 2024 |
| Cho1 | −log(personnes vivant en quartier prioritaire), 0 sans quartier | INSEE, population communale en QPV 2024 | référence 1er janvier 2020, publiée en 2025 |
| Cho2 | % de Français parmi les 18 ans et plus (proxy du droit de vote) | INSEE, tables NAT1 et POP1 | recensement 2023 |
| Vec1 | **revenu fiscal moyen par foyer fiscal** (revenu fiscal de référence total ÷ nombre de foyers fiscaux) ; 8 communes sous secret statistique : moyenne du département | DGFiP, IRCOM | revenus 2024 |
| Vec2 | (exp(−personnes par pièce) + part de maisons) / 2 | INSEE, base Logement | recensement 2023 |
| Vec3 | stabilité de l'emploi : chômeurs 0, autres contrats 0,5, CDI et non-salariés 1 | INSEE, bases Caractéristiques de l'emploi et Emploi - population active | recensement 2023 |
| Vec4 | nombre d'équipements accessibles en 20 minutes en voiture (OSRM) | INSEE, base permanente des équipements | 2024 |

**Ce qui a changé par rapport à la v1, et pourquoi :**
- **Vec1** redevient le **revenu fiscal moyen par foyer fiscal** (la variable d'origine d'OppChoVec) : la médiane Filosofi n'est pas diffusée pour 154 communes, qui recevaient la valeur de leur département ; l'IRCOM ne laisse que 8 communes sous secret statistique.
- **Opp4** : la 4G et la fibre de la v1 n'avaient pas de source retrouvable (aucune carte ARCEP ne reproduisait la 4G ; la fibre était une classe de 0 à 80 %) ; elles sont recalculées depuis l'ARCEP. Avec « au moins un opérateur », la 4G est à 94,6 % ou plus partout (moyenne 99,9 %).
- **Vec2** : le terme de confort (salle de bain + chauffage) disparaît : le chauffage valait 1 pour toutes les communes et la salle de bain n'est plus publiée par commune dans le recensement 2023 (« nd »). Ce terme étant constant, le retirer ne change pas les scores normalisés.
- **Vec3** : le recensement 2023 ne distingue plus les CDD, l'intérim, les emplois aidés et les apprentis (une seule catégorie « autre contrat ») ; ils sont regroupés au poids moyen 0,5. Simulé sur 2021, ce regroupement donne une corrélation de 0,98 avec l'ancien calcul.
- **Opp1, Opp2, Opp3, Cho2, Vec3** : même méthode, millésime 2023 au lieu de 2020-2022. **Cho1** : population officielle des quartiers prioritaires (5 778 / 1 127 / 11 027) au lieu de 62 à 69 % de celle-ci.
- **Opp3** : les trois villes à réseau de bus sont une liste fournie par la doctorante.

**Contrôles faits :** les populations de la base sont celles du recensement 2023 ; pour Opp4, le débit 2021 du fichier ARCEP a été comparé à celui de la v1 (347 communes sur 360 à ±1 point) ; pour Vec1, le calcul est le même que dans la série temporelle (test automatique) ; chaque
recomposition des sous-composantes redonne l'indicateur. Les corrélations v1 → v2 par indicateur vont de 0,31 (Opp4, dont la 4G n'était pas reproductible) à 1,00 (Cho1, Vec4) ; elles sont du même ordre que le bruit d'un recensement à l'autre (0,74 à 0,87 pour Opp1, Opp2, Opp3).

## Série temporelle 2016 → 2021 (onglet « Évolution »)

**But.** Comparer deux années. L'indice de l'appli mélange des sources de 2020 à 2022 et ne peut pas servir de point de départ : il faut les mêmes sources, les
mêmes définitions et la même échelle aux deux dates. `Code/Python/construire_serie_temporelle.py` produit `Code/WEB/serie_temporelle.json` (360 communes, 2016 et 2021).

**Un indice comparable, avec les 10 indicateurs (mis à jour le 2026-10-19).** Opp4 (4G, haut débit, fibre), Cho1 (quartiers prioritaires) et Vec4 (services à 20 minutes), d'abord exclus faute de source homogène pour 2016, sont maintenant recalculés aux deux dates (sources dans `RAPPORT_SOURCES_2016_2021_PAR_INDICATEUR`). Les sept autres sont recalculés de la même façon aux deux dates, depuis les bases communales du
recensement de l'INSEE (millésimes 2016 et 2021, qui ne se recouvrent pas : enquêtes 2014-2018 et 2019-2023) :

| Indicateur | Définition (identique aux deux dates) | Ressemblance avec l'indicateur actuel (corrélation, 2021) |
|---|---|---|
| Opp1 | niveau de diplôme moyen des 18 ans et plus non scolarisés, sur **4** niveaux (aucun diplôme ou brevet, CAP-BEP, bac, supérieur) : le millésime 2016 n'a pas le détail à 7 niveaux ; 15-17 ans non scolarisés retirés du niveau 1 | 0,91 (échelle différente) |
| Opp2 | indice de Theil sur les 8 catégories socioprofessionnelles des 15 ans et plus | 0,92 |
| Opp3 | % de ménages avec au moins une voiture + 100 si des actifs occupés utilisent les transports en commun + 100 pour Ajaccio, Bastia et Porto-Vecchio | 0,99 |
| Cho2 | % de Français parmi les **18 ans et plus**, utilisé comme **proxy du droit de vote** (il ne tient compte ni de l'inscription sur les listes électorales ni du vote des ressortissants européens aux municipales), par la méthode de `proportion_etrangers_18plus_final.py` (population de 18-24 ans en POP1B, Français 15-24 ans × 0,7 en NAT1, étrangers 25 ans et plus en NAT1) : appliquée aux deux dates, elle retrouve le fichier actuel (calculé en 2022) à 0,01 point près pour 357 communes sur 360 | 0,89 (millésimes 2021 et 2022) |
| Vec1 | **revenu fiscal moyen par foyer fiscal** (DGFiP, IRCOM : revenu fiscal de référence total ÷ nombre de foyers fiscaux, par commune) ; communes sous secret statistique : moyenne du département (11 en 2016, 12 en 2021) | 0,45 (concept différent de la médiane de l'appli) ; 2021 identique à la variante « revenu fiscal » |
| Vec2 | (exp(-personnes par pièce) + part de maisons) / 2 : même définition que l'indice courant v2 (salle de bain et chauffage retirés) | 0,96 (avec la v1) |
| Vec3 | stabilité de l'emploi : chômeurs 0, autres contrats (CDD, intérim, emplois aidés, apprentis) 0,5, CDI et non-salariés 1 : même définition que l'indice courant v2 | 0,98 (avec l'ancien calcul à 5 catégories) |
| Opp4 | (4G + débit ≥ 30 Mbit/s + fibre) ÷ 3 : 4G = population couverte par au moins un opérateur (cartes ARCEP mars 2017 et décembre 2021 × grille de population INSEE de 200 m) ; débit et fibre = locaux éligibles (Observatoire France Très Haut Débit T4 2016 ; ARCEP « Ma connexion internet » T4 2021) | 0,71 (débit : 0,97 ; 4G : 0,03, non reproductible ; fibre : classes de l'appli) |
| Cho1 | −log(personnes en quartier prioritaire), géographie 2015 aux deux dates, populations 2013 et 2018 | 0,999 |
| Vec4 | nombre d'équipements de la BPE accessibles en 20 minutes (OSRM, même réseau routier), 147 types présents et géolocalisés en 2016 et 2021 (pharmacies et gynécologues recodés rapprochés) | 0,996 |

Pour Opp2, Opp3 (voiture), Vec3, les effectifs retrouvent ceux des fichiers actuels (arrondis à l'entier près) ; la correspondance exacte des définitions a été vérifiée commune par commune
(Afa : 119 chômeurs, 4 emplois aidés, 21 ponctuels, 98 CDD, 1 472 stables, 1 714 actifs ; regroupés en 3 catégories dans la version actuelle de la série).

**Euros courants.** Vec1 est en euros de chaque année, sans correction de l'inflation (environ +6 % entre les moyennes annuelles de 2016 et 2021 d'après mes souvenirs, **non vérifié** : à confirmer sur la série INSEE de l'indice des prix). La hausse de Vec (288 communes en progression sur 360) est donc en partie nominale.

**Vec4 (services à 20 minutes).** `Code/Python/calculer_vec4_serie.py serie2021` refait le calcul de Vec4 avec le serveur OSRM local (même fichier OSM que le Vec4 actuel ; Docker avec `MSYS_NO_PATHCONV=1` sous Git Bash). Contrôle : avec la BPE 2024 complète, il retrouve **exactement** le Vec4 actuel pour les 360 communes. Pour la série, il compte, aux deux dates, uniquement les types d'équipements présents **et géolocalisés** aux deux dates : 160 types communs aux BPE 2016 (168 types) et 2021 (174), moins 15 non géolocalisés en 2016 (artisans du bâtiment, garages, gendarmerie, police, Pôle emploi, accueil du jeune enfant), plus deux regroupements de types recodés (pharmacie D301 → D307, gynécologie D204 et D205 → D214), soit **147 types**. Le réseau routier est le même (seuls les équipements changent). Résultat dans `Données/vec4_serie_2016_2021.json` : 13 616 équipements retenus en 2016, 13 320 en 2021, 304 puis 303 services accessibles en moyenne ; corrélation de 0,999 entre les deux dates et de 0,996 avec le Vec4 actuel. Les tribunaux, gares et équipements culturels recodés ne sont pas rapprochés (correspondance incertaine, équipements peu quotidiens).

**Calcul.** Normalisation min-max de chaque indicateur sur les **deux années ensemble** (échelle commune), dimension = moyenne des indicateurs disponibles, p_k de Betti sur les deux années
ensemble (Opp 0,462 ; Cho 0,240 ; Vec 0,298), indice `(1/3)(Σ p_k d_k^1,5)^(2,5/1,5)` ramené à 0-10 sur les deux années ensemble. Seuils de couleur : Jenks à
5 classes sur les deux années ensemble (mêmes seuils pour les deux cartes). Carte d'évolution : 2021 moins 2016, **Jenks à 5 classes calculé sur les 360 variations** de chaque variable (`seuils_jenks_variation`). Comme les classes ne sont pas centrées sur 0, la classe qui contient 0 est en blanc, les classes en dessous en rouge (recul) et celles au-dessus en bleu (progression) : le signe reste lisible. Le résumé chiffré garde un seuil de ±0,5 point pour compter les communes en progression, stables ou en recul.

**Résultats (indice comparable).** Moyenne 3,39 en 2016, 4,17 en 2021 (+0,79) ; 222 communes en progression de plus de 0,5 point, 106 stables, 32 en recul. Les deux tiers de la hausse viennent d'Opp4 (progrès de la 4G, du débit et de la fibre). Les corrélations entre 2016 et 2021, par indicateur, vont de 0,26 (Opp4) et 0,33
(Vec3) à 1,00 (Cho1 et Vec4, presque constants) : **les petites communes bougent beaucoup d'une année à l'autre** (quelques personnes de plus ou de moins), et une partie de l'« évolution » est du bruit. L'indice comparable 2021 et l'indice actuel
ont une corrélation de 0,88 : mêmes dix indicateurs, mais des sources et définitions qui diffèrent sur Opp1 (4 niveaux), Opp4, Cho1, Vec1 et Vec4. Voir `RAPPORT_VARIATIONS_EVOLUTION` et `RAPPORT_AUDIT_EVOLUTION`.

**Fichiers à fournir** à `construire_serie_temporelle.py <dossier>` : deux sous-dossiers `2016` et `2021`, chacun avec, sous leurs noms d'origine, les fichiers CSV du recensement (INSEE, « base des principaux indicateurs » communale),
les tables NAT1 et POP1B et le fichier IRCOM (revenus) de l'année. 2016 : `base-cc-evol-struct-pop-2016`, `base_cc_logement-2016`, `base-cc-carac-emploi-2016`, `base-cc-emploi-pop-active-2016`, `base-cc-diplomes-formation-2016`, `BTT_TD_NAT1_2016.txt`,
`BTT_TD_POP1B_2016.txt`, `ircom_communes_complet_revenus_2016.xlsx` (DGFiP ; pages INSEE 4171334, 4171415, 4171449, 4171446, 4171395, 4171501, 4171341). 2021 : `base-cc-evol-struct-pop-2021`, `base-cc-logement-2021`, `base-cc-caract_emp-2021`, `base-cc-emploi-pop-active-2021`,
`base-cc-diplomes-formation-2021`, `TD_NAT1V1_2021.csv`, `TD_POP1B_2021.csv` (pages 8201904, 8202349, 8200707, 8202916, 8202319, 8202752, 8202264) `ircom_communes_complet_revenus_2021.xlsx` (DGFiP). Opp4, Cho1 et Vec4 sont lus dans `Données/opp4_serie_2016_2021.json`, `Données/qpv2015_population.json` et `Données/vec4_serie_2016_2021.json` (construits par `construire_opp4_serie.py`, `calculer_couverture_4g.py` et `calculer_vec4_serie.py serie2021`).

## Échelles utilisées

### Indicateurs bruts (NON normalisés)
- **Opp1** : 1 à 7 (niveau de diplôme moyen des 18 ans ou plus non scolarisés, recensement INSEE 2020 ; observé 2,00 à 4,57 : voir la section « Opp1 » ci-dessous)
- **Opp2** : 0 à 1.5 (indice de Theil ; maximum observé 1,437)
- **Opp3** : 0 à 300 (mobilité : % de ménages avec voiture, +100 si transports en commun, +100 si réseau de bus urbain)
- **Opp4** : 0 à 100 (connectivité : moyenne de la 4G, du débit de 30 Mbit/s et de la fibre, en %)
- **Cho1** : -10 à 0 (-log du nombre de personnes en quartier prioritaire ; 0 si aucune)
- **Cho2** : 0 à 100 (proxy du droit de vote : part de Français parmi les 18 ans et plus, en %)
- **Vec1** : 10000 à 60000 (revenu fiscal moyen par foyer fiscal, en € ; observé 12 746 à 56 621)
- **Vec2** : 0 à 1 (qualité du logement)
- **Vec3** : 0 à 1 (stabilité de l'emploi : moyenne pondérée des parts d'actifs par type de contrat)
- **Vec4** : 0 à 5300 (nombre de services accessibles en moins de 20 minutes ; maximum observé 5278)

### Scores avant mise à l'échelle
- **Score_Opp** : 0 à 1
- **Score_Cho** : 0 à 1
- **Score_Vec** : 0 à 1
- **OppChoVec** : 0 à 2.09 (maximum théorique 3^(2/3) ≈ 2,08)

### Scores normalisés (0-10)
- **Score_Opp_0_10** : 0 à 10
- **Score_Cho_0_10** : 0 à 10
- **Score_Vec_0_10** : 0 à 10
- **OppChoVec_0_10** : 0 à 10 (indice final)
