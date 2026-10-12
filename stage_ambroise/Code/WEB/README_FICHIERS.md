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
Classe 1 : 0.00 - 2.28
Classe 2 : 2.28 - 3.94
Classe 3 : 3.94 - 5.13
Classe 4 : 5.13 - 7.26
Classe 5 : 7.26 - 10.00
```

**Score_Opp :**
```
Classe 1 : 0.00 - 2.44
Classe 2 : 2.44 - 3.75
Classe 3 : 3.75 - 4.95
Classe 4 : 4.95 - 6.49
Classe 5 : 6.49 - 10.00
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
| `lisa_data.js` | `LISA_DATA` | p_k égaux | 5 % | 45 communes (12,5 %) |
| `lisa_data_1pct.js` | `LISA_DATA_1PCT` | p_k égaux | 1 % | 21 communes (5,8 %) |
| `lisa_data_betti.js` | `LISA_DATA_BETTI` | p_k de Betti et al. | 5 % | 54 communes (15,0 %) |
| `lisa_data_betti_1pct.js` | `LISA_DATA_BETTI_1PCT` | p_k de Betti et al. | 1 % | 21 communes (5,8 %) |

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
- **densite_entrepreneuriale.json**, **bien_etre_subjectif.json** : données de l'onglet Corrélation (le second ne couvre que
  les communes de l'enquête).

---

## 🔁 Procédure de régénération

À lancer depuis `stage_ambroise/Code/Python/` (sauf l'étape 4). Les sources brutes (xlsx/csv par indicateur) ne sont pas dans le
dépôt : `<sources>` désigne le dossier contenant `Données/Corse_Commune/`.

1. **Scores et indice** : `python regenerer_data_scores.py "<sources>"` recalcule Vec3 depuis ses sous-composantes puis tous les
   scores. Il refuse d'écrire s'il ne retrouve pas d'abord le fichier actuel à partir des indicateurs.
2. **Seuils de Jenks** : `python calculer_jenks_5_classes.py`
3. **Données sous-jacentes aux curseurs** : `python exporter_sous_composantes.py "<sources>"`
4. **LISA** (depuis la racine du dépôt) : `python gen_lisa_knn5.py` (**attention : les chemins `WEB_DIR` et `GEOJSON` en tête de ce
   script sont absolus, à adapter à votre machine**)
5. **CAH** : `python graphique_ecarts_types_cah.py` (**mettre `n_clusters_list = [3, 4, 5]`** : la liste par défaut `[3, 4]` ne
   produit pas le graphique à 5 classes), puis `python preparer_donnees_cah_web_complet.py`, puis `python generer_cah_data_js_complet.py`
6. **Assistant** : `python generer_donnees_communes_chatbot.py`
7. **Documentation et repli** : reporter les nouveaux seuils dans les tableaux ci-dessus et dans `let seuilsJenks` de `script.js`.
8. **Contrôle** : `python tests/run_tests.py` (depuis la racine du dépôt).

⚠️ La chaîne *complète* depuis les fichiers bruts n'est pas encore entièrement scriptée : `oppchovec.py` n'est pas synchronisé avec
`data_scores_0_10.json` pour Opp4 (la fibre, `fibre_corse.csv`, y manque) et Cho2 (le script lit `Cho2.xlsx`, les données viennent
de `Cho2_francais_18plus.xlsx`). Les tests le signalent comme « échec attendu ».

---

## ✅ Vérification rapide

1. **Console navigateur (F12)** : vérifier qu'il n'y a pas d'erreur (hormis `reading 'addEventListener'` : un reliquat connu de
   l'ancien onglet « Numbered », sans conséquence).
2. **Test rapide** : `console.log(data_indicateursOriginaux['Afa'].OppChoVec_0_10)` devrait afficher `10`.
3. **Seuils** : `console.log(seuilsJenks.oppchovec)` devrait afficher 6 valeurs.

## ⚠️ Important

- Toujours utiliser les clés avec `_0_10` pour les cartes : `OppChoVec_0_10`, `Score_Opp_0_10`, etc.
- Les seuils Jenks contiennent 6 valeurs (pour 5 classes).
- Les champs en `_0_10` sont tous compris entre 0 et 10.
