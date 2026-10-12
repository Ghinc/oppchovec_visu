"""
Régénère Code/WEB/data_scores_0_10.json à partir des indicateurs bruts.

1. Recalcule Score_*, OppChoVec et leurs versions 0-10 depuis les 10 indicateurs du JSON
   actuel et vérifie qu'on retrouve exactement le fichier (sinon on s'arrête : la chaîne
   de calcul ne serait pas la bonne).
2. Remplace Vec3 par sa recomposition depuis les sous-composantes brutes (poids de
   exporter_sous_composantes.py), puis recalcule tout et écrit le fichier.

Les autres indicateurs ne sont pas touchés. Le script est idempotent.

Usage :
    python regenerer_data_scores.py "C:/These/Données2/visualisation_oppchovec_1111/Stage Ambroise"

Ensuite, régénérer les fichiers dérivés : seuils Jenks (calculer_jenks_5_classes.py),
CAH (graphique_ecarts_types_cah.py, preparer_donnees_cah_web_complet.py,
generer_cah_data_js_complet.py), chatbot (generer_donnees_communes_chatbot.py),
LISA (gen_lisa_knn5.py) et sous_composantes.json (exporter_sous_composantes.py).
"""

import json
import sys
from pathlib import Path

from exporter_sous_composantes import WEB_DIR, calc_vec3, sous_composantes_par_commune

ALPHA, BETA = 2.5, 1.5
DIMENSIONS = {
    "Opp": ["Opp1", "Opp2", "Opp3", "Opp4"],
    "Cho": ["Cho1", "Cho2"],
    "Vec": ["Vec1", "Vec2", "Vec3", "Vec4"],
}
TOLERANCE = 1e-9
CHAMPS_DEPENDANT_DE_VEC3 = ["Vec3", "Score_Vec", "Score_Vec_0_10", "OppChoVec", "OppChoVec_0_10"]


def min_max(valeurs):
    mn, mx = min(valeurs.values()), max(valeurs.values())
    return {c: (v - mn) / (mx - mn) if mx != mn else 0 for c, v in valeurs.items()}


def recalculer(data):
    """Recalcule en place les scores et l'indice (pondérations égales) depuis Opp1..Vec4."""
    communes = list(data)
    norm = {ind: min_max({c: data[c][ind] for c in communes}) for inds in DIMENSIONS.values() for ind in inds}
    for dim, inds in DIMENSIONS.items():
        for c in communes:
            data[c][f"Score_{dim}"] = sum(norm[ind][c] for ind in inds) / len(inds)
        score_010 = min_max({c: data[c][f"Score_{dim}"] for c in communes})
        for c in communes:
            data[c][f"Score_{dim}_0_10"] = score_010[c] * 10
    for c in communes:
        somme = sum(data[c][f"Score_{dim}"] ** BETA for dim in DIMENSIONS)
        data[c]["OppChoVec"] = (1 / 3) * somme ** (ALPHA / BETA)
    occ_010 = min_max({c: data[c]["OppChoVec"] for c in communes})
    for c in communes:
        data[c]["OppChoVec_0_10"] = occ_010[c] * 10


def ecart_max(a, b):
    return max(abs(a[c][k] - b[c][k]) for c in a for k in a[c])


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    chemin = WEB_DIR / "data_scores_0_10.json"
    actuel = json.loads(chemin.read_text(encoding="utf-8"))

    # 1. Contrôle : la chaîne de calcul redonne le fichier actuel
    controle = json.loads(json.dumps(actuel))
    recalculer(controle)
    err = ecart_max(actuel, controle)
    if err > TOLERANCE:
        sys.exit(f"Le recalcul ne reproduit pas le JSON actuel (écart {err:.2e}) : arrêt.")
    print(f"Contrôle : recalcul identique au JSON actuel (écart max {err:.1e})")

    # 2. Vec3 depuis les sous-composantes brutes, puis recalcul complet
    sc = sous_composantes_par_commune(Path(sys.argv[1]), actuel)
    nouveau = json.loads(json.dumps(actuel))
    for c in nouveau:
        nouveau[c]["Vec3"] = calc_vec3(sc[c]["Vec3"])
    recalculer(nouveau)

    for cle in ["Vec3", "Score_Vec_0_10", "OppChoVec_0_10"]:
        e = max(abs(nouveau[c][cle] - actuel[c][cle]) for c in actuel)
        print(f"  {cle:15s} écart max {e:.4f}")
    inchanges = [k for k in ["Opp1", "Opp2", "Opp3", "Opp4", "Cho1", "Cho2", "Vec1", "Vec2", "Vec4",
                             "Score_Opp", "Score_Cho", "Score_Opp_0_10", "Score_Cho_0_10"]
                 if max(abs(nouveau[c][k] - actuel[c][k]) for c in actuel) > TOLERANCE]
    if inchanges:
        sys.exit(f"Champs modifiés de façon inattendue : {inchanges}")

    # N'écrire que les champs qui dépendent de Vec3 : les autres restent identiques au bit près
    sortie = json.loads(json.dumps(actuel))
    for c in sortie:
        for cle in CHAMPS_DEPENDANT_DE_VEC3:
            sortie[c][cle] = nouveau[c][cle]
    chemin.write_text(json.dumps(sortie, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{len(nouveau)} communes écrites dans {chemin}")


if __name__ == "__main__":
    main()
