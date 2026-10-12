# Guide d'intégration des données 0-10 dans l'application web

Le détail de chaque fichier et la procédure de régénération sont dans `../WEB/README_FICHIERS.md`. Ce guide montre comment
utiliser les données dans une page web.

## 📁 Fichiers utilisés

### Dans `../WEB/`
1. **data_scores_0_10.json** - Données des communes avec tous les scores et les 10 indicateurs
2. **seuils_jenks_optimal_gvf.json** - Seuils de Jenks (4 seuils internes par variable) pour les cartes choroplèthes
3. **lisa_data.js**, **lisa_data_1pct.js**, **lisa_data_betti.js**, **lisa_data_betti_1pct.js** - Clusters LISA (constantes JavaScript)
4. **cah_data.js** - Clusters de la CAH à 3 et 5 classes

### Générés à part (non versionnés)
5. **tableau_indicateurs_0_10.xlsx** - Tableau Excel à 4 feuilles, produit par `generer_tableau_excel_0_10.py`

## 🎨 Seuils Jenks (5 classes)

`seuils_jenks_optimal_gvf.json` contient, pour chaque variable, la liste `breaks` des **4 seuils internes**. Pour obtenir les
6 bornes d'une carte, on ajoute 0 au début et 10 à la fin :
```javascript
const seuils = [0, ...data.OppChoVec_0_10.breaks, 10];   // [0, s1, s2, s3, s4, 10]
```
Les valeurs actuelles sont données dans `../WEB/README_FICHIERS.md`.

## 🗺️ Structure des données

### data_scores_0_10.json
```json
{
  "Nom_Commune": {
    "OppChoVec_0_10": float,      // Indice OppChoVec normalisé 0-10
    "Score_Opp_0_10": float,      // Score Opp normalisé 0-10
    "Score_Cho_0_10": float,      // Score Cho normalisé 0-10
    "Score_Vec_0_10": float,      // Score Vec normalisé 0-10
    "Opp1": float,                // Éducation
    "Opp2": float,                // Diversité sociale (Theil)
    "Opp3": float,                // Transports
    "Opp4": float,                // Connectivité numérique
    "Cho1": float,                // Quartiers prioritaires
    "Cho2": float,                // Droit de vote
    "Vec1": float,                // Revenu médian
    "Vec2": float,                // Qualité logement
    "Vec3": float,                // Stabilité emploi
    "Vec4": float                 // Accès services
  }
}
```
(le fichier contient aussi `OppChoVec`, `Score_Opp`, `Score_Cho` et `Score_Vec`, avant mise à l'échelle 0-10)

### seuils_jenks_optimal_gvf.json
```json
{
  "OppChoVec_0_10": { "breaks": [s1, s2, s3, s4], "gvf": float, "nb_classes": 5, "min": 0.0, "max": 10.0 }
}
```

### lisa_data.js (et variantes)
```javascript
const LISA_DATA = {
  "metadata": { "moran_global_I": float, "seuil_significativite": 0.05, "nb_significatives": int, ... },
  "statistiques": { "HH (High-High)": int, ... },
  "clusters": {
    "Nom_Commune": {
      "cluster": "HH (High-High)" | "LL (Low-Low)" | "HL (High-Low)" | "LH (Low-High)" | "Non significatif",
      "lisa_I": float,
      "p_value": float,
      "significatif": boolean,
      "oppchovec": float
    }
  }
};
```

## 🎯 Utilisation dans l'application web

### 1. Chargement des données

```javascript
// Charger les données principales
const dataScores = await fetch('data_scores_0_10.json').then(r => r.json());

// Charger les seuils Jenks
const jenks = await fetch('seuils_jenks_optimal_gvf.json').then(r => r.json());
const seuilsOppChoVec = [0, ...jenks.OppChoVec_0_10.breaks, 10];

// Les clusters LISA se chargent par une balise <script src="lisa_data.js"></script> (constante LISA_DATA)
```

### 2. Colorisation de la carte

```javascript
// Fonction pour obtenir la couleur selon le score.
// Les seuils de Jenks sont des valeurs observées : un score égal à un seuil appartient à la classe INFÉRIEURE (<=).
function getColorFromScore(score, seuils) {
  const colors = ['#bbdefb', '#64b5f6', '#9c27b0', '#7b1fa2', '#4a148c'];

  for (let i = 1; i < seuils.length - 1; i++) {
    if (score <= seuils[i]) {
      return colors[i - 1];
    }
  }
  return colors[colors.length - 1];
}

// Appliquer la couleur à chaque commune
communes.forEach(commune => {
  const score = dataScores[commune.nom]?.OppChoVec_0_10;
  if (score !== undefined) {
    commune.style.fill = getColorFromScore(score, seuilsOppChoVec);
  }
});
```

### 3. Affichage des clusters LISA

```javascript
// Couleurs pour les clusters LISA
const lisaColors = {
  'HH (High-High)': '#d7191c',
  'LL (Low-Low)': '#2b83ba',
  'HL (High-Low)': '#fdae61',
  'LH (Low-High)': '#abd9e9',
  'Non significatif': '#ffffbf'
};

// Appliquer les couleurs LISA
communes.forEach(commune => {
  const lisa = LISA_DATA_1PCT.clusters[commune.nom];
  if (lisa && lisa.significatif) {
    commune.style.fill = lisaColors[lisa.cluster];
  }
});
```

## 📊 Tableau Excel (tableau_indicateurs_0_10.xlsx)

### Feuille 1 : OppChoVec
- Zone
- OppChoVec_0_10 (triée décroissante)
- Score_Opp_0_10
- Score_Cho_0_10
- Score_Vec_0_10

### Feuille 2 : Opp (Opportunités)
- Zone
- Score_Opp_0_10 (triée décroissante)
- Opp1 (Éducation)
- Opp2 (Diversité sociale)
- Opp3 (Transports)
- Opp4 (Connectivité)

### Feuille 3 : Cho (Choix)
- Zone
- Score_Cho_0_10 (triée décroissante)
- Cho1 (Quartiers prioritaires)
- Cho2 (Droit de vote)

### Feuille 4 : Vec (Vécu)
- Zone
- Score_Vec_0_10 (triée décroissante)
- Vec1 (Revenu)
- Vec2 (Logement)
- Vec3 (Emploi)
- Vec4 (Services)

## 🔍 Vérification

Pour vérifier que tout fonctionne :

1. **Vérifier que les seuils Jenks ont 6 valeurs** (pour 5 classes) : `[0, s1, s2, s3, s4, 10]`
2. **Vérifier que toutes les communes ont un score OppChoVec_0_10**
3. **Vérifier que les noms de communes correspondent** entre les fichiers JSON et les géométries
4. **Lancer la suite de tests** : `python tests/run_tests.py`

## 🐛 Résolution du problème de couleurs

Si les couleurs ne s'affichent pas :

1. **Vérifier la correspondance des noms** :
   - Les noms dans `data_scores_0_10.json` doivent correspondre exactement aux noms dans les géométries
   - Attention aux accents, majuscules, tirets

2. **Vérifier la structure des données** :
   - Chaque commune doit avoir une valeur `OppChoVec_0_10`
   - Les valeurs doivent être comprises entre 0 et 10

3. **Vérifier les seuils Jenks** :
   - Doit contenir exactement 6 valeurs : [min, seuil1, seuil2, seuil3, seuil4, max]
   - Le dernier seuil doit être 10.0

4. **Console JavaScript** :
   - Ouvrir la console du navigateur (F12)
   - Vérifier s'il y a des erreurs
   - Vérifier que les données sont bien chargées

## 📝 Notes importantes

- **Normalisation** : Tous les scores en `_0_10` sont entre 0 et 10
- **LISA** : Uniquement calculé sur OppChoVec (pas sur Opp, Cho, Vec)
- **Seuils** : Calculés avec l'algorithme de Jenks (Natural Breaks)
- **Communes** : 360 communes de Corse
