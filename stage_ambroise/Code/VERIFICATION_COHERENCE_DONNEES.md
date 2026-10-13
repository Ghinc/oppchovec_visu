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

## Échelles utilisées

### Indicateurs bruts (NON normalisés)
- **Opp1** : 1 à 7 (niveau de diplôme moyen des 18 ans ou plus non scolarisés, recensement INSEE 2020 ; observé 2,00 à 4,57 : voir la section « Opp1 » ci-dessous)
- **Opp2** : 0 à 1.1 (indice de Theil ; maximum observé 1,016)
- **Opp3** : 0 à 300 (mobilité : % de ménages avec voiture, +100 si transports en commun, +100 si réseau de bus urbain)
- **Opp4** : 0 à 100 (connectivité : moyenne de la 4G, du haut débit et de la fibre, en %)
- **Cho1** : -10 à 0 (-log du nombre de personnes en quartier prioritaire ; 0 si aucune)
- **Cho2** : 0 à 100 (droit de vote, en %)
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
