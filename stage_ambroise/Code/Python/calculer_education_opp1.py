"""
Calcule Opp1 (niveau d'éducation) par commune à partir du recensement INSEE, et l'écrit dans
Données/education_communes_opp1.json (fichier versionné : c'est la source d'Opp1 pour regenerer_opp1.py).

Source : INSEE, Recensement de la population 2020, base infracommunale « Diplômes - Formation »
(base-ic-diplomes-formation-2020.xlsx, feuille IRIS, géographie au 01/01/2022).
Téléchargement : insee.fr, Recensement de la population > bases de données infracommunales > « Diplômes - Formation » (millésime 2020,
fichier base-ic-diplomes-formation-2020_xlsx.zip).

Méthode
-------
1. On garde les IRIS des départements 2A et 2B et on les additionne par commune (une commune non irisée est un seul IRIS).
2. Le fichier donne, pour la population de 15 ans ou plus NON SCOLARISÉE, le plus haut diplôme en 7 niveaux :
       1 aucun diplôme ou CEP        5 bac + 2
       2 BEPC, brevet des collèges   6 bac + 3 ou 4
       3 CAP, BEP                    7 bac + 5 ou plus
       4 baccalauréat
3. On veut les 18 ans ou plus. Les effectifs sont agrégés (pas d'âge individuel), donc on retire
   un EFFECTIF : les 15-17 ans non scolarisés = (population 15-17 ans) - (population scolarisée 15-17 ans),
   deux colonnes du même fichier. Hypothèse : ils n'ont aucun diplôme ou seulement le CEP (niveau 1),
   cas de loin le plus fréquent à cet âge ; on les retire de la catégorie « aucun diplôme ou CEP »
   (plafonné à l'effectif de cette catégorie). Ils représentent 0,19 % de l'effectif en Corse ;
   quelle que soit l'hypothèse (niveau 1, 2 ou 3), le niveau d'une commune varie d'au plus 0,055 point sur 7.
4. Opp1 = niveau moyen = somme(niveau x effectif du niveau) / somme(effectifs).
   Population de référence : les 18 ans ou plus non scolarisés (les étudiants sont exclus : définition INSEE).

Usage :
    python calculer_education_opp1.py "<chemin>/base-ic-diplomes-formation-2020.xlsx"

Ensuite : python regenerer_opp1.py, puis les étapes de « Procédure de régénération » (WEB/README_FICHIERS.md).
"""

import json
import sys
from pathlib import Path

import pandas as pd

DONNEES = Path(__file__).resolve().parents[2] / "Données"
SORTIE = DONNEES / "education_communes_opp1.json"
GEOJSON = DONNEES / "Commune_Corse.geojson"

NIVEAUX = {  # colonne INSEE -> niveau
    "P20_NSCOL15P_DIPLMIN": 1,
    "P20_NSCOL15P_BEPC": 2,
    "P20_NSCOL15P_CAPBEP": 3,
    "P20_NSCOL15P_BAC": 4,
    "P20_NSCOL15P_SUP2": 5,
    "P20_NSCOL15P_SUP34": 6,
    "P20_NSCOL15P_SUP5": 7,
}
SOURCE = ("INSEE, Recensement de la population 2020, base infracommunale Diplômes-Formation "
          "(base-ic-diplomes-formation-2020), géographie au 01/01/2022")


def calculer(chemin_xlsx):
    df = pd.read_excel(chemin_xlsx, sheet_name="IRIS", header=5)
    df = df[df["DEP"].isin(["2A", "2B"])]
    colonnes = list(NIVEAUX) + ["P20_NSCOL15P", "P20_POP1517", "P20_SCOL1517"]
    g = df.groupby("COM")[colonnes].sum()

    noms = {f["properties"]["code"]: f["properties"]["nom"]
            for f in json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]}
    if set(g.index) != set(noms):
        sys.exit(f"Communes différentes du GeoJSON : seulement INSEE {sorted(set(g.index) - set(noms))}, "
                 f"seulement GeoJSON {sorted(set(noms) - set(g.index))}")

    sortie, plafonnees = {}, []
    for code, r in g.iterrows():
        effectifs = [float(r[c]) for c in NIVEAUX]
        if abs(sum(effectifs) - r["P20_NSCOL15P"]) > 1e-6:
            sys.exit(f"{code} : la somme des 7 niveaux n'est pas le total des 15 ans ou plus non scolarisés")
        a_retirer = max(0.0, float(r["P20_POP1517"] - r["P20_SCOL1517"]))     # 15-17 ans non scolarisés
        retire = min(a_retirer, effectifs[0])
        if retire < a_retirer - 1e-9:
            plafonnees.append(code)
        effectifs[0] -= retire
        total = sum(effectifs)
        if total <= 0:
            sys.exit(f"{code} : aucun effectif de 18 ans ou plus non scolarisé")
        niveau = sum(n * e for n, e in zip(NIVEAUX.values(), effectifs)) / total
        sortie[noms[code]] = {
            "code": code,
            "effectif_15p_non_scolarises": float(r["P20_NSCOL15P"]),
            "retire_15_17_ans": retire,
            "effectif_18p_non_scolarises": total,
            "effectifs_par_niveau": dict(zip(NIVEAUX.values(), effectifs)),
            "niveau_moyen": niveau,
        }
    print(f"{len(sortie)} communes ; 15-17 ans non scolarisés retirés : "
          f"{sum(v['retire_15_17_ans'] for v in sortie.values()):.0f} personnes ; retrait plafonné dans {len(plafonnees)} commune(s)")
    return {"source": SOURCE, "niveaux": "1 aucun diplôme ou CEP, 2 BEPC, 3 CAP-BEP, 4 bac, 5 bac+2, 6 bac+3/4, 7 bac+5 ou plus",
            "hypothese": "15-17 ans non scolarisés retirés de la catégorie « aucun diplôme ou CEP »", "communes": sortie}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    donnees = calculer(sys.argv[1])
    niveaux = [v["niveau_moyen"] for v in donnees["communes"].values()]
    print(f"niveau moyen : min {min(niveaux):.3f}, moyenne {sum(niveaux) / len(niveaux):.3f}, max {max(niveaux):.3f}")
    SORTIE.write_text(json.dumps(donnees, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"écrit : {SORTIE}")


if __name__ == "__main__":
    main()
