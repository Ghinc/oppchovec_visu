# Fichiers de l'application web (échelle 0-10)

Ce dossier contient tout ce que l'appli charge (`index.html` + `script.js`). Les fichiers de données sont **dérivés** les uns
des autres : voir « Procédure de régénération » en bas de page. Une suite de tests automatiques (`python tests/run_tests.py`,
voir `tests/README.md`) vérifie que ce document, les données et le code restent cohérents.

## 📁 Fichier principal

### **data_scores_0_10.json**
**C'est le fichier que l'application charge au démarrage.** 360 communes, indexées par leur nom (identique à la propriété `nom`
de `Données/Commune_Corse.geojson`). Pour chaque commune :

- `OppChoVec_0_10` : indice global (0-10)
- `Score_Opp_0_10`, `Score_Cho_0_10`, `Score_Vec_0_10` : scores des trois dimensions (0-10)
- `OppChoVec`, `Score_Opp`, `Score_Cho`, `Score_Vec` : mêmes grandeurs avant mise à l'échelle 0-10 (scores de dimension dans [0, 1])
- les 10 indicateurs bruts : `Opp1`, `Opp2`, `Opp3`, `Opp4`, `Cho1`, `Cho2`, `Vec1`, `Vec2`, `Vec3`, `Vec4`
  (indice courant **v2**, sources officielles de 2023 à 2025, une source par indicateur : voir `Données/indice_v2/sources_indice_v2.json`, `Code/RAPPORT_AUDIT_SOURCES_INDICE_COURANT.md` et la section « Indice courant v2 » ci-dessous ; l'ancien indice v1 est archivé dans `Données/archive_indice_v1_2020_2024/`)

Les champs en `_0_10` sont un min-max des champs sans suffixe : la commune la plus faible vaut 0, la plus forte 10.
L'indice `OppChoVec_0_10` est celui du mode « p_k égaux » ; l'appli recalcule le mode Betti et al. dans le navigateur.

---

## 🎨 Seuils des classes de couleur

### **seuils_jenks_optimal_gvf.json**
Seuils de Jenks à 5 classes pour les quatre variables `OppChoVec_0_10`, `Score_Opp_0_10`, `Score_Cho_0_10`, `Score_Vec_0_10`.
Pour chacune : `breaks` (les **4 seuils internes**), `gvf` (qualité de l'ajustement), `min`, `max`. L'appli en fait des listes de
**6 valeurs** `[0, seuil1, seuil2, seuil3, seuil4, 10]`.

**Convention de classement :** les seuils de Jenks sont des valeurs observées, donc une commune dont le score est *égal* à un
seuil appartient à la classe **inférieure** (`valeur <= seuil`). C'est ce que font l'appli, les histogrammes et jenkspy.

#### Seuils (0-10) :

**OppChoVec :**
```
Classe 1 : 0.00 - 3.64
Classe 2 : 3.64 - 4.85
Classe 3 : 4.85 - 6.11
Classe 4 : 6.11 - 7.62
Classe 5 : 7.62 - 10.00
```

**Score_Opp :**
```
Classe 1 : 0.00 - 3.47
Classe 2 : 3.47 - 4.87
Classe 3 : 4.87 - 6.08
Classe 4 : 6.08 - 7.31
Classe 5 : 7.31 - 10.00
```

**Score_Cho :**
```
Classe 1 : 0.00 - 2.44
Classe 2 : 2.44 - 6.37
Classe 3 : 6.37 - 8.31
Classe 4 : 8.31 - 9.32
Classe 5 : 9.32 - 10.00
```

**Score_Vec :**
```
Classe 1 : 0.00 - 2.61
Classe 2 : 2.61 - 3.96
Classe 3 : 3.96 - 5.24
Classe 4 : 5.24 - 7.30
Classe 5 : 7.30 - 10.00
```

Ces valeurs sont celles du mode « p_k égaux ». En mode Betti, l'appli recalcule les seuils de l'indice dans le navigateur
(`calculerJenksBreaks`, `referencePk`). `script.js` contient aussi des seuils de repli (`let seuilsJenks`), utilisés si ce fichier
ne se charge pas : à garder à jour avec les valeurs ci-dessus.

---

## 🗺️ Fichiers LISA (autocorrélation spatiale locale)

Voisinage = 5 plus proches voisins (KNN k = 5), 9999 permutations, graine 42.

| Fichier | Constante JS | Indice | Seuil | Communes significatives |
|---|---|---|---|---|
| `lisa_data.js` | `LISA_DATA` | p_k égaux | 5 % | 100 communes (27,8 %) |
| `lisa_data_1pct.js` | `LISA_DATA_1PCT` | p_k égaux | 1 % | 40 communes (11,1 %) |
| `lisa_data_betti.js` | `LISA_DATA_BETTI` | p_k de Betti et al. | 5 % | 117 communes (32,5 %) |
| `lisa_data_betti_1pct.js` | `LISA_DATA_BETTI_1PCT` | p_k de Betti et al. | 1 % | 54 communes (15,0 %) |

Chaque fichier contient `metadata` (I de Moran global, poids p_k, seuil…), `statistiques` (effectif par type de cluster) et
`clusters` : pour chaque commune `cluster` (`HH (High-High)`, `LL (Low-Low)`, `HL (High-Low)`, `LH (Low-High)` ou
`Non significatif`), `lisa_I`, `p_value`, `significatif` et `oppchovec` (valeur 0-10 utilisée).

## 🧩 Autres fichiers de données

- **cah_3_clusters.json**, **cah_5_clusters.json** et **cah_data.js** : classification hiérarchique ascendante (Ward) sur les trois
  scores 0-10 standardisés. `cah_data.js` recopie les deux JSON (`CAH_DATA_3`, `CAH_DATA_5`). Les images `cah_3_clusters_ecarts.png`
  et `cah_5_clusters_ecarts.png` montrent l'écart de chaque groupe à la moyenne.
- **donnees_completes_communes.json** : valeurs arrondies par commune, pour l'assistant conversationnel.
- **details_calcul.json** : éléments bruts du calcul des 10 indicateurs de chaque commune (effectifs par niveau de diplôme, revenus et foyers fiscaux, parts de couverture…), affichés par le menu déroulant « Voir le calcul » du panneau commune. Produit par `exporter_details_calcul.py` à partir de `sources_indice_v2.json`.
- **sous_composantes.json** : valeurs brutes des sous-composantes des 10 indicateurs (parts de diplôme pour Opp1, catégories pour Opp2, sous-composantes d'Opp3, Opp4, Vec2 et Vec3, une seule composante pour Cho1, Cho2, Vec1 et Vec4 ; curseurs du panneau
  commune). Il est vérifié à la génération : chaque recomposition doit redonner exactement l'indicateur de `data_scores_0_10.json`.
- **`../../Données/indice_v2/sources_indice_v2.json`** : **source de l'indice courant v2**. Pour chaque commune, les composantes brutes de chacun des 10 indicateurs (effectifs par niveau de
  diplôme, catégories socioprofessionnelles, ménages avec voiture, couverture 4G, débit, fibre, population en QPV, population par âge et nationalité, revenu fiscal et foyers, personnes par pièce,
  statuts d'emploi, services à 20 minutes) avec leur provenance et leur millésime (clés `sources` et `millesimes`). Produit par `construire_indice_v2.py` ; `regenerer_data_scores.py`
  l'injecte dans `data_scores_0_10.json` et `exporter_sous_composantes.py` en tire `sous_composantes.json`.
- **`../../Données/archive_indice_v1_2020_2024/`** : archive de l'ancien indice v1 (sources brutes consignées en JSON, programme de restauration `archive_indice_v1.py`, mode d'emploi `LISEZ_MOI.md`) ;
  l'étiquette Git `indice-courant-v1-2020-2024` conserve le code et les résultats de l'époque.
- **serie_temporelle_robuste.json** : variante de la série où le drapeau « transports en commun » d'Opp3 n'est levé qu'à partir de 5 personnes (case « Opp3 robuste » de l'onglet Évolution) ; même script, `seuil_transports=5`. Audit des écarts aberrants : `Code/RAPPORT_AUDIT_EVOLUTION.md` (drapeau d'Opp3 fondé sur ~1 personne, bruit des communes de moins de 100 habitants).
- **epci_agregation.json**, **epci_corse.geojson** et **epci.js** : onglet « EPCI » (indice OppChoVec agrégé par intercommunalité, 19 EPCI de Corse). `epci_agregation.json` donne, pour chaque EPCI, ses
  communes (noms de l'appli) et la population de chaque commune **au millésime de chaque indicateur** (Opp1 2020 ; Opp2, Opp3, Vec1, Vec3 2021 ; Cho2, Vec2 2022 ; Opp4, Cho1, Vec4 2023 = dernière population publiée) ;
  `epci_corse.geojson` contient les contours. Produits par `Code/Python/construire_epci_agregation.py` (qui lit `Données/epci_corse_2026.json`, produit par `construire_epci_corse.py`, et les séries historiques de population de l'INSEE).
  Deux méthodes d'agrégation d'un indicateur, au choix par une case à cocher : **pro rata du nombre d'habitants** (moyenne pondérée) ou **moyenne simple**. Les indicateurs agrégés passent ensuite par la chaîne de calcul de l'appli
  (mêmes bornes figées, mêmes p_k, même échelle 0-10, mêmes classes de Jenks que les communes : un EPCI est comparable à une commune ; un « EPCI » d'une seule commune retrouve exactement ses scores, vérifié par un test).
  **Case « EPCI » de la barre du haut** (ligne « Échelle d'analyse ») : quand elle est cochée, les unités affichées par l'appli deviennent les EPCI. Deux variantes au choix : **EPCI population** (pro rata du nombre d'habitants) et **EPCI commune** (moyenne simple, chaque commune compte pour 1) ; la case « pro rata » de l'onglet EPCI reste synchronisée. Concerne les cartes OppChoVec / Opp / Cho / Vec, le top 10 et l'histogramme, le panneau de sélection (fiche de l'EPCI) et l'export ;
  le mode p_k (Betti / égal) est suivi. Les **parangons restent communaux**. **L'Évolution existe à l'échelle de l'EPCI** : la série communale est agrégée (`evolutionSerieEPCI` dans `evolution.js`) pour chaque année, avec la population de l'année (pro rata) ou en moyenne simple, puis passe par les mêmes bornes, p_k et échelle 0-10 que les communes (cartes 2016 et 2021 : classes de Jenks des communes ; carte d'évolution : classes de Jenks des variations des 19 EPCI, car les EPCI bougent peu) ; la fiche liste les communes membres, les indicateurs bruts de l'EPCI ne sont pas détaillés par composante. LISA, CAH, Entreprises et Corrélation reposent sur des données communales : ils affichent un bandeau « non disponible à l'échelle de l'EPCI » (elles reviennent en décochant la case). Mécanisme : `epci.js` (`changerEchelle`, `epciVue`, `geoUnites`) et quelques crochets dans `script.js` (`recalculerCarteOppChoVec` remplace `indiceFinale`, `scoresParCommune` et le fond de carte par ceux des EPCI ; les communes restent la base du calcul, avec les mêmes bornes figées, d'où des scores comparables à ceux des communes).
  Un clic sur une commune (carte ou liste de la fiche) ouvre son détail dans l'agrégation : ses scores et indicateurs, la valeur de son EPCI selon les deux méthodes (▲ ▼ : au-dessus ou en dessous), et son poids dans chaque moyenne (part de la population de l'EPCI au millésime de l'indicateur, ou 1 / nombre de communes).
  Limite : la moyenne de valeurs communales n'est exacte que pour les indicateurs additifs ; Opp2 (Theil), Vec1 (médiane), Opp3 et Cho1 (−log du nombre de personnes en quartier prioritaire) sont approchés.
- **serie_temporelle.json** et **evolution.js** : indice OppChoVec comparable pour 2016 et 2021 (7 indicateurs sur 10 ; Vec1 = revenu fiscal moyen par foyer fiscal (DGFiP, IRCOM, par commune), Cho2 sur les 18 ans et plus) et onglet « Évolution » (deux cartes + carte d'évolution) ; voir
  `Code/VERIFICATION_COHERENCE_DONNEES.md`, section « Série temporelle ». Produit par `construire_serie_temporelle.py "<dossier>"` (sources INSEE et DGFiP décrites dans cette section).
- **densite_entrepreneuriale.json**, **bien_etre_subjectif.json** : données de l'onglet Corrélation (le second ne couvre que
  les communes de l'enquête).

---

## 🔁 Procédure de régénération

À lancer depuis `stage_ambroise/Code/Python/` (sauf les étapes 4 et 7, qui se lancent depuis la racine du dépôt). Les **sources brutes** de l'indice courant v2 (extraits des bases INSEE, fichiers ARCEP, IRCOM, QPV…) sont volumineux et
ne sont pas dans le dépôt : ils sont dans `C:/These/Données2/indice_v2_sources` (voir son `LISEZ_MOI.md`) ; leur résultat, `Données/indice_v2/sources_indice_v2.json`, est versionné.

0. **Sources de l'indice courant v2** — seulement si une source change : télécharger les fichiers décrits dans le `LISEZ_MOI.md` du dossier des sources (`C:/These/Données2/indice_v2_sources`), extraire la Corse des bases
   INSEE avec `python extraire_corse_xlsx.py "<base>.zip" "<sortie>.csv"`, recalculer la 4G avec `python calculer_couverture_4g.py …`, puis `python construire_indice_v2.py "<dossier des sources>"` (écrit
   `Données/indice_v2/sources_indice_v2.json`).
1. **Scores et indice** : `python regenerer_data_scores.py` remplace les 10 indicateurs de `data_scores_0_10.json` par ceux de `sources_indice_v2.json` et recalcule tous les scores. Il vérifie d'abord que le
   fichier actuel se retrouve depuis ses indicateurs.
2. **Seuils de Jenks** : `python calculer_jenks_5_classes.py`
3. **Données sous-jacentes aux curseurs et au détail du calcul** : `python exporter_sous_composantes.py`, puis `python exporter_details_calcul.py`
4. **LISA** (depuis la racine du dépôt) : `python gen_lisa_knn5.py`. Les scripts `gen_*.py` de la racine prennent leurs chemins dans
   `chemins.py` (relatifs au dépôt, rien n'est codé en dur). `gen_lisa_betti.py` (voisinage Queen) est **obsolète** : il refuse de tourner
   sans `--ancienne-methode`, car il écraserait les mêmes fichiers avec une autre méthode.
5. **CAH** (ces scripts lisent `Données/Commune_Corse.geojson` via `../../Données/`) : `python graphique_ecarts_types_cah.py` (graphiques à 3, 4 et 5 classes), puis `python preparer_donnees_cah_web_complet.py`,
   puis `python generer_cah_data_js_complet.py`
6. **Assistant** : `python generer_donnees_communes_chatbot.py`
7. **Tableaux Excel** (depuis la racine du dépôt) : `python gen_excel_010.py`, puis si besoin `gen_comparaison.py`, `gen_top5_betti.py` et
   `gen_appendix2.py`. `gen_excel_010.py` écrit les deux fichiers **proposés au téléchargement par le site** dans `downloads/`
   (`oppchovec_betti_0_10_trie.xlsx`, `stats_descriptives_betti_0_10.xlsx`, versionnés) et ses fichiers « égal » dans
   `stage_ambroise/Code/OUTPUT/`, où vont aussi les tableaux de l'article (ignorés par git comme tous les `.xlsx`). Les fichiers de
   `downloads/` doivent être régénérés à chaque changement de données : un test le vérifie.
8. **Documentation et repli** : `python maj_chiffres_documentation.py` reporte les nouveaux seuils de Jenks, les effectifs LISA et les exemples chiffrés dans ce document et dans `VERIFICATION_COHERENCE_DONNEES.md`, et les seuils de repli (`let seuilsJenks`) dans `script.js`.
9. **Contrôle** : `python tests/run_tests.py` (depuis la racine du dépôt).

⚠️ `oppchovec.py` (programme historique) n'est plus la source de l'indice courant : c'est `construire_indice_v2.py` qui produit les 10 indicateurs, et `regenerer_data_scores.py` qui calcule les scores. Les tests
comparent `oppchovec.py` aux données et le signalent comme « échec attendu ». Pour refaire l'ancien indice (v1), voir `Données/archive_indice_v1_2020_2024/LISEZ_MOI.md`.

---

## ✅ Vérification rapide

1. **Console navigateur (F12)** : la page doit se charger sans aucune erreur.
2. **Test rapide** : `console.log(data_indicateursOriginaux['Afa'].OppChoVec_0_10)` devrait afficher `10`.
3. **Seuils** : `console.log(seuilsJenks.oppchovec)` devrait afficher 6 valeurs.

## ⚠️ Important

- Toujours utiliser les clés avec `_0_10` pour les cartes : `OppChoVec_0_10`, `Score_Opp_0_10`, etc.
- Les seuils Jenks contiennent 6 valeurs (pour 5 classes).
- Les champs en `_0_10` sont tous compris entre 0 et 10.
