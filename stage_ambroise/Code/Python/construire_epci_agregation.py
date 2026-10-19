"""
Prépare l'agrégation de l'indice OppChoVec à l'échelle des EPCI (onglet « EPCI » de l'appli).

Produit deux fichiers dans Code/WEB/ :
  * epci_agregation.json : pour chaque EPCI, ses communes membres (noms de l'appli) et, pour chaque commune, sa POPULATION AU MILLÉSIME DE CHAQUE INDICATEUR
    (pondération « pro rata du nombre d'habitants » : un indicateur de recensement 2021 est pondéré par la population de 2021, etc.) ;
  * epci_corse.geojson : contours des 19 EPCI (communes dissoutes par EPCI).

Entrées :
  * Données/epci_corse_2026.json (construire_epci_corse.py : appartenance aux EPCI au 1er janvier 2026) ;
  * INSEE, « Séries historiques de population » (base-pop-historiques-1876-2023.xlsx) : population municipale de chaque commune et de chaque année (2006-2023) ;
  * Données/Commune_Corse.geojson (contours et noms des communes de l'appli).

Millésime de population de chaque indicateur (indice courant v2 ; 2023 = dernière population publiée quand la source est plus récente) :
  Opp1, Opp2, Opp3, Cho2, Vec2, Vec3 2023 (recensement 2023) · Opp4 2023 (ARCEP T4 2024 : dernière population) · Cho1 2020 (population des QPV au 1er janvier 2020)
  Vec1 2023 (revenus 2024 : dernière population) · Vec4 2023 (BPE 2024 : dernière population)

Usage (depuis stage_ambroise/Code/Python/) :
    python construire_epci_agregation.py <base-pop-historiques-1876-2023.xlsx>
"""

import json
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd

RACINE = Path(__file__).resolve().parents[2]
GEOJSON = RACINE / "Données" / "Commune_Corse.geojson"
EPCI = RACINE / "Données" / "epci_corse_2026.json"
WEB = Path(__file__).resolve().parent.parent / "WEB"

MILLESIMES = {"Opp1": 2023, "Opp2": 2023, "Opp3": 2023, "Opp4": 2023, "Cho1": 2020, "Cho2": 2023, "Vec1": 2023, "Vec2": 2023, "Vec3": 2023, "Vec4": 2023}
# indicateurs dont le millésime n'est pas celui d'une source datée : population la plus récente publiée
MILLESIME_APPROCHE = {"Opp4": "ARCEP T4 2024 (population 2024 pas encore publiée)", "Vec1": "revenus 2024 (population 2024 pas encore publiée)", "Vec4": "BPE 2024 (population 2024 pas encore publiée)"}


def construire(pop_hist):
    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    nom_de = {f["properties"]["code"]: f["properties"]["nom"] for f in geo["features"]}
    epci = json.loads(EPCI.read_text(encoding="utf-8"))
    if set(epci["communes"]) != set(nom_de):
        sys.exit("communes de epci_corse_2026.json ≠ GeoJSON")

    p = pd.read_excel(pop_hist, sheet_name="pop_1876_2023", header=5, dtype={"CODGEO": str})
    p = p[p["CODGEO"].isin(nom_de)].set_index("CODGEO")
    annees = sorted(set(MILLESIMES.values()) | {2016, 2021})            # 2016 et 2021 : années de la série temporelle (contrôle des populations de l'onglet Évolution)
    if len(p) != 360 or any(f"PMUN{a}" not in p.columns for a in annees):
        sys.exit(f"populations historiques incomplètes : {len(p)} communes, colonnes {[c for c in p.columns if c.startswith('PMUN')][:4]}")
    pop = {code: {a: int(p.loc[code, f"PMUN{a}"]) for a in annees} for code in nom_de}

    sortie = {"source": "EPCI : DGCL / INSEE au 1er janvier 2026 ; populations : INSEE, séries historiques de population (population municipale de l'année du millésime de chaque indicateur)",
              "millesimes": MILLESIMES, "millesime_approche": MILLESIME_APPROCHE, "epci": []}
    for e in epci["epci"]:
        communes = {}
        for code in e["communes"]:
            communes[nom_de[code]] = {"code": code, "pop": {k: pop[code][a] for k, a in MILLESIMES.items()}, "pop_annee": {str(a): pop[code][a] for a in (2016, 2021, 2023)}}
        sortie["epci"].append({"siren": e["siren"], "nom": e["nom"], "nature": e["nature"], "fiscalite": e["fiscalite"], "nb_communes": e["nb_communes"],
                               "population_2023": sum(pop[c][2023] for c in e["communes"]), "communes": communes})
    sortie["epci"].sort(key=lambda e: e["nom"])
    (WEB / "epci_agregation.json").write_text(json.dumps(sortie, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # contours des EPCI
    g = gpd.read_file(GEOJSON)
    g["siren"] = g["code"].map({c: e["siren"] for e in epci["epci"] for c in e["communes"]})
    d = g.dissolve(by="siren").reset_index()[["siren", "geometry"]]
    d["nom"] = d["siren"].map({e["siren"]: e["nom"] for e in epci["epci"]})
    d["geometry"] = d["geometry"].simplify(0.0003, preserve_topology=True)
    d.to_file(WEB / "epci_corse.geojson", driver="GeoJSON")
    return sortie, d


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    s, d = construire(sys.argv[1])
    print(f"{len(s['epci'])} EPCI, {sum(e['nb_communes'] for e in s['epci'])} communes ; contours : {len(d)} polygones")
    for k, a in MILLESIMES.items():
        print(f"  {k} : population {a}" + (f"  ({MILLESIME_APPROCHE[k]})" if k in MILLESIME_APPROCHE else ""))
    print(f"écrit : {WEB / 'epci_agregation.json'} et {WEB / 'epci_corse.geojson'}")


if __name__ == "__main__":
    main()
