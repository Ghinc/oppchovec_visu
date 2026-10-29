"""
Opp2 « jour » : effectifs de la population présente dans la commune pendant la journée (utilisé par construire_indice_v2.py et construire_serie_temporelle.py).

Définition d'origine d'OppChoVec (guide Bourdeau-Lepage, tableau 3) : Opp2 = moyenne de la diversité « jour » (catégories socioprofessionnelles des personnes qui TRAVAILLENT dans la
commune) et « nuit » (de celles qui y RÉSIDENT).

Population de jour, 7 catégories :
  * les 6 groupes d'actifs occupés (agriculteurs, artisans-commerçants-chefs d'entreprise, cadres, professions intermédiaires, employés, ouvriers) comptés à leur COMMUNE DE TRAVAIL
    (INSEE, fichier détail « Mobilités professionnelles » du recensement, variable DCLT, catégorie socioprofessionnelle CS1 [2016, 2021] ou groupe socioprofessionnel GS [2023], poids IPONDI) ;
  * les retraités comptés à leur COMMUNE DE RÉSIDENCE : sans déplacement domicile-travail, ils restent dans la commune (bases communales du recensement, 15 ans et plus).
    Les « autres personnes sans activité » ne sont pas comptées (elles comprennent des étudiants, qui se déplacent) : l'écart est négligeable (corrélation de rang 0,994).

Fichiers attendus, dans <dossier des sources>/mobpro_<année>/ : RP2023_mobpro.parquet et RP2021_mobpro.parquet (insee.fr/fr/statistiques/9004795 et 8205896),
FD_MOBPRO_2016.csv (zip RP2016_mobpro_csv.zip, insee.fr/fr/statistiques/4171531).

Usage seul (depuis stage_ambroise/Code/Python/) : résumé de la population de jour de 2023
    python calculer_diversite_jour.py "<dossier des sources, ex. C:/These/Données2/indice_v2_sources>"
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd


def lire_mobpro(dossier, annee):
    """Actifs occupés dont la commune de travail est en Corse : DataFrame (DCLT, groupe 1-8, IPONDI)."""
    d = Path(dossier) / f"mobpro_{annee}"
    if annee == 2016:
        morceaux = []
        for m in pd.read_csv(d / "FD_MOBPRO_2016.csv", sep=";", usecols=["DCLT", "CS1", "IPONDI"], dtype={"DCLT": str, "CS1": str}, chunksize=500_000):
            morceaux.append(m[m["DCLT"].str[:2].isin(["2A", "2B"])])
        m = pd.concat(morceaux)
        m["groupe"] = m["CS1"].astype(int)
    else:
        colonne = "GS" if annee == 2023 else "CS1"
        m = pd.read_parquet(d / f"RP{annee}_mobpro.parquet", columns=["DCLT", colonne, "IPONDI"])
        m = m[m["DCLT"].astype(str).str[:2].isin(["2A", "2B"])]
        m["groupe"] = m[colonne].astype(int)
    return m[["DCLT", "groupe", "IPONDI"]]


def effectifs_jour(dossier, codes, retraites, annee=2023):
    """DataFrame (communes x 7 : j1..j7) : 6 groupes d'actifs occupés à leur commune de travail, puis les retraités (série `retraites` indexée par code commune)."""
    m = lire_mobpro(dossier, annee)
    m = m[m["groupe"].between(1, 6)]
    travail = m.pivot_table(index="DCLT", columns="groupe", values="IPONDI", aggfunc="sum", fill_value=0.0).reindex(codes).fillna(0.0)
    x = travail.reindex(columns=range(1, 7), fill_value=0.0)
    x.columns = [f"j{k}" for k in range(1, 7)]
    x["j7"] = retraites.reindex(codes).astype(float)
    return x


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    from construire_indice_v2 import GEOJSON, lire
    from construire_serie_temporelle import diversite
    import json
    dossier = Path(sys.argv[1])
    codes = [f["properties"]["code"] for f in json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]]
    d = lire(dossier / "rp2023" / "base_cc_evol_struct_pop_2023.csv").reindex(codes)
    x7 = effectifs_jour(dossier, codes, d["C23_POP15P_STAT_GSEC32"])
    print("effectif de jour (travailleurs + retraités) : min", round(x7.sum(axis=1).min(), 1), "; communes sous 10 :", int((x7.sum(axis=1) < 10).sum()))
    print((diversite(x7) / np.log(7)).describe().round(3))


if __name__ == "__main__":
    main()
