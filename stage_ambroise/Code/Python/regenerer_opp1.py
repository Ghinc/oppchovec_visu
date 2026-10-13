"""
Remplace Opp1 (niveau d'éducation) dans Code/WEB/data_scores_0_10.json par le niveau de diplôme communal
calculé depuis le recensement INSEE (Données/education_communes_opp1.json, produit par calculer_education_opp1.py),
puis recalcule les scores et l'indice. Les autres indicateurs ne sont pas touchés.

Sécurités : le recalcul doit d'abord retrouver exactement le fichier actuel ; seuls les champs qui dépendent d'Opp1
(Opp1, Score_Opp, Score_Opp_0_10, OppChoVec, OppChoVec_0_10) sont écrits, et le script s'arrête si un autre champ
changerait. Idempotent.

Usage (depuis stage_ambroise/Code/Python/) :
    python regenerer_opp1.py

Ensuite, régénérer les fichiers dérivés (WEB/README_FICHIERS.md, « Procédure de régénération », étapes 2 et suivantes).
"""

import json
import sys

from exporter_sous_composantes import WEB_DIR
from regenerer_data_scores import TOLERANCE, ecart_max, recalculer
from calculer_education_opp1 import SORTIE

CHAMPS_DEPENDANT_DE_OPP1 = ["Opp1", "Score_Opp", "Score_Opp_0_10", "OppChoVec", "OppChoVec_0_10"]


def main():
    chemin = WEB_DIR / "data_scores_0_10.json"
    actuel = json.loads(chemin.read_text(encoding="utf-8"))
    education = json.loads(SORTIE.read_text(encoding="utf-8"))["communes"]
    if set(education) != set(actuel):
        sys.exit(f"Communes différentes : {sorted(set(education) ^ set(actuel))}")

    # 1. Contrôle : la chaîne de calcul redonne le fichier actuel
    controle = json.loads(json.dumps(actuel))
    recalculer(controle)
    err = ecart_max(actuel, controle)
    if err > TOLERANCE:
        sys.exit(f"Le recalcul ne reproduit pas le JSON actuel (écart {err:.2e}) : arrêt.")
    print(f"Contrôle : recalcul identique au JSON actuel (écart max {err:.1e})")

    # 2. Opp1 depuis le recensement, puis recalcul complet
    nouveau = json.loads(json.dumps(actuel))
    for c in nouveau:
        nouveau[c]["Opp1"] = education[c]["niveau_moyen"]
    recalculer(nouveau)

    for cle in CHAMPS_DEPENDANT_DE_OPP1:
        e = max(abs(nouveau[c][cle] - actuel[c][cle]) for c in actuel)
        print(f"  {cle:15s} écart max {e:.4f}")
    inattendus = [k for k in actuel[next(iter(actuel))] if k not in CHAMPS_DEPENDANT_DE_OPP1
                  and max(abs(nouveau[c][k] - actuel[c][k]) for c in actuel) > TOLERANCE]
    if inattendus:
        sys.exit(f"Champs modifiés de façon inattendue : {inattendus}")

    sortie = json.loads(json.dumps(actuel))
    for c in sortie:
        for cle in CHAMPS_DEPENDANT_DE_OPP1:
            sortie[c][cle] = nouveau[c][cle]
    chemin.write_text(json.dumps(sortie, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{len(nouveau)} communes écrites dans {chemin}")


if __name__ == "__main__":
    main()
