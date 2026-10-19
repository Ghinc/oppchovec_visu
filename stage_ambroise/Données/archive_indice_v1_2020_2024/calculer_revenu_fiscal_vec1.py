"""
Calcule une variante de Vec1 (revenu) : le REVENU FISCAL MOYEN PAR FOYER FISCAL de chaque commune, depuis l'IRCOM de la DGFiP, et l'écrit dans
Code/WEB/vec1_revenu_fiscal.json (chargé par l'appli pour la case « Vec1 : revenu fiscal moyen »).

Pourquoi : Vec1 actuel = médiane du niveau de vie (Filosofi 2021, INSEE). Cette médiane n'est pas diffusée pour les petites communes : 154 communes sur 360
(108 en Haute-Corse, 46 en Corse-du-Sud) ont reçu la valeur de leur département (21 460 € / 23 420 €). L'IRCOM, lui, a une ligne « Total » pour
presque toutes les communes.

Source : DGFiP, « L'impôt sur le revenu par collectivité territoriale (IRCOM) », data.gouv.fr, fichier « ircom_communes_complet_revenus_2021.xlsx »
(impôt sur les revenus 2021 déclarés en 2022 : même année de revenus que Filosofi 2021).
    https://www.data.gouv.fr/datasets/limpot-sur-le-revenu-par-collectivite-territoriale-ircom   (un zip par année, 2014 à 2024)

Définition : revenu_moyen = (revenu fiscal de référence total de la commune) / (nombre de foyers fiscaux), ligne « Total » de la commune. Ce n'est pas
le même concept que la médiane du niveau de vie : moyenne et non médiane, par foyer fiscal et non par unité de consommation, tous foyers (imposés ou non).
Corrélation de rang avec la médiane Filosofi sur les 206 communes où elle est diffusée : environ 0,67.

Communes sans donnée (nombre de foyers ou revenu « non communiqué » : secret statistique) : 12 communes. Elles reçoivent la valeur de leur département
(somme des revenus / somme des foyers des communes du département qui ont une donnée) et sont marquées « estime_departement ».

Usage (depuis stage_ambroise/Code/Python/) :
    python calculer_revenu_fiscal_vec1.py "<chemin>/ircom_communes_complet_revenus_2021.xlsx"
"""

import json
import sys
from pathlib import Path

import pandas as pd

RACINE = Path(__file__).resolve().parents[2]
GEOJSON = RACINE / "Données" / "Commune_Corse.geojson"
SORTIE = Path(__file__).resolve().parent.parent / "WEB" / "vec1_revenu_fiscal.json"
SOURCE = ("DGFiP, IRCOM (impôt sur le revenu par commune), revenus 2021 déclarés en 2022 : revenu fiscal de référence total / nombre de foyers fiscaux "
          "(ligne « Total » de la commune)")


def calculer(chemin_xlsx):
    d = pd.read_excel(chemin_xlsx, sheet_name=0, header=6)
    d.columns = ["_", "dep", "com", "lib", "tranche", "nb_foyers", "rfr", "impot", "nb_imposes"] + list(d.columns[9:])
    d = d[d["dep"].astype(str).isin(["2A0", "2B0"])]
    t = d[d["tranche"].astype(str) == "Total"].copy()
    t["code"] = t["dep"].astype(str).str[:2] + t["com"].astype(float).astype(int).astype(str).str.zfill(3)
    t["nb_foyers"] = pd.to_numeric(t["nb_foyers"], errors="coerce")
    t["rfr_k"] = pd.to_numeric(t["rfr"], errors="coerce")           # en milliers d'euros
    t = t.set_index("code")

    noms = {f["properties"]["code"]: f["properties"]["nom"]
            for f in json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]}
    if set(t.index) != set(noms):
        sys.exit(f"Communes différentes du GeoJSON : IRCOM seul {sorted(set(t.index) - set(noms))}, GeoJSON seul {sorted(set(noms) - set(t.index))}")

    valide = t["nb_foyers"].gt(0) & t["rfr_k"].notna()
    dep_moyen = {}
    for dep in ("2A", "2B"):
        sel = t[valide & t.index.str.startswith(dep)]
        dep_moyen[dep] = float(sel["rfr_k"].sum() * 1000 / sel["nb_foyers"].sum())

    communes = {}
    for code, nom in noms.items():
        r = t.loc[code]
        if valide[code]:
            communes[nom] = {"code": code, "revenu_moyen": float(r["rfr_k"] * 1000 / r["nb_foyers"]),
                             "nb_foyers": int(r["nb_foyers"]), "estime_departement": False}
        else:
            communes[nom] = {"code": code, "revenu_moyen": dep_moyen[code[:2]],
                             "nb_foyers": None if pd.isna(r["nb_foyers"]) else int(r["nb_foyers"]), "estime_departement": True}
    return {"source": SOURCE, "annee_revenus": 2021,
            "note": "estime_departement = donnée non communiquée (secret statistique) : valeur moyenne du département",
            "moyenne_departement": dep_moyen, "communes": communes}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    donnees = calculer(sys.argv[1])
    c = donnees["communes"]
    v = [x["revenu_moyen"] for x in c.values()]
    print(f"{len(c)} communes ; valeur départementale pour {sum(x['estime_departement'] for x in c.values())} (non communiquées)")
    print(f"revenu moyen par foyer : min {min(v):.0f} €, moyenne {sum(v) / len(v):.0f} €, max {max(v):.0f} €")
    SORTIE.write_text(json.dumps(donnees, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"écrit : {SORTIE}")


if __name__ == "__main__":
    main()
