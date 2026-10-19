"""
Régénère Code/WEB/data_scores_0_10.json (indice courant v2) à partir de Données/indice_v2/sources_indice_v2.json (produit par construire_indice_v2.py).

1. Contrôle : le recalcul des scores depuis les 10 indicateurs du JSON actuel doit retrouver exactement le fichier (sinon la chaîne de calcul n'est pas la bonne).
2. Remplace les 10 indicateurs bruts par ceux de la v2, recalcule Score_*, OppChoVec et leurs versions 0-10 (pondérations égales, normalisation min-max), écrit le fichier.

Usage (depuis stage_ambroise/Code/Python/) :
    python regenerer_data_scores.py

Ensuite, régénérer les fichiers dérivés : sous_composantes.json (exporter_sous_composantes.py), seuils Jenks (calculer_jenks_5_classes.py),
CAH (graphique_ecarts_types_cah.py, preparer_donnees_cah_web_complet.py, generer_cah_data_js_complet.py), chatbot (generer_donnees_communes_chatbot.py),
LISA (gen_lisa_knn5.py) et les tableaux Excel (gen_excel_010.py) : voir WEB/README_FICHIERS.md, « Procédure de régénération ».
"""

import json
import sys
from pathlib import Path

from exporter_sous_composantes import SOURCES_V2, WEB_DIR

ALPHA, BETA = 2.5, 1.5
DIMENSIONS = {
    "Opp": ["Opp1", "Opp2", "Opp3", "Opp4"],
    "Cho": ["Cho1", "Cho2"],
    "Vec": ["Vec1", "Vec2", "Vec3", "Vec4"],
}
TOLERANCE = 1e-9
INDICATEURS = [k for inds in DIMENSIONS.values() for k in inds]


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
    chemin = WEB_DIR / "data_scores_0_10.json"
    actuel = json.loads(chemin.read_text(encoding="utf-8"))
    v2 = json.loads(SOURCES_V2.read_text(encoding="utf-8"))["communes"]
    if set(v2) != set(actuel):
        sys.exit(f"Communes différentes : {sorted(set(v2) ^ set(actuel))}")

    # 1. Contrôle : la chaîne de calcul redonne le fichier actuel
    controle = json.loads(json.dumps(actuel))
    recalculer(controle)
    err = ecart_max(actuel, controle)
    if err > TOLERANCE:
        sys.exit(f"Le recalcul ne reproduit pas le JSON actuel (écart {err:.2e}) : arrêt.")
    print(f"Contrôle : recalcul identique au JSON actuel (écart max {err:.1e})")

    # 2. Indicateurs de la v2, puis recalcul complet
    nouveau = json.loads(json.dumps(actuel))
    for c in nouveau:
        for k in INDICATEURS:
            nouveau[c][k] = v2[c][k]["valeur"]
    recalculer(nouveau)
    for cle in INDICATEURS + ["Score_Opp_0_10", "Score_Cho_0_10", "Score_Vec_0_10", "OppChoVec_0_10"]:
        e = max(abs(nouveau[c][cle] - actuel[c][cle]) for c in actuel)
        print(f"  {cle:15s} écart max avec l'ancienne version {e:.4f}")
    chemin.write_text(json.dumps(nouveau, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{len(nouveau)} communes écrites dans {chemin}")


if __name__ == "__main__":
    main()
