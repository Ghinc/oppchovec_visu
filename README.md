# OppChoVec Visu — Module Santé

Ce sous-module sert à générer les données de santé pour la Corse, à partir de fichiers source de professionnels et d'établissements de santé, puis à produire des exports JSON/Excel utilisés par le front-end.

## Objectifs

- Calculer des indicateurs de santé territoriale par commune : densité de professionnels, diversité des spécialités et indicateurs d'offres de soins.
- Générer les données de couverture et d'accessibilité utilisées par le front-end santé.
- Produire des exports JSON/Excel pour les professionnels de santé, les établissements sanitaires, les scénarios de tensions et les projections d'offre de soins.

## Structure santé

- `oppchovec_visu/python/sante_pipeline.py` : coeur du pipeline santé.
- `oppchovec_visu/python/data/sante/raw/` : fichiers source bruts (professionnels, établissements, population, carreaux).
- `oppchovec_visu/python/data/sante/output/` : exports Excel intermédiaires et finaux.
- `oppchovec_visu/web/data/sante/` : JSON consommés par l’interface web santé.
- `oppchovec_visu/web/js/controller/sante.js` : contrôle l’interface santé.
- `oppchovec_visu/web/js/model/sante.js` : logique de transformation des données santé.
- `oppchovec_visu/web/js/view/sante_map.js` : rendu cartographique des données santé.

## Pré-requis

- Python 3.8+.
- Un environnement virtuel Python recommandé pour isoler les dépendances.

## Installation

Cloner le dépôt :

```powershell
git clone <url-du-depot> OppChoVec
cd OppChoVec
```

Créer et activer un environnement virtuel :

```powershell
cd oppchovec_visu\python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Installer les dépendances depuis `requirements.txt` :

```powershell
python -m pip install -r requirements.txt
```

## Fichiers source santé attendus

Dans `oppchovec_visu/python/data/sante/raw/` :

- `professionels_santé_MAJ2_.xlsx`
- `etablissements-sanitaire-clean.xlsx`
- `population_corse_clean.xlsx`
- `carreaux_1km_corse.csv`
- `Démographie_professionnels_santé.xlsx`

## Fonctionnement du pipeline santé

Le module santé exécute plusieurs étapes :

1. lecture des fichiers bruts
2. normalisation et nettoyage des libellés
3. calcul des effectifs et des densités par commune
4. calcul de la diversité des spécialités et des types d'établissements
5. calcul des sindicateurs d'offre de soins retenues et des scénarios de tensions de professionnels
6. export des résultats vers JSON et Excel pour le front-end

## Sorties santé générées

Dans `oppchovec_visu/web/data/sante/` :

- `sante_indicateurs_professionnels.json`
- `etablissements_indicateurs.json`
- `sante_tensions_professionnels.json`
- `projection_offre_soins.json`

Dans `oppchovec_visu/python/data/sante/output/` :

- `sante_indicateurs_professionnels.xlsx`
- `etablissements_indicateurs.xlsx`

## Démarrage back-end santé

Le back-end santé est un pipeline Python qui génère les fichiers JSON/Excel consommés par le front-end.

Depuis le dossier `oppchovec_visu/python/`, exécutez :

```powershell
cd oppchovec_visu\python
python sante_pipeline.py
```

Si vous préférez appeler la fonction directement :

```powershell
python -c "import sante_pipeline as sp; sp.run()"
```

Cette commande produit les fichiers suivants :

- `oppchovec_visu/web/data/sante/sante_indicateurs_professionnels.json`
- `oppchovec_visu/web/data/sante/etablissements_indicateurs.json`
- `oppchovec_visu/web/data/sante/sante_tensions_professionnels.json`
- `oppchovec_visu/web/data/sante/projection_offre_soins.json`

## Démarrage front-end santé

La partie front-end est statique. Ouvrez simplement `oppchovec_visu/web/index.html` dans un navigateur, ou servez-le via un serveur local pour éviter les restrictions de fichiers locales.

Par exemple, depuis `oppchovec_visu/web/` :

```powershell
cd oppchovec_visu\web
python -m http.server 8000
```

Puis rendez-vous sur :

```
http://localhost:8000/
```

Le front-end lit les fichiers JSON dans `oppchovec_visu/web/data/sante/`.

## Front-end santé

La partie web santé s’appuie sur :

- `oppchovec_visu/web/js/model/sante.js`
- `oppchovec_visu/web/js/controller/sante.js`
- `oppchovec_visu/web/js/view/sante_map.js`
- `oppchovec_visu/web/data/sante/` pour les données JSON

Cette interface affiche :

- les densités de professionnels et d'établissements de santé,
- la diversité des offres locales,
- les cartes de couverture et d’accessibilité,
- les scénarios de tensions (suppression de professionnels),
- les projections d’offre de soins jusqu’en 2036.

## Conseils

- Assurez-vous que les fichiers bruts existent dans `python/data/sante/raw/`.
- Vérifiez les colonnes attendues dans les fichiers Excel pour éviter les erreurs de chargement.
- Si un export JSON existe déjà, rafraîchissez-le après modification des données sources.


