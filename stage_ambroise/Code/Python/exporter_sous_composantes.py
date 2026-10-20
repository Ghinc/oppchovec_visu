"""
Export des sous-composantes brutes des indicateurs OppChoVec pour les sliders du web (indice courant v2).

Écrit Code/WEB/sous_composantes.json : pour chaque commune, les valeurs brutes des sous-composantes des 10 indicateurs (Opp1 et Opp2 en parts, Opp3, Opp4, Vec2 et Vec3 en sous-composantes ; Cho1, Cho2, Vec1 et Vec4 en une seule composante),
lues dans Données/indice_v2/sources_indice_v2.json (produit par construire_indice_v2.py à partir des sources officielles).

Le script vérifie que chaque recomposition redonne la valeur du JSON data_scores_0_10.json et refuse d'écrire le fichier au moindre écart : les sliders ne doivent jamais changer l'indice.

Usage :
    python exporter_sous_composantes.py
"""

import json
import math
import sys
from pathlib import Path


WEB_DIR = Path(__file__).resolve().parent.parent / "WEB"
TOLERANCE = 1e-9

SOURCES_V2 = WEB_DIR.parent.parent / "Données" / "indice_v2" / "sources_indice_v2.json"

# Communes avec un vrai réseau de bus urbain (+100 sur Opp3) : liste fournie par la doctorante
VILLES_RESEAU_BUS = {"2A004", "2B033", "2A247", "2B134"}  # Ajaccio, Bastia, Porto-Vecchio, L'Île-Rousse

# Catégories d'emploi de Vec3 et leur poids de stabilité. Le recensement 2023 ne distingue plus CDD, intérim, emplois aidés et apprentis (une seule catégorie « autre contrat ») :
# elles sont regroupées au poids moyen 0,5 (v1 : 0,25 ; 0,5 ; 0,75).
VEC3_CATEGORIES = {
    "stable": ("CDI, fonctionnaires et non-salariés", 1),
    "autres": ("Autres contrats (CDD, intérim, emplois aidés, apprentis)", 0.5),
    "chomeur": ("Chômeurs", 0),
}


# Formules des indicateurs à partir de leurs sous-composantes (miroir de script.js)
def calc_opp1(c):
    total = sum(c[f"n{k}"] for k in range(1, 8))
    return sum(k * c[f"n{k}"] for k in range(1, 8)) / total if total else 0


def calc_opp2(c):
    x = [c[f"cs{k}"] for k in range(1, 9)]
    mu = sum(x) / 8
    return sum((v / mu) * math.log(v / mu) for v in x if v > 0) / 8


def calc_opp3(c):
    return c["voiture"] + (100 if c["tc"] > 0 else 0) + (100 if c["bus"] else 0)


def calc_opp4(c):
    return (c["g4"] + c["debit"] + c["fibre"]) / 3


def calc_cho1(c):
    return -math.log(c["personnes_qpv"]) if c["personnes_qpv"] > 0 else 0


def calc_cho2(c):
    return c["francais"]


def calc_vec1(c):
    return c["revenu"]


def calc_vec4(c):
    return c["services"]


def calc_vec2(c):
    return (math.exp(-c["pers_piece"]) + c["maisons"]) / 2


def calc_vec3(c):
    total = sum(c[k] for k in VEC3_CATEGORIES)
    if total == 0:
        return 0
    return sum(c[k] * poids for k, (_, poids) in VEC3_CATEGORIES.items()) / total


CALCULS = {"Opp1": calc_opp1, "Opp2": calc_opp2, "Cho2": calc_cho2, "Vec1": calc_vec1, "Vec4": calc_vec4, "Opp3": calc_opp3, "Opp4": calc_opp4, "Cho1": calc_cho1, "Vec2": calc_vec2, "Vec3": calc_vec3}


def sous_composantes_par_commune(noms_attendus):
    """Sous-composantes indexées par nom de commune (noms de data_scores_0_10.json), lues dans sources_indice_v2.json."""
    communes = json.loads(SOURCES_V2.read_text(encoding="utf-8"))["communes"]
    if set(communes) != set(noms_attendus):
        sys.exit(f"Communes différentes de data_scores_0_10.json : {sorted(set(communes) ^ set(noms_attendus))}")
    sortie = {}
    for nom, c in communes.items():
        total1 = sum(c["Opp1"][f"niveau{k}"] for k in range(1, 8))
        total2 = sum(c["Opp2"][f"cs{k}"] for k in range(1, 9))
        total3 = c["Vec3"]["chomeur"] + c["Vec3"]["autres"] + c["Vec3"]["stable"]
        sortie[nom] = {
            "Opp1": {f"n{k}": 100 * c["Opp1"][f"niveau{k}"] / total1 for k in range(1, 8)},
            "Opp2": {f"cs{k}": 100 * c["Opp2"][f"cs{k}"] / total2 for k in range(1, 9)},
            "Cho2": {"francais": c["Cho2"]["valeur"]},
            "Vec1": {"revenu": c["Vec1"]["valeur"]},
            "Vec4": {"services": c["Vec4"]["valeur"]},
            "Opp3": {"voiture": c["Opp3"]["voiture"], "tc": c["Opp3"]["tc"], "bus": 1 if c["code"] in VILLES_RESEAU_BUS else 0},
            "Opp4": {"g4": c["Opp4"]["g4"], "debit": c["Opp4"]["debit"], "fibre": c["Opp4"]["fibre"]},
            "Cho1": {"personnes_qpv": c["Cho1"]["personnes_qpv"]},
            "Vec2": {"pers_piece": c["Vec2"]["pers_piece"], "maisons": c["Vec2"]["maisons"]},
            "Vec3": {k: 100 * c["Vec3"][k] / total3 for k in VEC3_CATEGORIES},
        }
    return sortie


def main():
    scores = json.loads((WEB_DIR / "data_scores_0_10.json").read_text(encoding="utf-8"))
    sortie = sous_composantes_par_commune(scores)

    # Contrôle : chaque recomposition doit redonner exactement l'indicateur du JSON
    echec = False
    for ind, calcul in CALCULS.items():
        err, pire = max((abs(calcul(sc[ind]) - scores[nom][ind]), nom) for nom, sc in sortie.items())
        statut = "OK" if err < TOLERANCE else "KO"
        echec |= statut == "KO"
        print(f"{ind}: {statut}  (écart max {err:.2e}, {pire})")
    if echec:
        sys.exit("Recomposition non conforme : fichier non écrit.")

    chemin = WEB_DIR / "sous_composantes.json"
    chemin.write_text(json.dumps(sortie, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(sortie)} communes écrites dans {chemin}")


if __name__ == "__main__":
    main()
