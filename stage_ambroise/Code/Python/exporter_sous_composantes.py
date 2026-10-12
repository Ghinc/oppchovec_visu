"""
Export des sous-composantes brutes des indicateurs OppChoVec pour les sliders du web.

Écrit Code/WEB/sous_composantes.json : pour chaque commune, les valeurs brutes des
sous-composantes des indicateurs décomposables (Opp3, Opp4, Cho1, Vec2, Vec3).

Les formules ci-dessous reproduisent data_scores_0_10.json (et non oppchovec.py, qui
n'en est plus la source : Opp4 y est calculé sans la fibre et Cho2 depuis Cho2.xlsx).
Le script vérifie que chaque recomposition redonne la valeur du JSON et refuse
d'écrire le fichier au moindre écart : les sliders ne doivent jamais changer l'indice.

Usage :
    python exporter_sous_composantes.py "C:/These/Données2/visualisation_oppchovec_1111/Stage Ambroise"
"""

import json
import math
import sys
from pathlib import Path

import pandas as pd

WEB_DIR = Path(__file__).resolve().parent.parent / "WEB"
TOLERANCE = 1e-9

# Noms du mapping INSEE qui diffèrent de ceux de data_scores_0_10.json
ALIAS_NOMS = {"La Porta": "Porta", "L'Île-Rousse": "Île-Rousse"}

# Communes avec un vrai réseau de bus urbain (+100 sur Opp3)
VILLES_RESEAU_BUS = {"2A004", "2B033", "2A247"}  # Ajaccio, Bastia, Porto-Vecchio

# Catégories d'emploi de Vec3 et leur poids de stabilité : (rang - 1) / 4, avec le classement
# de la méthode d'origine (OppChoVec.ipynb) : 1 chômeur, 2 emploi aidé, 3 ponctuel, 4 CDD, 5 CDI
VEC3_CATEGORIES = {
    "stable": ("Emploi stable (5)", 1),
    "cdd": ("Contrat à durée déterminée (4)", 0.75),
    "ponctuel": ("Contrat ponctuel (3)", 0.5),
    "chomeur": ("Chomeur (1)", 0),
    "aide": ("Emploi aidé (2)", 0.25),
}


# Formules des indicateurs à partir de leurs sous-composantes (miroir de script.js)
def calc_opp3(c):
    return c["voiture"] + (100 if c["tc"] > 0 else 0) + (100 if c["bus"] else 0)


def calc_opp4(c):
    return (c["g4"] + c["debit"] + c["fibre"]) / 3


def calc_cho1(c):
    return -math.log(c["personnes_qpv"]) if c["personnes_qpv"] > 0 else 0


def calc_vec2(c):
    return (math.exp(-c["pers_piece"]) + (c["sdb"] + c["chauffage"]) / 2 + c["maisons"]) / 3


def calc_vec3(c):
    total = sum(c[k] for k in VEC3_CATEGORIES)
    if total == 0:
        return 0
    return sum(c[k] * poids for k, (_, poids) in VEC3_CATEGORIES.items()) / total


CALCULS = {"Opp3": calc_opp3, "Opp4": calc_opp4, "Cho1": calc_cho1, "Vec2": calc_vec2, "Vec3": calc_vec3}


def charger(dossier, fichier):
    df = pd.read_csv(dossier / fichier) if fichier.endswith(".csv") else pd.read_excel(dossier / fichier)
    cle = next(c for c in df.columns if c in ("Code commune", "code_commune"))
    return df.set_index(cle)


def lire_sous_composantes(source):
    d = source / "Données" / "Corse_Commune"
    opp3 = charger(d, "Opp3.xlsx")
    opp4 = charger(d, "Opp4.xlsx")
    fibre = charger(d, "fibre_corse.csv")
    cho1 = charger(d, "Cho1_personnes.xlsx")
    vec2 = charger(d, "vec2_lb.csv")
    vec3 = charger(d, "Vec3.xlsx")

    sc = {}
    for code in opp3.index:
        sc[code] = {
            "Opp3": {
                "voiture": float(opp3.loc[code, "Part des ménages ayant au moins 1 voiture 2021"]),
                "tc": float(opp3.loc[code, "Accès aux réseaux de transport"]),
                "bus": 1 if code in VILLES_RESEAU_BUS else 0,
            },
            "Opp4": {
                "g4": float(opp4.loc[code, "Proportion de population couverte par la 4G"]),
                "debit": float(opp4.loc[code, "Proportion de population avec débit > 30Mb/s"]),
                "fibre": float(fibre.loc[code, "taux_fibre"]),
            },
            "Cho1": {"personnes_qpv": float(cho1.loc[code, "Nb_Personnes_Quartiers_Prioritaires"])},
            "Vec2": {
                "pers_piece": float(vec2.loc[code, "pers_par_piece_moy"]),
                "sdb": float(vec2.loc[code, "pct_avec_sdb"]),
                "chauffage": float(vec2.loc[code, "pct_chauffage"]),
                "maisons": float(vec2.loc[code, "pct_maisons"]),
            },
            "Vec3": {k: float(vec3.loc[code, col]) for k, (col, _) in VEC3_CATEGORIES.items()},
        }
    return sc


def sous_composantes_par_commune(source, noms_attendus):
    """Sous-composantes indexées par nom de commune (noms de data_scores_0_10.json)."""
    mapping = pd.read_csv(source / "Données" / "Corse_Commune" / "mapping_communes.csv")
    code2nom = {c: ALIAS_NOMS.get(n, n) for c, n in zip(mapping.code_commune, mapping.nom_commune)}

    sortie = {}
    for code, sc in lire_sous_composantes(source).items():
        nom = code2nom.get(code)
        if nom not in noms_attendus:
            sys.exit(f"Commune {code} ({nom}) absente de data_scores_0_10.json")
        sortie[nom] = sc
    manquantes = set(noms_attendus) - set(sortie)
    if manquantes:
        sys.exit(f"Communes sans sous-composantes : {sorted(manquantes)}")
    return sortie


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source = Path(sys.argv[1])
    scores = json.loads((WEB_DIR / "data_scores_0_10.json").read_text(encoding="utf-8"))
    sortie = sous_composantes_par_commune(source, scores)

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
