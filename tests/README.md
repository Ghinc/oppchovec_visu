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
| Sources brutes | Les extraits des bases INSEE, fichiers ARCEP, IRCOM… de l'indice v2 sont volumineux et hors dépôt (`C:\These\Données2\indice_v2_sources`, voir son `LISEZ_MOI.md`). Définir `OPPCHOVEC_V2` pour un autre emplacement. Sans eux, le test qui rejoue `construire_indice_v2.py` est ignoré ; les composantes brutes versionnées (`Données/indice_v2/sources_indice_v2.json`) suffisent aux autres tests de recalcul. |

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
| `python/test_12_serie_temporelle.py` (classes `SerieRobuste`, `FiabiliteEtDrapeauTransports`) | Variante Opp3 robuste (mêmes vérifications que la série), drapeau conforme à l'effectif brut, 78 changements contre 27, bruit décroissant avec la taille de la commune, populations de la série = populations officielles |
| `python/test_13_epci.py` | EPCI : 19 EPCI, 360 communes une seule fois, populations (somme par EPCI, millésimes des indicateurs, population 2022 = fichier du projet), contours qui couvrent leurs communes |
| `js/echelle_epci.test.js`, `e2e/echelle_epci.e2e.test.js` | Case « EPCI » de la barre du haut : unités de l'appli = 19 EPCI (population / commune), valeurs = agrégation, retour exact aux communes, p_k suivi, fiche de l'EPCI dans le panneau, top 10 et histogramme, bandeaux sur les analyses communales, parangons restés communaux |
| `js/epci.test.js`, `e2e/epci.e2e.test.js` | Onglet EPCI : agrégation pro rata / moyenne simple sur cas calculés à la main, **un EPCI d'une seule commune retrouve exactement les scores de la commune** (p_k Betti et égaux), cartes colorées par les classes de Jenks, case à cocher, tableau, fiche, suivi du mode p_k |
| `python/test_12_serie_temporelle.py` | Série temporelle 2016 / 2021 (onglet Évolution) : scores, p_k de Betti et seuils de Jenks recalculés indépendamment depuis les indicateurs bruts du fichier ; rejeu du script si `OPPCHOVEC_SERIE` désigne le dossier des sources |
| `js/*.test.js` | La logique de `script.js` dans un bac à sable Node : chargement, curseurs, recalcul, bascule p_k, sous-composantes |
| `e2e/*.e2e.test.js` | Dans un vrai navigateur : cartes (couleur de chaque commune), histogramme, top 10, panneau commune, tous les onglets, coefficients de corrélation |

### Comment le JavaScript est testé sans navigateur
`tests/js/helpers/charger_script.js` charge le **vrai** `script.js` (et `lisa_data*.js`, `cah_data.js`) dans un contexte `node:vm` avec un DOM,
Leaflet et Chart.js factices, puis exécute le chargement automatique de la page. Le DOM factice est fidèle sur un point important :
`getElementById` renvoie `null` pour un identifiant absent de la page. Les `<input>` du panneau commune sont recréés à partir du HTML
réellement produit par `afficherCommune`.

## Références de non-régression (« ce qu'on avait avant »)

`tests/fixtures/` contient deux états figés de `data_scores_0_10.json`, reconstruits depuis git par `generer_baseline.py` :
- `baseline_data_scores_0_10.json` : **avant la correction des poids de Vec3** (commit `4438162`, 2026-10-11), état d'origine du pipeline Python ;
- `v1_data_scores_0_10.json` : **l'indice courant v1** (millésimes 2020-2024), à l'étiquette Git `indice-courant-v1-2020-2024`, avant son remplacement par la v2 (sources officielles 2023-2025) le 2026-10-19.
`test_04` vérifie que la formule reproduit la référence v1, puis documente ce que le passage à la v2 a changé (Vec4 et les communes inchangés, Cho1 plus bas, corrélations de rang par indicateur) et ce qu'il a laissé intact.

La référence `baseline` est corroborée par trois archives du dépôt qui lui sont identiques (aux noms « La Porta » / « L'Île-Rousse » près) :
`Code/Python/data_scores_0_10.json`, `Code/WEB/data_scores_0_10_backup_20251112_204530.json` et `Code/Python/data_scores_1_10.json`.
Surtout, la formule recalculée *indépendamment* reproduit ces résultats d'origine à 1e-9 : la référence n'est pas qu'une photographie.
Les fichiers plus anciens (`Code/data_scores.json`, `data_scores_normalisation_elem.json`, `Code/Python/data_scores.json`, `oppchovec_resultats_V.xlsx`) relèvent d'une méthode antérieure
et ne sont **pas** des références valables.

Les bornes de `test_04` sont l'empreinte **mesurée** du passage à la v2 (corrélations de rang par indicateur entre la v1 et la v2, avec une marge). Pour changer volontairement de référence :
relancer `fixtures/generer_baseline.py` avec la nouvelle référence git et mettre à jour ces bornes, en le disant ici.

## Dettes connues (signalées, pas cachées)

Elles sont marquées « échec attendu » (Python) : elles n'échouent pas la suite, mais apparaissent dans le bilan, et le jour où le défaut est
corrigé le test le signale (« succès inattendu ») pour qu'on retire la marque.

| Dette | Où |
|---|---|
| `stage_ambroise/Code/WEB/index.html` est une copie plus ancienne de `index.html` (il lui manque 3 onglets) | `test_07` |

Corrigé le 2026-10-19 : l'indice courant a été reconstruit depuis des sources officielles de millésime homogène (v2) ; `oppchovec.py`, resté sur l'ancienne chaîne de fichiers, n'est plus la source de l'indice et n'est plus testé. L'ancien indice v1 est archivé (étiquette Git `indice-courant-v1-2020-2024`, `Données/archive_indice_v1_2020_2024/`).

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
