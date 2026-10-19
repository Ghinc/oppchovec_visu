"""
Opp4 (accès aux TIC) pour la série temporelle 2016 / 2021 : moyenne de trois composantes en %, comme dans l'appli (Opp4 = (4G + débit + fibre) / 3).
Écrit Données/opp4_serie_2016_2021.json, lu par construire_serie_temporelle.py.

  4G     part de la population de la commune couverte par la 4G d'AU MOINS UN des quatre opérateurs : cartes de couverture théorique de l'ARCEP croisées avec la grille de
         population INSEE de 200 m (calculer_couverture_4g.py). 2016 : cartes de mars 2017 (archives ARCEP 2017_T1, les plus proches de 2016) ; 2021 : cartes de décembre 2021.
  débit  part des locaux éligibles à un débit de 30 Mbit/s ou plus.
         2016 : Observatoire France Très Haut Débit (Agence du numérique), T4 2016, « toutes technologies (DSL, câble et FttH) », colonne « 30M et + » ;
         2021 : ARCEP, « Ma connexion internet », T4 2021, commune_debit_filaire.csv, elig_thd30 / nbr (offres filaires : cuivre, câble, fibre ; le fichier « toutes technologies »
         inclut le satellite et donne 100 % partout). Ce fichier retrouve le débit de l'appli (corrélation 0,97, 347 communes sur 360 à ±1 point).
  fibre  part des locaux raccordables à la fibre jusqu'à l'abonné (FttH) : 2016 : même fichier THD, bloc « FttH éligibles » (≈ 0,2 % en moyenne : trois communes) ;
         2021 : ARCEP, commune_techno.csv, elig_ftth / nbr. (La fibre de l'appli, fibre_corse.csv, est une classe grossière 0 / 5 / 25 / 50 / 80 %, non reproductible : on prend la mesure.)

Usage (depuis stage_ambroise/Code/Python/) :
    python construire_opp4_serie.py "<thd_T4_2016.xlsx>" "<commune_debit_filaire.csv 2021_T4>" "<commune_techno.csv 2021_T4>" "<couverture4g_2017_T1.json>" "<couverture4g_2021_T4.json>"
"""

import json
import sys
from pathlib import Path

import pandas as pd

GEOJSON = Path(__file__).resolve().parents[2] / "Données" / "Commune_Corse.geojson"
SORTIE = Path(__file__).resolve().parents[2] / "Données" / "opp4_serie_2016_2021.json"


def main():
    if len(sys.argv) != 6:
        sys.exit(__doc__)
    thd, debit21, techno21, cou16, cou21 = sys.argv[1:]
    noms = {f["properties"]["code"]: f["properties"]["nom"] for f in json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]}
    a = pd.read_excel(thd, sheet_name="2016 T4", header=None, skiprows=2, dtype={0: str})
    a = a[a[0].astype(str).str.startswith(("2A", "2B"))].set_index(0)
    debit16 = 100 * pd.to_numeric(a[7], errors="coerce")          # « 30M et + », toutes technologies
    fibre16 = 100 * pd.to_numeric(a[19], errors="coerce")         # FttH, « éligibles »
    d = pd.read_csv(debit21, sep=";", dtype={"code_insee": str}).set_index("code_insee")
    t = pd.read_csv(techno21, sep=";", dtype={"code_insee": str}).set_index("code_insee")
    debit21_ = 100 * pd.to_numeric(d["elig_thd30"]) / pd.to_numeric(d["nbr"])
    fibre21 = 100 * pd.to_numeric(t["elig_ftth"]) / pd.to_numeric(t["nbr"])
    g16 = json.loads(Path(cou16).read_text(encoding="utf-8"))["communes"]
    g21 = json.loads(Path(cou21).read_text(encoding="utf-8"))["communes"]
    communes = {}
    for code, nom in noms.items():
        manque = [k for k, s in (("debit16", debit16), ("fibre16", fibre16), ("debit21", debit21_), ("fibre21", fibre21)) if pd.isna(s.get(code))]
        if manque or g16[nom]["part_population_couverte_4g_pct"]["au_moins_un"] is None or g21[nom]["part_population_couverte_4g_pct"]["au_moins_un"] is None:
            sys.exit(f"{nom} ({code}) : valeur manquante {manque}")
        communes[nom] = {"code": code,
                         "2016": {"g4": g16[nom]["part_population_couverte_4g_pct"]["au_moins_un"], "debit": float(debit16[code]), "fibre": float(fibre16[code]),
                                  "g4_estime_au_centre": bool(g16[nom].get("estime_au_centre"))},
                         "2021": {"g4": g21[nom]["part_population_couverte_4g_pct"]["au_moins_un"], "debit": float(debit21_[code]), "fibre": float(fibre21[code]),
                                  "g4_estime_au_centre": bool(g21[nom].get("estime_au_centre"))}}
    sortie = {"methode": "Opp4 = (4G + débit >= 30 Mbit/s + fibre) / 3, en % ; 4G = population couverte par au moins un opérateur (ARCEP x grille INSEE 200 m) ; débit et fibre = locaux éligibles",
              "sources": {"2016": {"g4": "ARCEP, couverture 4G théorique 2017_T1 (mars 2017), grille INSEE Filosofi 2019", "debit_fibre": "Observatoire France Très Haut Débit, T4 2016"},
                          "2021": {"g4": "ARCEP, couverture 4G théorique 2021_T4, grille INSEE Filosofi 2021", "debit_fibre": "ARCEP, Ma connexion internet, T4 2021 (commune_debit_filaire.csv, commune_techno.csv)"}},
              "communes": communes}
    SORTIE.write_text(json.dumps(sortie, indent=1, ensure_ascii=False), encoding="utf-8")
    for an in ("2016", "2021"):
        for k in ("g4", "debit", "fibre"):
            v = [c[an][k] for c in communes.values()]
            print(f"{an} {k:6s} moyenne des communes {sum(v) / len(v):5.1f} %")
    print(f"écrit : {SORTIE}")


if __name__ == "__main__":
    main()
