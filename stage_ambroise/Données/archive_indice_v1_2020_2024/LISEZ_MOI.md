# Archive de l'indice courant « v1 » (millésimes 2020-2024)

Cette archive garde de quoi **refaire l'ancien indice** après le remplacement des données par des sources homogènes (recensement 2023, ARCEP 2024, revenus 2024…).
Décision du 19 octobre 2026 : l'indice courant est remplacé entièrement, l'ancien est conservé ici.

## Ce qui est conservé

| Quoi | Où |
|---|---|
| Code, fichiers de l'appli, résultats (`data_scores_0_10.json`, Jenks, LISA, CAH, Excel…) et documentation, tels qu'ils étaient | **étiquette Git `indice-courant-v1-2020-2024`** (`git checkout indice-courant-v1-2020-2024`) |
| Sources brutes (xlsx et csv, exclus du dépôt par `.gitignore`) : colonnes, lignes et empreinte SHA-256 de chaque original | `sources_brutes_indice_v1.json` (ce dossier) |
| Programme qui recrée les fichiers d'origine | `Code/Python/archive_indice_v1.py restaurer "<dossier>"` |
| Audit des sources de cet indice | `Code/RAPPORT_AUDIT_SOURCES_INDICE_COURANT.md` |

## Refaire l'ancien indice

1. `git checkout indice-courant-v1-2020-2024` (ou créer une branche depuis l'étiquette).
2. `python stage_ambroise/Code/Python/archive_indice_v1.py restaurer "<dossier>"` : recrée `Données/Corse_Commune/*.xlsx`, `*.csv` et `Code/Python/services_accessibles_20min_local.csv`.
3. `python stage_ambroise/Code/Python/exporter_sous_composantes.py "<dossier>"` : recompose les sous-composantes et vérifie qu'elles redonnent `data_scores_0_10.json` (testé le 19/10/2026 : tous les contrôles « OK »).
4. Le reste de la chaîne (Jenks, LISA, CAH, Excel) est décrit dans `Code/WEB/README_FICHIERS.md`, section « Procédure de régénération ».

## Ce que contient l'archive

Opp2 (CSP 2021), Opp3 (voiture 2021 et accès aux transports), Opp4 (4G, débit), fibre (`fibre_corse.csv`), Cho1 (`Cho1_personnes`), Cho2 (`Cho2_francais_18plus`, 2022), Vec1 (médiane Filosofi 2021), Vec2 (`vec2_lb.csv`, 2022), Vec3 (2021), Vec4 (`Vec4.xlsx` et `services_accessibles_20min_local.csv`, BPE 2024), correspondance des communes et populations.
**Non conservés ici** : `education_communes_opp1.json` (Opp1, déjà dans le dépôt, `Données/`) et `RP2022_logemt_quartiers_selectionnes.csv` (source de Cho1, absent du dépôt et introuvable ; seul son résultat par commune, `Cho1_personnes`, est archivé).
