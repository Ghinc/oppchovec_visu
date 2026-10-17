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
  (`Opp1` = niveau de diplôme moyen des 18 ans ou plus, de 1 à 7, recensement INSEE 2020 : voir `Code/VERIFICATION_COHERENCE_DONNEES.md`, section « Opp1 »)

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
Classe 1 : 0.00 - 2.04
Classe 2 : 2.04 - 4.04
Classe 3 : 4.04 - 5.34
Classe 4 : 5.34 - 7.31
Classe 5 : 7.31 - 10.00
```

**Score_Opp :**
```
Classe 1 : 0.00 - 2.72
Classe 2 : 2.72 - 4.14
Classe 3 : 4.14 - 5.44
Classe 4 : 5.44 - 6.88
Classe 5 : 6.88 - 10.00
```

**Score_Cho :**
```
Classe 1 : 0.00 - 2.35
Classe 2 : 2.35 - 6.11
Classe 3 : 6.11 - 8.20
Classe 4 : 8.20 - 9.30
Classe 5 : 9.30 - 10.00
```

**Score_Vec :**
```
Classe 1 : 0.00 - 2.04
Classe 2 : 2.04 - 3.37
Classe 3 : 3.37 - 4.53
Classe 4 : 4.53 - 6.80
Classe 5 : 6.80 - 10.00
```

Ces valeurs sont celles du mode « p_k égaux ». En mode Betti, l'appli recalcule les seuils de l'indice dans le navigateur
(`calculerJenksBreaks`, `referencePk`). `script.js` contient aussi des seuils de repli (`let seuilsJenks`), utilisés si ce fichier
ne se charge pas : à garder à jour avec les valeurs ci-dessus.

---

## 🗺️ Fichiers LISA (autocorrélation spatiale locale)

Voisinage = 5 plus proches voisins (KNN k = 5), 9999 permutations, graine 42.

| Fichier | Constante JS | Indice | Seuil | Communes significatives |
|---|---|---|---|---|
| `lisa_data.js` | `LISA_DATA` | p_k égaux | 5 % | 50 communes (13,9 %) |
| `lisa_data_1pct.js` | `LISA_DATA_1PCT` | p_k égaux | 1 % | 25 communes (6,9 %) |
| `lisa_data_betti.js` | `LISA_DATA_BETTI` | p_k de Betti et al. | 5 % | 55 communes (15,3 %) |
| `lisa_data_betti_1pct.js` | `LISA_DATA_BETTI_1PCT` | p_k de Betti et al. | 1 % | 26 communes (7,2 %) |

Chaque fichier contient `metadata` (I de Moran global, poids p_k, seuil…), `statistiques` (effectif par type de cluster) et
`clusters` : pour chaque commune `cluster` (`HH (High-High)`, `LL (Low-Low)`, `HL (High-Low)`, `LH (Low-High)` ou
`Non significatif`), `lisa_I`, `p_value`, `significatif` et `oppchovec` (valeur 0-10 utilisée).

## 🧩 Autres fichiers de données

- **cah_3_clusters.json**, **cah_5_clusters.json** et **cah_data.js** : classification hiérarchique ascendante (Ward) sur les trois
  scores 0-10 standardisés. `cah_data.js` recopie les deux JSON (`CAH_DATA_3`, `CAH_DATA_5`). Les images `cah_3_clusters_ecarts.png`
  et `cah_5_clusters_ecarts.png` montrent l'écart de chaque groupe à la moyenne.
- **donnees_completes_communes.json** : valeurs arrondies par commune, pour l'assistant conversationnel.
- **sous_composantes.json** : valeurs brutes des sous-composantes d'Opp3, Opp4, Cho1, Vec2 et Vec3 (curseurs du panneau
  commune). Il est vérifié à la génération : chaque recomposition doit redonner exactement l'indicateur de `data_scores_0_10.json`.
- **`../../Données/education_communes_opp1.json`** : source d'`Opp1` (effectifs par niveau de diplôme et niveau moyen de chaque commune, avec la
  provenance INSEE et l'hypothèse sur les 15-17 ans). Produit par `calculer_education_opp1.py`, injecté par `regenerer_opp1.py`.
- **vec1_revenu_fiscal.json** et **vec1_variante.js** : variante de Vec1 (revenu fiscal moyen par foyer, DGFiP IRCOM 2021) à la place de la médiane du
  niveau de vie, et case à cocher qui bascule l'appli ; voir `Code/VERIFICATION_COHERENCE_DONNEES.md`, section « Vec1 ». Produit par
  `calculer_revenu_fiscal_vec1.py "<chemin>/ircom_communes_complet_revenus_2021.xlsx"` (non nécessaire à l'indice actuel).
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
- **serie_temporelle.json** et **evolution.js** : indice OppChoVec comparable pour 2016 et 2021 (7 indicateurs sur 10 ; Vec1 = médiane du niveau de vie, Cho2 sur les 18 ans et plus) et onglet « Évolution » (deux cartes + carte d'évolution) ; voir
  `Code/VERIFICATION_COHERENCE_DONNEES.md`, section « Série temporelle ». Produit par `construire_serie_temporelle.py "<dossier>"` (sources INSEE et DGFiP décrites dans cette section).
- **densite_entrepreneuriale.json**, **bien_etre_subjectif.json** : données de l'onglet Corrélation (le second ne couvre que
  les communes de l'enquête).

---

## 🔁 Procédure de régénération

À lancer depuis `stage_ambroise/Code/Python/` (sauf les étapes 4 et 7, qui se lancent depuis la racine du dépôt). Les sources brutes (xlsx/csv par indicateur) ne sont pas dans le
dépôt : `<sources>` désigne le dossier contenant `Données/Corse_Commune/`.

0. **Opp1 (éducation)** — seulement si la source INSEE change : `python calculer_education_opp1.py "<chemin>/base-ic-diplomes-formation-2020.xlsx"` (écrit `Données/education_communes_opp1.json`), puis `python regenerer_opp1.py` (remplace Opp1 dans `data_scores_0_10.json` et recalcule scores et indice ; refuse d'écrire s'il ne retrouve pas d'abord le fichier actuel). Les étapes suivantes sont alors à relancer.
1. **Scores et indice** : `python regenerer_data_scores.py "<sources>"` recalcule Vec3 depuis ses sous-composantes puis tous les
   scores. Il refuse d'écrire s'il ne retrouve pas d'abord le fichier actuel à partir des indicateurs.
2. **Seuils de Jenks** : `python calculer_jenks_5_classes.py`
3. **Données sous-jacentes aux curseurs** : `python exporter_sous_composantes.py "<sources>"`
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
8. **Documentation et repli** : reporter les nouveaux seuils dans les tableaux ci-dessus et dans `let seuilsJenks` de `script.js`.
9. **Contrôle** : `python tests/run_tests.py` (depuis la racine du dépôt).

⚠️ La chaîne *complète* depuis les fichiers bruts n'est pas encore entièrement scriptée : `oppchovec.py` n'est pas synchronisé avec
`data_scores_0_10.json` pour Opp4 (la fibre, `fibre_corse.csv`, y manque), Cho2 (le script lit `Cho2.xlsx`, les données viennent
de `Cho2_francais_18plus.xlsx`) et Opp1 (le script lit l'ancien fichier d'Opp1, une suite artificielle, alors que les données viennent du recensement INSEE). Les tests le signalent comme « échec attendu ».

---

## ✅ Vérification rapide

1. **Console navigateur (F12)** : la page doit se charger sans aucune erreur.
2. **Test rapide** : `console.log(data_indicateursOriginaux['Afa'].OppChoVec_0_10)` devrait afficher `10`.
3. **Seuils** : `console.log(seuilsJenks.oppchovec)` devrait afficher 6 valeurs.

## ⚠️ Important

- Toujours utiliser les clés avec `_0_10` pour les cartes : `OppChoVec_0_10`, `Score_Opp_0_10`, etc.
- Les seuils Jenks contiennent 6 valeurs (pour 5 classes).
- Les champs en `_0_10` sont tous compris entre 0 et 10.
