# Tests de l'application OppChoVec

Une suite automatique qui vérifie que **le code fonctionne**, que **les résultats restent cohérents avec ceux d'avant**, que tout est
**recalculable** depuis les sources, et que **la documentation dit vrai**.

```bash
python tests/run_tests.py            # tout : Python + JavaScript + navigateur   (~1,5 min)
python tests/run_tests.py --rapide   # sans le navigateur                         (~35 s)
python tests/run_tests.py --e2e      # uniquement le navigateur
python tests/run_tests.py --lent     # + rejeu complet de LISA (9999 permutations, plusieurs minutes)
python tests/run_tests.py -v         # détail des échecs
python tests/mutations.py            # « test des tests » : voir plus bas
```

Les tests ne modifient **aucun** fichier du dépôt (les scripts de régénération sont rejoués sur une copie temporaire).

## Prérequis

| Couche | Il faut |
|---|---|
| Python | Python 3.10+ ; `numpy pandas openpyxl scipy scikit-learn jenkspy geopandas libpysal esda matplotlib`. Un module absent fait *ignorer* les tests qui en dépendent (et le dit), jamais échouer. |
| JavaScript | Node 20+ (testé avec 22). Aucune dépendance npm : `node:test`, `node:vm`. |
| Navigateur | `cd tests && npm install` (playwright-core) et un Chromium (cache Playwright, ou variable `CHROME_PATH`). Sans cela, les tests e2e sont ignorés. Les bibliothèques Leaflet et Chart.js sont chargées depuis leur CDN : il faut un accès réseau. |
| Sources brutes | Les fichiers xlsx/csv par indicateur ne sont pas dans le dépôt. Définir `OPPCHOVEC_SOURCES` = dossier « Stage Ambroise » contenant `Données/Corse_Commune/` (par défaut, `C:\These\Données2\visualisation_oppchovec_1111\Stage Ambroise`). Sans elles, les tests de recalcul depuis les sources sont ignorés. |

## Ce qui est vérifié

| Fichier | Question posée |
|---|---|
| `python/test_01_integrite_donnees.py` | Les 360 communes sont-elles complètes, finies, dans leurs bornes, avec les mêmes noms que le GeoJSON et tous les fichiers dérivés ? |
| `python/test_02_formules_et_recalcul.py` | Tout `data_scores_0_10.json` se recalcule-t-il depuis les 10 indicateurs avec une implémentation indépendante ? p_k de Betti (somme 1, invariance d'échelle) ? Monotonie de l'indice ? Fonctions de `oppchovec.py` ? |
| `python/test_03_fichiers_derives.py` | Seuils de Jenks = `jenkspy` ; CAH = Ward recalculé ; LISA = I de Moran, I local et quadrants recalculés avec `esda` ; fichier chatbot ; sous-composantes qui recomposent exactement les indicateurs |
| `python/test_04_non_regression.py` | Les résultats actuels vs l'état **avant** la correction des poids Vec3 : seuls les champs attendus ont changé, avec l'ampleur attendue |
| `python/test_05_recalcul_depuis_sources.py` | Chaque indicateur se retrouve-t-il depuis les fichiers sources ? Les scripts de régénération rejoués redonnent-ils les fichiers du dépôt ? Refusent-ils d'écrire des données incohérentes ? |
| `python/test_06_documentation.py` | Les `.md` disent-ils vrai (fichiers cités, tableaux de seuils, échelles, exemples, procédure) ? |
| `python/test_07_coherence_du_code.py` | Poids et constantes dupliqués (Python / JS / scripts) identiques ? Fichiers et identifiants du DOM référencés existants ? |
| `python/test_08_js_vs_python.py` | L'appli (script.js réel) contre un recalcul Python indépendant : état de base, seuils de Jenks, et 30 scénarios de modification aléatoires |
| `python/test_09_tableaux_excel.py` | Les fichiers Excel proposés par le site (`downloads/`) reflètent-ils les données actuelles ? Les scripts `gen_*.py` rejoués sur une copie y écrivent-ils (et nulle part ailleurs) ? |
| `python/test_11_variante_vec1.py` | Variante de Vec1 (revenu fiscal moyen, IRCOM) : indice et corrélations recalculés en Python (scipy) = ceux du JS ; 154 communes à valeur départementale dans Vec1 actuel ; rejeu du script si `OPPCHOVEC_IRCOM` désigne `ircom_communes_complet_revenus_2021.xlsx` |
| `python/test_12_serie_temporelle.py` | Série temporelle 2016 / 2021 (onglet Évolution) : scores, p_k de Betti et seuils de Jenks recalculés indépendamment depuis les indicateurs bruts du fichier ; rejeu du script si `OPPCHOVEC_SERIE` désigne le dossier des sources |
| `js/*.test.js` | La logique de `script.js` dans un bac à sable Node : chargement, curseurs, recalcul, bascule p_k, sous-composantes |
| `e2e/*.e2e.test.js` | Dans un vrai navigateur : cartes (couleur de chaque commune), histogramme, top 10, panneau commune, tous les onglets, coefficients de corrélation |

### Comment le JavaScript est testé sans navigateur
`tests/js/helpers/charger_script.js` charge le **vrai** `script.js` (et `lisa_data*.js`, `cah_data.js`) dans un contexte `node:vm` avec un DOM,
Leaflet et Chart.js factices, puis exécute le chargement automatique de la page. Le DOM factice est fidèle sur un point important :
`getElementById` renvoie `null` pour un identifiant absent de la page. Les `<input>` du panneau commune sont recréés à partir du HTML
réellement produit par `afficherCommune`.

## Références de non-régression (« ce qu'on avait avant »)

`tests/fixtures/` contient deux états figés de l'historique, reconstruits depuis git par `generer_baseline.py` :
- `baseline_*` : **avant la correction des poids de Vec3** (commit `4438162`, 2026-10-11) ;
- `avant_opp1_*` : **après Vec3 et avant le remplacement d'Opp1** par le niveau de diplôme INSEE (commit `9c8a310`, 2026-10-13).
Chacun comprend `*_data_scores_0_10.json` (copie exacte) et `*_derives.json` (seuils Jenks, clusters LISA et CAH). `test_04` compare `baseline` -> `avant_opp1` (empreinte de la correction Vec3) puis `avant_opp1` -> état actuel (empreinte du remplacement d'Opp1 : seuls `Opp1`, `Score_Opp`, `Score_Opp_0_10`, `OppChoVec`, `OppChoVec_0_10` changent ; Cho et Vec sont identiques au bit près).

Cette référence est corroborée par trois archives du dépôt qui lui sont identiques (aux noms « La Porta » / « L'Île-Rousse » près) :
`Code/Python/data_scores_0_10.json`, `Code/WEB/data_scores_0_10_backup_20251112_204530.json` et `Code/Python/data_scores_1_10.json`.
Surtout, la formule recalculée *indépendamment* reproduit ces résultats d'origine à 1e-9 : la référence n'est pas qu'une photographie.

Les fichiers plus anciens (`Code/data_scores.json`, `data_scores_normalisation_elem.json`, `Code/Python/data_scores.json`,
`oppchovec_resultats_V.xlsx`) relèvent d'une méthode antérieure (corrélation de rang avec l'indice actuel de 0,40 à 0,74) : ils ne sont **pas**
des références valables et ne sont pas utilisés.

Les bornes de `test_04` sont l'empreinte **mesurée** de chaque changement, avec une petite marge : pour Vec3 corrélation de rang ≥ 0,999, écart max 0,25,
0 à 3 communes LISA qui changent ; pour Opp1 (changement bien plus profond, voulu) corrélation de rang du Score_Opp ≥ 0,7 (mesuré 0,76), de l'indice ≥ 0,90
(égal, mesuré 0,93) / 0,80 (Betti, 0,84), au plus 30 / 10 / 40 / 25 communes LISA qui changent (mesuré 20 / 5 / 30 / 15). Pour changer volontairement de référence (nouvelle correction de méthode) : relancer
`fixtures/generer_baseline.py` avec le nouveau commit de référence et mettre à jour ces bornes, en le disant ici.

## Dettes connues (signalées, pas cachées)

Elles sont marquées « échec attendu » (Python) : elles n'échouent pas la suite, mais apparaissent dans le bilan, et le jour où le défaut est
corrigé le test le signale (« succès inattendu ») pour qu'on retire la marque.

| Dette | Où |
|---|---|
| `oppchovec.py` n'est pas synchronisé avec le JSON pour **Opp4** (fibre absente), **Cho2** (lit `Cho2.xlsx` au lieu de `Cho2_francais_18plus.xlsx`) et **Opp1** (lit `Opp1.xlsx`, une suite artificielle 5,75 ; 5,76… sans rapport avec l'éducation, au lieu du niveau de diplôme INSEE) | `test_05`, 3 tests |
| `stage_ambroise/Code/WEB/index.html` est une copie plus ancienne de `index.html` (il lui manque 3 onglets) | `test_07` |

Corrigé le 2026-10-13 : **Opp1** ne vient plus de `Opp1.xlsx` (suite artificielle) mais du recensement INSEE (`Données/education_communes_opp1.json`, voir `Code/VERIFICATION_COHERENCE_DONNEES.md`). Tests : `test_05` (`Opp1DepuisLeRecensement` : cohérence interne, 18+ = 15+ moins les 15-17 ans, rejeu du calcul si `OPPCHOVEC_INSEE_DIPLOMES` désigne `base-ic-diplomes-formation-2020.xlsx` ; `RegenererOpp1EstIdempotent`) et `test_04`. Au passage, les scripts CAH de la procédure documentée lisaient `../WEB/Commune_Corse.geojson`, un fichier qui n'existe pas dans le dépôt : ils lisent maintenant `../../Données/`.

Dettes corrigées le 2026-10-12, conservées comme tests de non-régression :
- course `invalidateSize` (150 ms) sur une carte détruite par la bascule p_k : fonction `invaliderTailleApres` (6 minuteries) ; test e2e sur les 3 sous-onglets de Corrélation ;
- croix ✕ de la bulle d'info masquée par le CSS : règle `.indicateur-row button:not(.info-button):not(.info-close-button)` ; test e2e qui la referme ;
- code mort de l'onglet « Numbered » (erreur console à chaque chargement) supprimé : la page se charge désormais **sans aucune erreur**, l'e2e n'en tolère plus
  aucune, et `test_07` vérifie que tout `[data-tab="x"]` de `script.js` existe dans `index.html` ;
- `graphique_ecarts_types_cah.py` produit désormais le graphique à 5 classes par défaut.
- **chemins absolus** : les 6 scripts `gen_*.py` de la racine lisaient et écrivaient dans un autre clone (`c:/These/oppchovec_visu/`) et dans Téléchargements ;
  ils passent maintenant par `chemins.py` (relatif au dépôt, `OPPCHOVEC_RACINE` pour les rejouer sur une copie). Les tableaux Excel ont été régénérés :
  `downloads/` (servi par le site) avait gardé l'ancien classement d'avant la correction Vec3, ce que `test_09` détecte maintenant ; `gen_lisa_betti.py`
  (Queen, obsolète) refuse de tourner sans `--ancienne-methode` ;

Autres points d'attention, sans test qui échoue :
- `FICHIERS_A_SUPPRIMER.md` et `README_OSRM_LOCAL.md` sont des documents historiques dont les affirmations ne sont pas vérifiées.
- Deux communes ont un nom différent dans les anciennes archives (« La Porta » / « L'Île-Rousse » au lieu de « Porta » / « Île-Rousse »).

## Le « test des tests » : `mutations.py`

Une suite qui passe ne prouve rien tant qu'on n'a pas vu qu'elle sait échouer. `tests/mutations.py` copie le projet, y introduit **une faute à la
fois** (donnée altérée, constante modifiée, formule inversée, ancien défaut réintroduit, document périmé, tri inversé…) et vérifie que la suite devient
rouge, en indiquant quelle couche a détecté la faute. Une mutation *non détectée* est une lacune à combler. Voir `python tests/mutations.py --liste`.
Résultat au 2026-10-12 : **37 mutations sur 37 détectées** (dont 6 qui réintroduisent des défauts corrigés ce jour-là). La première campagne avait révélé deux lacunes, comblées depuis : un test JS qui ne dépassait
jamais l'échelle corse (donc incapable de voir des bornes recalculées) et un test de valeur de curseur trop peu sensible. Une mutation « non concluante »
signifie que la suite a été interrompue (ce n'est pas une absence de détection) : relancer avec `--seulement`.

## Ajouter un test
- Un invariant sur les données ou les scripts → `tests/python/test_NN_*.py` (`unittest`, `common.py` fournit les chemins et une implémentation
  de référence indépendante).
- Un comportement de `script.js` → `tests/js/*.test.js` (`helpers/outils.js` : `chargerApp`, `afficherCommune`, `photo`).
- Un comportement visible → `tests/e2e/*.e2e.test.js` (`helpers/contexte.js` : `avecAppli`, `couleursCarte`…).
- Écrire d'abord le test qui échoue, puis corriger : c'est ainsi qu'a été trouvé le défaut des curseurs (valeur normalisée à 15 chiffres par le
  navigateur → bruit de 1e-16 au « Recalculer » à vide, Afa passant à 10,000000000000002).
