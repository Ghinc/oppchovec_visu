# Publier les deux sites (outil de décision, avec et sans Évolution)

| Site | Branche | Dépôt GitHub (Pages sur cette branche) |
|---|---|---|
| Outil de décision (sans Évolution) | `demo_outil` | `oppchovec_visu` |
| Outil de décision + onglet Évolution | `demo_outil_evolution` | second dépôt (remote `evolution`) |

Les deux branches ont **le même code**. Une seule chose les distingue : `stage_ambroise/Code/WEB/config_site.js`
(`SITE_EVOLUTION = false` sur `demo_outil`, `true` sur `demo_outil_evolution`). Ne jamais modifier ce fichier sur `demo_outil` :
c'est ce qui garantit des fusions sans conflit.

## Mise en place (une fois)
1. Créer sur GitHub un second dépôt (par exemple `oppchovec_visu_evolution`), vide.
2. `git remote add evolution https://github.com/<compte>/oppchovec_visu_evolution.git`
3. `git push evolution demo_outil_evolution`
4. Dans ce dépôt : Settings → Pages → Source : *Deploy from a branch* → branche `demo_outil_evolution`, dossier `/ (root)`.

## Corriger un bug ou mettre à jour les données
- Bug propre à l'outil de décision : le corriger sur `demo_outil`.
- Bug du code partagé (calculs, cartes, panneau commune) : le corriger sur `visu_corse_simple`, puis
  `git switch demo_outil && git merge visu_corse_simple`. Conflits fréquents : `index.html`, `dashboard.css`, `script.js` et les tests
  (la démo a retiré des onglets) ; garder la version de la démo pour les onglets retirés. Les tests des onglets absents de la démo
  (EPCI) sont supprimés sur `demo_outil` : après la fusion, `git rm` ceux qui reviennent.
- Puis `sh publier_sites.sh` : fusionne `demo_outil` dans `demo_outil_evolution`, lance les tests, pousse les deux branches.
