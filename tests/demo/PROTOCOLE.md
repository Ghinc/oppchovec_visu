# Protocole de non-régression — branche `démo_outil`

**Objectif** : montrer que la version « démo » (pour les décideurs) reste identique à l'outil de recherche
(branche `visu_corse_simple`) pour tout ce qu'elle a conservé, et que les seuls changements sont ceux voulus.

## Ce qui a changé volontairement (à ne pas compter comme régression)

| Changement | Détail |
|---|---|
| Onglets | Seulement OppChoVec, Opp, Cho, Vec, + **Dominance** (nouveau) |
| Pondérations | Betti et al. uniquement, non mentionné dans l'interface : le bouton de choix et l'encart ont disparu ; les poids (en %) sont dans une infobulle « 🛈 Pondérations » en haut à droite des cartes |
| Routes | Plus de choix : seules les routes nationales sont affichées (comme par défaut dans la référence) |
| Description d'Opp1 (éducation) | Texte réécrit : méthode, sources, limite (niveau de diplôme connu seulement à l'échelle de la Corse) |
| Langue | Français uniquement, sans case « English labels » (la case « copyright » a disparu aussi : le copyright est toujours affiché) |
| Chargement des cartes | La référence dessine les cartes **deux fois** au chargement (d'abord avec les valeurs du fichier à p_k égaux, d'où un « flash » violet, puis avec Betti) et laisse les premières couches sous les secondes (routes nationales et étiquettes de villes en double, polygones empilés : l'oppchovec de référence est teinté de ≤ 2/255 par la couche du dessous). La démo dessine une seule fois. Conséquence : routes un peu moins intenses visuellement ; couleurs, bulles et données inchangées |
| Libellé des curseurs | « 87 % · 96,4 % » devient « 87 % de l'échelle corse · valeur : 96,4 % » (1er % = position entre le min et le max observés en Corse, ensuite la valeur réelle). La comparaison A/B ramène ce libellé à l'ancien format avant de comparer |
| Colonne de gauche | Deux sections : 1 commune, 2 téléchargement ; un seul téléchargement : le classement OppChoVec (les statistiques descriptives ne sont plus proposées) |
| Code | `script.js` garde le code des onglets retirés (inactif) ; seules modifications : langue française par défaut, bascule p_k supprimée, deux lignes de garde sur le chatbot, onglet Dominance |

Tout le reste (données, calculs, couleurs, bulles, légendes, fiche commune, curseurs, téléchargements) doit être **identique**.

## Étape 1 — Comparaison automatique A/B (≈ 1 minute)

```bash
node tests/demo/comparer_branches.js            # référence : visu_corse_simple
node tests/demo/comparer_branches.js autre_branche
```

Le script extrait la branche de référence dans un dossier temporaire (rien n'est modifié dans le dépôt), ouvre les deux
versions dans Chromium et compare :

| # | Vérification | Critère |
|---|---|---|
| 1 | Fichiers modifiés entre les branches | seuls `index.html`, `script.js`, `dashboard.css`, `dominance.js`, `tests/` : aucun fichier de données ni de téléchargement |
| 2 | Téléchargement (le classement) | octet pour octet |
| 3 | Chargement | aucune erreur de console, aucune requête en échec, p_k = Betti |
| 4 | Données calculées | indicateurs, scores Opp/Cho/Vec, indice OppChoVec, seuils de Jenks, couleurs, p_k : **identiques** (comparaison exacte) |
| 5 | Chaque carte (4) | 360 communes ; couleur et style de chacune ; contenu de chaque bulle ; légendes ; image de la carte une fois routes, villes et étiquettes retirées (≤ 0,01 % de pixels différents, ou écart ≤ 3/255 partout) |
| 6 | Fiche commune | texte identique pour 5 communes (Bastia, Ajaccio, Afa, Érone, Propriano) ; après modification de deux curseurs et « Recalculer » sur Bastia : état complet, fiche et carte identiques |

Résultat attendu : `Bilan : 40/40 vérifications identiques`, code de sortie 0. Chaque écart est détaillé (premier élément différent).
*Contrôle du contrôle* : changer une couleur ou un poids dans `script.js` fait échouer plus de la moitié des vérifications.

## Étape 2 — Suite de tests du dépôt

```bash
python tests/run_tests.py          # Python + JavaScript + navigateur
```

Attendu : 0 échec. Ces tests couvrent : intégrité des 360 communes, recalcul indépendant des scores depuis les indicateurs,
seuils de Jenks, LISA/CAH (fichiers de données conservés), curseurs et recalcul, et l'onglet Dominance (couches, cohérence
avec le score). Adaptations faites pour la démo : tests des onglets/fonctions retirés supprimés (LISA, CAH, Parangons,
Corrélation, Entreprises, chatbot, histogramme, top 10, bascule de langue, bouton p_k) ; la fonction `toggleModePk` n'existe
plus dans la page mais une *cale de test* (`tests/js/helpers/charger_script.js`) la recrée pour que les tests de recalcul
continuent de vérifier le calcul à p_k égaux contre `OppChoVec_0_10` du fichier de données.

## Étape 3 — Contrôle visuel (≈ 10 minutes, ce que l'automatique ne voit pas)

Lancer `python -m http.server 8000` à la racine, ouvrir `http://localhost:8000/index.html` **dans deux fenêtres côte à côte**
(la référence : `git worktree add ../ref visu_corse_simple`, serveur sur le port 8001, décocher « English labels »).

- [ ] Les 4 onglets de cartes s'affichent comme dans la référence (zoom, étiquettes Bastia/Calvi/Corte/Ajaccio/Porto-Vecchio, boussole, échelle).
- [ ] Survol / clic d'une commune : bulle identique (valeur et libellé).
- [ ] Routes : seules les nationales sont tracées, comme sur la référence avec ses réglages par défaut ; aucune case de choix.
- [ ] Infobulle « 🛈 Pondérations » : s'affiche au survol, 3 pourcentages (≈ 100 %).
- [ ] Boutons d'export (appareil photo, flèche) en haut à droite des cartes : mêmes fichiers produits.
- [ ] Liste de communes + « Valider » : fiche identique ; curseurs, sous-curseurs, « Recalculer », « Réinitialiser » : mêmes valeurs.
- [ ] Téléchargement : le classement Excel s'ouvre et contient 360 communes.
- [ ] Au chargement, les cartes apparaissent directement dans leurs couleurs finales (pas de flash violet).
- [ ] Aucun texte anglais résiduel dans l'interface (colonne de gauche, légendes, bulles, fiche).
- [ ] Onglet Dominance : texte explicatif en haut, légende « Couche n — effectif », clic sur une commune → fiche (couche, dominants, dominés, 3 scores).
- [ ] Console du navigateur (F12) vide au chargement et après ouverture de chaque onglet.

## Étape 4 — Revue du code modifié

```bash
git diff visu_corse_simple...démo_outil --stat
git diff visu_corse_simple...démo_outil -- stage_ambroise/Code/WEB/script.js
```

Seuls les changements listés plus haut doivent apparaître dans `script.js`. Tout autre changement est à justifier.

## Quand le rejouer

À chaque modification de `démo_outil` ; et après chaque évolution de la branche de recherche dont on veut reporter une partie dans la
démo (la comparaison A/B dira immédiatement ce qui diffère).
