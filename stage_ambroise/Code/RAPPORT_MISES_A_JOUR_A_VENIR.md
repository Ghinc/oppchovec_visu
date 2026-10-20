# Mises à jour à venir : quand refaire la carte de l'indice courant

Rapport rédigé le 20/10/2026, pour la personne qui pilote le projet. Il répond à la question : « quand arrivent de nouvelles données, et à partir de quand une nouvelle carte devient-elle intéressante ? »

Les dates marquées **(officiel)** viennent d'un calendrier publié par la source. Celles marquées **(estimation)** sont déduites des habitudes passées de la source : il faut les revérifier le moment venu.

## En bref

- **Rien d'urgent.** L'indice courant v2 utilise des données de 2023 à 2025, c'est le millésime le plus récent disponible pour la plupart des sources.
- **Des données plus récentes existent déjà pour Opp4 (ARCEP T4 2025) et Vec4 (BPE 2025), mais on ne les intègre pas** : la carte est une photographie d'un instant donné, renouvelée d'un bloc quand c'est pertinent.
- **La prochaine vraie mise à jour d'ensemble : mi-2027**, quand l'INSEE publie le recensement millésime 2025 (juin 2027) et que les revenus 2025 de la DGFiP arrivent (printemps 2027, estimation). Mais pour les petites communes, ce recensement ne sera renouvelé qu'aux deux cinquièmes.
- **La première carte où presque toutes les petites communes ont de nouvelles données de recensement : celle du millésime 2028**, publié vers juin 2029 (estimation).

## 1. Le recensement : pourquoi les petites communes sont décalées

Le recensement ne compte pas tout le monde chaque année.

- Les communes de **10 000 habitants et plus** sont enquêtées chaque année, sur un échantillon d'environ 8 % des logements.
- Les communes de **moins de 10 000 habitants** (presque toute la Corse, sauf Ajaccio, Bastia et Porto-Vecchio) sont réparties en **cinq groupes de rotation**. Chaque année, un groupe est enquêté **en totalité** ; chaque commune l'est donc une fois tous les cinq ans.
- Un millésime N agrège les enquêtes des années N−2 à N+2. Le millésime 2023 de l'INSEE regroupe donc les collectes de 2021 à 2025 : chaque petite commune y apparaît avec **sa** collecte, qui date d'une année différente selon son groupe.

Conséquence : d'un millésime au suivant, **seul un cinquième des petites communes** est vraiment « nouveau » par année de décalage.

| Millésime | Populations de référence | Résultats détaillés (ceux de l'indice) | Cartes infracommunales (QPV, etc.) |
|---|---|---|---|
| **2023** (utilisé par v2) | 18/12/2025 | 25/06/2026 | 15/10/2026 |
| **2025** | décembre 2026 | **juin 2027** | octobre 2027 |
| 2027 | décembre 2028 | juin 2029 | octobre 2029 |

Source : [calendrier de diffusion du recensement de l'INSEE](https://www.insee.fr/fr/information/6654307) **(officiel)** pour 2023 et 2025 ; 2027 **(estimation)** par la même périodicité biennale.

Ce que le millésime 2025 apporterait : les collectes de 2026 et 2027 viendraient remplacer celles de 2021 et 2022. Environ **2 communes de rotation sur 5** auraient de nouvelles données de recensement ; les trois autres groupes garderaient les mêmes collectes qu'en 2023. En clair : la carte de juin 2027 changerait un peu, celle de 2029 davantage.

Ordre de grandeur pour la Corse : chaque campagne annuelle recense une soixantaine à une quatre-vingtaine de petites communes (74 communes en 2025, 75 en 2026, plus l'échantillon de 8 % à Ajaccio, Bastia et Porto-Vecchio), soit à peu près 360 / 5 par groupe. La liste commune par commune des groupes n'est pas publiée dans un fichier que j'ai pu retrouver (le décret n° 2003-561 ne la donne pas sous forme exploitable, et l'INSEE ne l'expose que campagne par campagne) : voir §5.

## 2. Source par source : les dix indicateurs

| Indicateur | Source utilisée par v2 | Millésime actuel | Prochaine mise à jour | Intérêt d'une nouvelle carte |
|---|---|---|---|---|
| Opp1 (diplôme), Opp3 (voiture, transports), Cho2 (chômage, durée), Vec2 (logement), Vec3 (contrat) | Recensement INSEE | 2023 | Millésime 2025 : **juin 2027** (officiel) | Moyen en 2027 (2/5 des petites communes), fort en 2029 |
| Opp4 : 4G | ARCEP « Mon réseau mobile » × grille Filosofi 200 m | T4 2024 | Trimestrielle : T2 2026 publié le 24/09/2026, T3 2026 le **10/12/2026**, T4 2026 le **25/03/2027** (officiel) | Faible : l'indicateur est déjà proche de 100 % |
| Opp4 : débit, fibre | ARCEP « Ma connexion internet » | T4 2024 | Trimestrielle ou semestrielle selon les sources (non confirmé) | **Fort** : la fibre progresse vite (56 % fin 2024 en moyenne, contre 13 % fin 2021) |
| Vec1 (revenu fiscal moyen) | DGFiP, impôt sur le revenu par commune (IRCOM) | revenus 2024 (publié en 2026) | Revenus 2025 : **printemps 2027** (estimation) | Moyen : les revenus évoluent, mais le classement des communes bouge peu |
| Cho1 (population en QPV) | INSEE, population des quartiers prioritaires | QPV 2024 (population de référence au 1er janvier 2020) | Prochaine actualisation non annoncée | Très faible : la liste des QPV change rarement |
| Vec4 (services du quotidien) | INSEE BPE + temps de trajet OSRM | BPE 2024 | **BPE 2025 déjà diffusée en 2026** (officiel) ; BPE 2026 attendue à l'automne 2027 (estimation) | Faible à moyen : ouverture et fermeture de commerces et médecins |
| Poids de Betti, Jenks | calculés | — | à chaque régénération | — |

Détails vérifiés pour cette session :

- **ARCEP.** Le [calendrier de publication de l'ARCEP](https://www.arcep.fr/cartes-et-donnees/nos-publications-chiffrees/calendrier-de-publication-des-documents-statistiques-de-larcep.html) donne pour la couverture mobile les dates de décembre 2026 et mars 2027. Le fichier de l'indice date du T4 2024 : le **T4 2025** est donc déjà utilisable aujourd'hui. Pour « Ma connexion internet » (débit, fibre), la documentation parle d'une mise à jour environ tous les six mois et d'un objectif trimestriel ; je n'ai pas pu confirmer le calendrier précis.
- **BPE.** La [BPE 2025](https://www.insee.fr/fr/metadonnees/source/operation/s2278/presentation) (référence au 1er janvier 2025) est publiée. L'INSEE la décrit comme annuelle depuis 2025. Pour Vec4, il suffirait de la substituer à la BPE 2024 et de relancer les trajets OSRM.
- **Revenus.** Les revenus 2024 sont parus en mai 2026 : le rythme habituel donne les revenus 2025 en mai 2027 **(estimation)**. Je n'ai pas trouvé de calendrier officiel de cette série ; à vérifier sur data.gouv.fr au printemps 2027.
- **Filosofi.** La grille carroyée à 200 m utilisée pour répartir la population dans Opp4 est au millésime 2021, et aucun millésime plus récent n'est annoncé. Elle ne sert qu'à pondérer la couverture par la population : ce n'est pas bloquant.

## 3. Quand une nouvelle carte vaut le coup

| Échéance | Ce qui est nouveau | Ampleur du changement attendu | Recommandation |
|---|---|---|---|
| **Maintenant (fin 2026)** | Opp4 en T4 2025, Vec4 en BPE 2025 sont disponibles | Petite | **Ne rien faire** : la carte est une photographie à un instant donné, on la renouvelle d'un bloc quand c'est pertinent, pas indicateur par indicateur |
| **Mars 2027** | 4G T4 2026 | Très petite | Inutile seule |
| **Juin à juillet 2027** | Recensement millésime 2025 (2/5 des petites communes renouvelées) + revenus 2025 (mai 2027, estimation) | Moyenne : 8 indicateurs sur 10 bougent, en partie | **Première mise à jour d'ensemble intéressante.** C'est la bonne date pour une v3 si vous voulez une carte à jour pour l'année 2027 |
| **Juin 2029** | Recensement millésime 2027 | Forte | Les petites communes auront toutes eu une collecte renouvelée depuis la v2 |
| **Vers 2031** | Millésime 2028, complet pour les petites communes (estimation) | — | Première carte dont tout le recensement est neuf pour toutes les communes |

Mon conseil : **une v3 en juillet 2027**, une fois le recensement 2025 et les revenus 2025 sortis. D'ici là, ne rien changer.

## 4. Comment refaire la carte le moment venu

Toutes les étapes sont déjà des scripts du dépôt. La procédure est décrite pour la v3, avec les mêmes principes que v2 (une source officielle, un millésime homogène, trace de l'ancienne version).

1. **Archiver la v2** comme la v1 (étiquette git et dossier `Données/archive_indice_v2_...`), avec `archive_indice_v1.py` comme modèle.
2. **Télécharger** dans `C:/These/Données2/indice_v2_sources/` : les bases communales du recensement (xlsx), les fichiers ARCEP du dernier trimestre, l'IRCOM de l'année, la BPE, la population des QPV.
3. **Extraire la Corse** du recensement : `extraire_corse_xlsx.py` (les en-têtes ont changé entre 2020 et 2023 : vérifier la table de correspondance dans l'onglet Métadonnées).
4. **Recalculer la couverture 4G** : `calculer_couverture_4g.py` avec la nouvelle carte ARCEP et la grille Filosofi.
5. **Construire les 10 indicateurs** : `construire_indice_v2.py` (à copier en `v3` et à mettre à jour).
6. **Régénérer l'application** : `regenerer_data_scores.py`, puis `exporter_sous_composantes.py`, puis les seuils de Jenks, les fichiers LISA et CAH, les données du chatbot, les fichiers Excel de téléchargement et `epci_agregation.json`.
7. **Mettre à jour les chiffres de la documentation** : `maj_chiffres_documentation.py`.
8. **Lancer les tests** : `python tests/run_tests.py` (régénérer la référence avec `tests/generer_baseline.py` seulement après vérification du changement).
9. **Écrire le rapport de comparaison** avec les deux cartes, sur le modèle de `RAPPORT_COMPARAISON_INDICE_V1_V2`.
10. **Mettre à jour l'onglet Évolution** si 2021 doit être remplacé par un nouveau millésime : il faut alors recalculer la série (`construire_serie_temporelle.py`) avec les entrées 2016 et 2021, et décider si l'on ajoute un nouveau point (par exemple 2026).

## 5. Ce qui reste à décider ou à faire (hors calendrier)

- **Groupes de rotation par commune** : recherche faite, liste non trouvée en ligne. Pour l'obtenir, demander à la direction régionale de l'INSEE en Corse la liste des communes recensées en 2021, 2022, 2023, 2024 et 2025 (le groupe d'une commune est l'année où elle a été enquêtée, qui se répète tous les cinq ans). Si vous préférez, je prépare le courriel.
- Porter l'onglet Évolution et l'agrégation par EPCI vers `demo_outil` (non commencé).
- Revérifier les calendriers du §2 marqués « estimation » au printemps 2027.
