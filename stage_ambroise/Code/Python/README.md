
# 📘 README – Calcul de l’indice OppChoVec à l’échelle communale

> **Mise à jour du 19 octobre 2026.** Ce README décrit le programme historique `oppchovec.py` et ses fichiers Excel individuels (indice « v1 »). **L'indice courant (v2) n'est plus produit par ce programme** : il est construit par `construire_indice_v2.py` à partir de sources officielles de 2023 à 2025 (voir `WEB/README_FICHIERS.md`, section « Procédure de régénération », et `RAPPORT_AUDIT_SOURCES_INDICE_COURANT`). L'ancien calcul reste reconstructible : `Données/archive_indice_v1_2020_2024/LISEZ_MOI.md`.

## 🧾 Description générale

Ce script Python permet de calculer l’indice de bien-être objectif OppChoVec pour l’ensemble des communes corses.  
Il suit une méthodologie précise basée sur le rapport de Lise Bourdeau-Lepage, répartis selon les 3 axes du bien-être : Opportunités (`Opp`), Choix (`Cho`) et Vécu (`Vec`).  
Les données utilisées sont issues de sources officielles (INSEE, ARCEP, etc.) et stockées dans des fichiers Excel individuels.

---

## 🗂️ Organisation générale

Le script réalise les étapes suivantes :

### 1. 📥 Chargement des données
- Parcours automatique d’un dossier contenant les fichiers excel `.xlsx` pour chaque indicateur.
- Lecture de chaque fichier Excel et remplissage d’un dictionnaire `data_dict` contenant les données brutes par commune.

### 2. 🧮 Calcul des indicateurs
- Application de fonctions spécifiques pour chaque indicateur (`calc_opp1()`, `calc_opp2()`, …).
  ⚠ Opp1 (éducation) n'est plus lu dans `Opp1.xlsx` (suite artificielle) : il vient du recensement INSEE, voir `calculer_education_opp1.py`,
  `regenerer_opp1.py` et `Code/VERIFICATION_COHERENCE_DONNEES.md` (section « Opp1 »).
- Calcul d’indicateurs intermédiaires à partir des données brutes (données collectées sur les différents sites).
- Génération d’un fichier `df_indicateur.xlsx` listant tous les indicateurs agrégés par commune.

### 3. 📊 Normalisation
- Chaque indicateur est normalisé entre 0 et 1 en fonction de son min et max.
- Résultat stocké dans `data_indicateurs_normalise_dict`.

### 4. 🧩 Pondération et score par dimension
- Les indicateurs sont regroupés selon 3 dimensions :
  - `Opp` (Opportunités) : pondération égale (25% chacun)
  - `Cho` (Choix) : Cho1 et Cho2 (50% chacun)
  - `Vec` (Vécu) : Vec1 à Vec4 (25% chacun)
- Pour chaque commune, calcul d’un score pondéré `Score_Opp`, `Score_Cho` et `Score_Vec`.
- Sauvegarde dans `dimensions_V.xlsx`.

### 5. 🧠 Calcul de l’indice OppChoVec
- Application de la formule finale d’agrégation (avec α=2.5 et β=1.5).
- Résultat : un indice unique de bien-être par commune, sauvegardé dans `oppchovec_resultats_V.xlsx`.

### 6. 🔎 Analyse comparative (facultatif)
- Extraction de certaines communes pour comparaison ciblée (`Ajaccio`, `Bastia`, etc.).
- Sauvegarde des résultats comparés dans `Comparaison_V.xlsx`.

### 7. 📈 Analyse statistique
- Normalisation des scores finaux pour faciliter l’analyse.
- Calcul de statistiques descriptives : min, max, moyenne, quantiles, écart-type, coefficient de Gini.
- Résultats sauvegardés dans `stats_descriptives_normalisées_V.xlsx`.

---

## 📂 Dossiers et fichiers attendus

- `Corse_Commune/` : dossier contenant les fichiers `.xlsx` pour chaque indicateur (ex : `Opp1.xlsx`, `Vec2.xlsx`, etc.)
- `data_indicateurs.json` : sauvegarde intermédiaire des données brutes.
- `df_indicateur.xlsx` : fichier final des indicateurs calculés.
- `oppchovec_resultats_V.xlsx` : score final de bien-être par commune.
- `stats_descriptives_normalisées_V.xlsx` : résumé statistique.
- `Comparaison_V.xlsx` : comparaison entre communes spécifiques.

---

## 🧰 Librairies utilisées

- `pandas` – traitement de données tabulaires
- `numpy` – calculs vectoriels
- `json` – sauvegarde structurée
- `os`, `openpyxl` – manipulation de fichiers Excel
- `cmath` – calculs mathématiques spécifiques (exp, log)

---

## ✅ À faire pour exécuter le code

1. Vérifié le chemin du dossier contenant les fichiers `.xlsx` dans la variable `folder_path`.
2. S'assurer que les fichiers sont correctement nommés (`Opp1.xlsx`, `Vec4.xlsx`, etc.).
3. Lance le script .
4. Les résultats seront automatiquement exportés dans des fichiers Excel.

---

## 📌 À noter

- La normalisation est sensible à des valeurs manquantes ou constantes.
- Le modèle ne prend actuellement en compte que les données dites "froides" (objectives).
- Certaines approximations ou hypothèses (remplissage à l’échelle départementale) sont documentées dans le rapport.
- Les différentes sources des données sont mentionnées dans le fichier "Document explicatif des sources de données de la méthode OppChoVec"
