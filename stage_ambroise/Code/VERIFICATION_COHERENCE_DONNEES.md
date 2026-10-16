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
| **OppChoVec** | 0.504193 | 0.504193 | **0.000000** |
| **Score_Opp** | 0.676436 | 0.676436 | **0.000000** |
| **Score_Cho** | 0.429369 | 0.429369 | **0.000000** |
| **Score_Vec** | 0.582122 | 0.582122 | **0.000000** |

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

## Opp1 — niveau d'éducation (recensement INSEE 2020)

**Définition.** Niveau de diplôme moyen des personnes de **18 ans ou plus non scolarisées** de la commune, sur une échelle de 1 à 7 :
1 aucun diplôme ou CEP, 2 BEPC (brevet des collèges), 3 CAP-BEP, 4 baccalauréat, 5 bac + 2, 6 bac + 3 ou 4, 7 bac + 5 ou plus.
`Opp1 = Σ niveau × effectif du niveau / Σ effectifs`. Valeurs observées : 2,00 (Popolasca) à 4,57 (Pigna), moyenne 3,40.

**Source.** INSEE, Recensement de la population 2020, base infracommunale « Diplômes - Formation »
(`base-ic-diplomes-formation-2020`, géographie au 01/01/2022). Les 404 IRIS de Corse sont additionnés par commune : on retrouve les
360 communes de l'appli. Le résultat est versionné dans `stage_ambroise/Données/education_communes_opp1.json` (effectifs par niveau
et provenance de chaque commune) ; il est calculé par `Code/Python/calculer_education_opp1.py` puis injecté dans
`data_scores_0_10.json` par `Code/Python/regenerer_opp1.py`.

**Pourquoi 18 ans et plus.** L'INSEE publie les diplômes de la population de 15 ans ou plus non scolarisée, sans âge individuel. Pour
ne garder que les majeurs on retire un **effectif** : les 15-17 ans non scolarisés (population des 15-17 ans moins population
scolarisée des 15-17 ans, deux colonnes du même fichier). **Hypothèse** : ils n'ont aucun diplôme ou seulement le CEP (niveau 1) ; on
les retire de cette catégorie. Ils représentent 500 personnes en Corse, 0,19 % de l'effectif (2,1 % au maximum dans une commune) :
quelle que soit l'hypothèse (niveau 1, 2 ou 3), le niveau d'une commune varie d'au plus 0,055 point sur 7 et le classement des communes
ne change pratiquement pas (corrélation de rang ≥ 0,9998).

**Limites.**
- La population de référence exclut les personnes encore scolarisées (étudiants de 18 ans ou plus) : définition de l'INSEE.
- 146 communes comptent moins de 100 personnes concernées : leur valeur est instable, car quelques diplômes de plus ou de moins déplacent
  nettement la moyenne. (Dans les communes de moins de 10 000 habitants le recensement est exhaustif mais étalé sur cinq ans : un
  millésime regroupe les enquêtes de N-2 à N+2 ; ce n'est pas un sondage.)
- Millésime 2020, plus ancien que certains autres indicateurs.

**Historique.** Jusqu'au 2026-10-13, Opp1 venait de `Opp1.xlsx`, qui contenait en réalité une **suite artificielle** (5,75 ; 5,76 ; …
5,99 ; 5,1 ; 5,101 ; … 5,434, dans l'ordre des codes communes) sans rapport avec l'éducation (corrélation de 0,01 avec le niveau de
diplôme INSEE). Le rapport de stage prévoyait Σ (niveau de diplôme de la tranche d'âge × part de la tranche dans la population), avec
un niveau de diplôme connu seulement à l'échelle régionale ; la donnée communale directe de l'INSEE remplace cette approximation.
Conséquences du remplacement : Score_Opp (corrélation de rang 0,76 avec l'ancien), indice OppChoVec (0,93 en mode égal, 0,84 en mode
Betti), p_k de Betti (Opp 0,534 -> 0,458), seuils de Jenks, LISA (20 / 5 / 30 / 15 communes changent de cluster), CAH, classement
Excel. La commune la mieux classée (Afa) reste la même ; la moins bien classée passe d'Érone à Aghione.

## Vec1 — revenu : limite actuelle et variante « revenu fiscal moyen »

**Vec1 actuel.** Médiane du niveau de vie par commune, Filosofi 2021 (INSEE). Cette médiane n'est pas diffusée pour les petites communes (le fichier
« niveau de vie médian » de data.gouv.fr, qui reprend Filosofi, a une valeur vide pour exactement les mêmes 154 communes). Ces 154 communes (108 en
Haute-Corse, 46 en Corse-du-Sud, 10 à 147 personnes de 15 ans ou plus, 38 foyers fiscaux au médian) ont reçu **la valeur de leur département** :
21 460 € (Haute-Corse) et 23 420 € (Corse-du-Sud). Soit 43 % des communes avec un Vec1 qui ne les distingue pas. Un test le fige
(`test_11_variante_vec1.py`).

**Variante.** `Vec1 = revenu fiscal moyen par foyer fiscal` = revenu fiscal de référence total de la commune / nombre de foyers fiscaux, DGFiP, IRCOM, revenus
2021 (même année que Filosofi 2021). Fichier : `Code/WEB/vec1_revenu_fiscal.json`, produit par `Code/Python/calculer_revenu_fiscal_vec1.py` depuis
`ircom_communes_complet_revenus_2021.xlsx` (data.gouv.fr, « L'impôt sur le revenu par collectivité territoriale », un fichier par année de 2014 à 2024).
La DGFiP ne communique pas les données de 12 communes (secret statistique) : elles reçoivent la valeur de leur département (marquées
`estime_departement`). Dans l'appli (version recherche), la case « 6. Variante de Vec1 » remplace Vec1 par cette valeur partout (cartes, seuils, fiche
commune, bornes des curseurs) ; LISA et CAH ne sont pas recalculés ; les modifications de curseurs sont abandonnées à chaque bascule.

**Ce que ça change** (mesuré le 2026-10-13, 360 communes) :

| | p_k de Betti | p_k égaux |
|---|---|---|
| Indice OppChoVec, corrélation de Pearson / de rang | 0,986 / 0,975 | 0,983 / 0,973 |
| Score Vec, corrélation de rang | 0,85 | 0,85 |
| Vec1 seul, Pearson / rang | 0,45 / 0,35 | 0,45 / 0,35 |
| Communes qui changent de classe de couleur (Jenks) | 41 | 43 |
| Écart de rang médian | 11 | 11 |

L'indice final change donc peu (Vec1 pèse 1/4 de Vec, lui-même 1/3 de l'indice), mais les deux Vec1 se ressemblent peu (rang 0,35) : la médiane du niveau
de vie de 154 communes n'est pas une mesure. Sur les 206 communes où Filosofi est diffusé, la corrélation de rang avec le revenu fiscal moyen est de 0,67 (concepts
différents : moyenne et non médiane, par foyer fiscal et non par unité de consommation, foyers non imposés inclus).

**Limites de la variante.** Les communes concernées ont en médiane 38 foyers fiscaux : un seul gros revenu déplace la moyenne (valeurs extrêmes
observées : 7 325 € à 66 166 €). Le revenu moyen n'est pas la médiane (il est tiré par les hauts revenus). À ne pas présenter aux décideurs avant arbitrage.

**Précision d'une prédiction de la médiane.** Pour mémoire, une régression de la médiane Filosofi sur le revenu moyen DGFiP (et le département), évaluée en
laissant chaque commune de côté, fait une erreur typique de 1 810 € (1 675 € pour les communes de moins de 400 foyers) contre 2 260 € pour la valeur
départementale ; l'écart réel entre communes est de 2 390 €. Cette estimation n'est pas utilisée dans l'appli.

## Série temporelle 2016 → 2021 (onglet « Évolution »)

**But.** Comparer deux années. L'indice de l'appli mélange des sources de 2020 à 2022 et ne peut pas servir de point de départ : il faut les mêmes sources, les
mêmes définitions et la même échelle aux deux dates. `Code/Python/construire_serie_temporelle.py` produit `Code/WEB/serie_temporelle.json` (360 communes, 2016 et 2021).

**Un indice comparable, pas l'indice complet : 7 indicateurs sur 10.** Exclus faute de source communale homogène pour 2016 : **Opp4** (4G, haut débit, fibre ; l'ARCEP ne
publie pas de série communale équivalente que j'aie pu obtenir), **Cho1** (quartiers prioritaires : géographie de 2015 puis de 2024, pas de série), **Vec4** (services à 20 minutes :
accessibilité calculée avec le serveur d'itinéraires local et la BPE 2024). Les 7 retenus sont recalculés de la même façon aux deux dates, depuis les bases communales du
recensement de l'INSEE (millésimes 2016 et 2021, qui ne se recouvrent pas : enquêtes 2014-2018 et 2019-2023) :

| Indicateur | Définition (identique aux deux dates) | Ressemblance avec l'indicateur actuel (corrélation, 2021) |
|---|---|---|
| Opp1 | niveau de diplôme moyen des 18 ans et plus non scolarisés, sur **4** niveaux (aucun diplôme ou brevet, CAP-BEP, bac, supérieur) : le millésime 2016 n'a pas le détail à 7 niveaux ; 15-17 ans non scolarisés retirés du niveau 1 | 0,91 (échelle différente) |
| Opp2 | indice de Theil sur les 8 catégories socioprofessionnelles des 15 ans et plus | 0,92 |
| Opp3 | % de ménages avec au moins une voiture + 100 si des actifs occupés utilisent les transports en commun + 100 pour Ajaccio, Bastia et Porto-Vecchio | 0,99 |
| Cho2 | % de Français parmi les **18 ans et plus**, utilisé comme **proxy du droit de vote** (il ne tient compte ni de l'inscription sur les listes électorales ni du vote des ressortissants européens aux municipales), par la méthode de `proportion_etrangers_18plus_final.py` (population de 18-24 ans en POP1B, Français 15-24 ans × 0,7 en NAT1, étrangers 25 ans et plus en NAT1) : appliquée aux deux dates, elle retrouve le fichier actuel (calculé en 2022) à 0,01 point près pour 357 communes sur 360 | 0,89 (millésimes 2021 et 2022) |
| Vec1 | **médiane du niveau de vie** (Filosofi, INSEE), comme l'actuel ; quand elle n'est pas diffusée, médiane du département de la même année (154 communes aux deux dates, 148 les mêmes) | 1,00 (identique pour les 360 communes en 2021) |
| Vec2 | (exp(-personnes par pièce) + (salle de bain + chauffage)/2 + part de maisons)/3, chauffage = 1 comme dans les données actuelles | 0,96 |
| Vec3 | stabilité de l'emploi : chômeurs 0, emplois aidés 0,25, intérim et apprentis 0,5, CDD 0,75, CDI et non-salariés 1, pondérés par les effectifs | 0,999 |

Pour Opp2, Opp3 (voiture), Vec3, les effectifs retrouvent ceux des fichiers actuels (arrondis à l'entier près) ; la correspondance exacte des définitions a été vérifiée commune par commune
(Afa : 119 chômeurs, 4 emplois aidés, 21 ponctuels, 98 CDD, 1 472 stables, 1 714 actifs).

**Euros courants.** Vec1 est en euros de chaque année, sans correction de l'inflation (environ +6 % entre les moyennes annuelles de 2016 et 2021 d'après mes souvenirs, **non vérifié** : à confirmer sur la série INSEE de l'indice des prix). La hausse de Vec (306 communes en progression sur 360) est donc en grande partie nominale.

**Vec4 (services à 20 minutes), calcul comparable fait mais pas encore dans l'indice.** `Code/Python/calculer_vec4_serie.py` refait le calcul de Vec4 avec le serveur OSRM local (même fichier OSM que le Vec4 actuel). Contrôle : avec la BPE 2024 complète,
il retrouve **exactement** le Vec4 actuel pour les 360 communes. Pour la série, il compte, aux deux dates, uniquement les types d'équipements présents **et géolocalisés** aux deux dates (105 types : la BPE 2016 a 153 types géolocalisés, la BPE 2024 en a 212 ; 15 types, surtout des artisans du bâtiment,
ne sont pas géolocalisés en 2016) et le réseau routier est le même (seuls les équipements changent). Résultat dans `Données/vec4_serie_temporelle.json` : 9 611 équipements en 2016, 9 409 en 2024, 208 services accessibles en moyenne aux deux dates ; corrélation de 0,998 entre les deux dates
et de 0,995 entre la version restreinte de 2024 et le Vec4 actuel ; 163 communes en hausse, 167 en baisse, 30 inchangées (écarts de quelques dizaines à une centaine de services, sans tendance). **Seconde date = 2024**, pas 2021 : je n'ai pas trouvé de lien de téléchargement
pour les BPE 2020 et 2021 géolocalisées, et la BPE 2021 rompt la série (la source SIRENE est remplacée par SIRUS, d'où une baisse d'effectif). À intégrer dans l'onglet Évolution après arbitrage.

**Calcul.** Normalisation min-max de chaque indicateur sur les **deux années ensemble** (échelle commune), dimension = moyenne des indicateurs disponibles, p_k de Betti sur les deux années
ensemble (Opp 0,447 ; Cho 0,338 ; Vec 0,215 : Cho n'a qu'un indicateur, donc une dispersion forte), indice `(1/3)(Σ p_k d_k^1,5)^(2,5/1,5)` ramené à 0-10 sur les deux années ensemble. Seuils de couleur : Jenks à
5 classes sur les deux années ensemble (mêmes seuils pour les deux cartes). Carte d'évolution : 2021 moins 2016, **Jenks à 5 classes calculé sur les 360 variations** de chaque variable (`seuils_jenks_variation`). Comme les classes ne sont pas centrées sur 0, la classe qui contient 0 est en blanc, les classes en dessous en rouge (recul) et celles au-dessus en bleu (progression) : le signe reste lisible. Le résumé chiffré garde un seuil de ±0,5 point pour compter les communes en progression, stables ou en recul.

**Résultats (indice comparable).** Moyenne 5,10 en 2016, 5,59 en 2021 (+0,49) ; 162 communes en progression de plus de 0,5 point, 140 stables, 58 en recul. Les corrélations entre 2016 et 2021, par indicateur, vont de 0,33
(Vec3) à 0,88 (Vec2) : **les petites communes bougent beaucoup d'une année à l'autre** (quelques personnes de plus ou de moins), et une partie de l'« évolution » est du bruit. L'indice comparable 2021 et l'indice actuel
ont une corrélation de 0,78 : ce ne sont pas le même indice (7 indicateurs au lieu de 10, Opp1 sur 4 niveaux, Cho2 de 2021 et non de 2022).

**Fichiers à fournir** à `construire_serie_temporelle.py <dossier>` : deux sous-dossiers `2016` et `2021`, chacun avec, sous leurs noms d'origine, les fichiers CSV du recensement (INSEE, « base des principaux indicateurs » communale),
les tables NAT1 et POP1B et la médiane du niveau de vie de l'année. 2016 : `base-cc-evol-struct-pop-2016`, `base_cc_logement-2016`, `base-cc-carac-emploi-2016`, `base-cc-emploi-pop-active-2016`, `base-cc-diplomes-formation-2016`, `BTT_TD_NAT1_2016.txt`,
`BTT_TD_POP1B_2016.txt`, `base-cc-filosofi-2016.xls` (pages INSEE 4171334, 4171415, 4171449, 4171446, 4171395, 4171501, 4171341, 4190004 ; lecture du `.xls` : bibliothèque `xlrd`). 2021 : `base-cc-evol-struct-pop-2021`, `base-cc-logement-2021`, `base-cc-caract_emp-2021`, `base-cc-emploi-pop-active-2021`,
`base-cc-diplomes-formation-2021`, `TD_NAT1V1_2021.csv`, `TD_POP1B_2021.csv` (pages 8201904, 8202349, 8200707, 8202916, 8202319, 8202752, 8202264) et, de data.gouv.fr (« Niveau de vie médian »), `mediane-niveau-vie-com.csv` et `mediane-niveau-vie-dep.csv`.

## Échelles utilisées

### Indicateurs bruts (NON normalisés)
- **Opp1** : 1 à 7 (niveau de diplôme moyen des 18 ans ou plus non scolarisés, recensement INSEE 2020 ; observé 2,00 à 4,57 : voir la section « Opp1 » ci-dessous)
- **Opp2** : 0 à 1.1 (indice de Theil ; maximum observé 1,016)
- **Opp3** : 0 à 300 (mobilité : % de ménages avec voiture, +100 si transports en commun, +100 si réseau de bus urbain)
- **Opp4** : 0 à 100 (connectivité : moyenne de la 4G, du haut débit et de la fibre, en %)
- **Cho1** : -10 à 0 (-log du nombre de personnes en quartier prioritaire ; 0 si aucune)
- **Cho2** : 0 à 100 (proxy du droit de vote : part de Français parmi les 18 ans et plus, en %)
- **Vec1** : 15000 à 30000 (revenu médian, en €)
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
