"""
Construit Données/epci_corse_2026.json : les EPCI à fiscalité propre de la Corse, leurs communes membres et la population de chaque commune.

Sources (toutes deux officielles, téléchargées le 16/10/2026) :
  * DGCL, « Composition communale des EPCI à fiscalité propre au 1er janvier 2026 » (epcicom2026.xlsx) : EPCI, communes membres, populations 2026 (municipale et totale)
    https://www.collectivites-locales.gouv.fr/files/files/Etudes-et-statistiques/DESL/2026/EPCI/epcicom2026.xlsx
  * INSEE, « Populations de référence 2023 en vigueur au 1er janvier 2026 » (fichier d'ensemble, feuille Communes) : sert de contrôle des populations
    https://www.insee.fr/fr/statistiques/fichier/8680726/ensemble.xlsx
  * INSEE, « Intercommunalité - Métropole au 01/01/2026 » (feuille Composition_communale, optionnel) : sert de contrôle de l'appartenance
    https://www.insee.fr/fr/statistiques/fichier/2510634/epci_au_01-01-2026.zip

Contrôles faits à la construction : 360 communes, aucune en double ni hors Corse ; mêmes codes que Commune_Corse.geojson ; populations identiques à celles de l'INSEE pour les 360 communes ;
somme des populations des communes membres = population de l'EPCI.

Usage (depuis stage_ambroise/Code/Python/) :
    python construire_epci_corse.py <epcicom2026.xlsx> <ensemble.xlsx> [<EPCI_au_01-01-2026.xlsx>]
"""

import json
import sys
from pathlib import Path

import pandas as pd

RACINE = Path(__file__).resolve().parents[2]
GEOJSON = RACINE / "Données" / "Commune_Corse.geojson"
SORTIE = RACINE / "Données" / "epci_corse_2026.json"


def construire(epcicom, ensemble, insee_epci=None):
    d = pd.read_excel(epcicom, dtype={"insee": str, "siren": str})
    cor = d[d["insee"].str.startswith(("2A", "2B"))].copy()
    codes_geo = {f["properties"]["code"] for f in json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]}
    if set(cor["insee"]) != codes_geo or cor["insee"].duplicated().any():
        sys.exit(f"communes de la DGCL ≠ GeoJSON : manquantes {sorted(codes_geo - set(cor['insee']))[:5]}, en trop {sorted(set(cor['insee']) - codes_geo)[:5]}")
    if len(d[d["siren"].isin(cor["siren"])]) != len(cor):
        sys.exit("un EPCI de la Corse a des communes hors Corse : à traiter à part")

    # contrôle des populations avec l'INSEE
    c = pd.read_excel(ensemble, sheet_name="Communes", header=7, dtype=str)
    c["code"] = c["Code département"].str.strip() + c["Code commune"].str.strip()
    c = c[c["code"].isin(codes_geo)].set_index("code")
    for col in ("Population municipale", "Population totale"):
        c[col] = c[col].str.replace(r"\s", "", regex=True).astype(int)
    cor = cor.set_index("insee")
    if not ((cor["pmun_2026"] == c["Population municipale"].reindex(cor.index)).all() and (cor["ptot_2026"] == c["Population totale"].reindex(cor.index)).all()):
        sys.exit("populations DGCL ≠ INSEE")

    # contrôle de l'appartenance avec l'INSEE (si le fichier est fourni)
    if insee_epci:
        i = pd.read_excel(insee_epci, sheet_name="Composition_communale", header=5, dtype=str)
        i = i[i["CODGEO"].str.startswith(("2A", "2B"), na=False)].set_index("CODGEO")
        if not (i["EPCI"].reindex(cor.index) == cor["siren"]).all():
            sys.exit("appartenance aux EPCI DGCL ≠ INSEE")

    epci = []
    for siren, g in cor.groupby("siren"):
        t = g.iloc[0]
        if g["pmun_2026"].sum() != t["total_pop_mun"] or len(g) != t["nb_membres"]:
            sys.exit(f"{siren} : somme des communes ≠ total de l'EPCI")
        epci.append({"siren": siren, "nom": t["raison_sociale"], "nature": t["nature_juridique"], "fiscalite": t["mode_financ"], "nb_communes": int(len(g)),
                     "population_municipale": int(g["pmun_2026"].sum()), "population_totale": int(g["ptot_2026"].sum()),
                     "communes": sorted(g.index)})
    epci.sort(key=lambda e: -e["population_municipale"])
    communes = {code: {"nom": r["nom_membre"], "epci": r["siren"], "population_municipale": int(r["pmun_2026"]), "population_totale": int(r["ptot_2026"])}
                for code, r in cor.sort_index().iterrows()}
    return {"source": "DGCL, composition communale des EPCI à fiscalité propre au 1er janvier 2026 (populations de référence 2023 de l'INSEE, en vigueur au 1er janvier 2026) ; "
                      "appartenance et populations recoupées avec les fichiers de l'INSEE",
            "date_geographie": "2026-01-01", "nb_epci": len(epci), "nb_communes": len(communes), "epci": epci, "communes": communes}


def main():
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    out = construire(*sys.argv[1:])
    SORTIE.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{out['nb_epci']} EPCI, {out['nb_communes']} communes, population municipale {sum(e['population_municipale'] for e in out['epci'])} ; écrit : {SORTIE}")


if __name__ == "__main__":
    main()
