#!/bin/sh
# Publie les deux sites : fusionne demo_outil dans demo_outil_evolution, puis pousse chaque branche vers son dépôt.
# Usage (depuis la racine du dépôt, arbre de travail propre) :  sh publier_sites.sh
# Prérequis (une seule fois) : git remote add evolution https://github.com/<compte>/<dépôt du site avec Évolution>.git
set -e
[ -z "$(git status --porcelain)" ] || { echo "Arbre de travail non propre : commitez d'abord."; exit 1; }
DEPART=$(git branch --show-current)
git switch demo_outil
git push origin demo_outil
git switch demo_outil_evolution
git merge --no-edit demo_outil           # config_site.js n'est jamais modifié sur demo_outil : pas de conflit
python tests/run_tests.py                # arrêt si un test échoue (set -e)
git push evolution demo_outil_evolution
git switch "$DEPART"
echo "Sites publiés."
