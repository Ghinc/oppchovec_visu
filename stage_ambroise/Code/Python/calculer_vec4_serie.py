"""
Vec4 (nombre de services accessibles en moins de 20 minutes en voiture) calculé à deux dates avec la MÊME méthode, pour la série temporelle.

Même méthode que services_accessibles_osrm_local.py (centre de chaque commune -> chaque équipement géolocalisé de la BPE, temps de trajet OSRM, comptage à 20 minutes ou moins),
avec deux différences pour que les deux dates soient comparables :
  * on ne garde que les types d'équipements (TYPEQU) PRÉSENTS ET GÉOLOCALISÉS aux deux dates (la nomenclature de la BPE change : 120 types sur 168 en 2016 sont encore dans la BPE 2024,
    et 15 types, surtout des artisans du bâtiment, ne sont pas géolocalisés en 2016) ;
  * le réseau routier est le même pour les deux dates (celui du fichier OSM utilisé par le serveur OSRM) : seule la liste des équipements change.

Prérequis : un serveur OSRM local sur localhost:5000 lancé avec `--max-table-size 10000` (voir README_OSRM_LOCAL.md ; avec Docker :
  docker run -d -p 5000:5000 -v "<dossier des données>:/data" ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld --max-table-size 10000 /data/corse-xxxx.osrm).

Usage (depuis stage_ambroise/Code/Python/) :
    python calculer_vec4_serie.py valider "<bpe_corse.csv 2024>" "<communes_corse_coordonnees.csv>"     # retrouve Vec4 actuel avec la BPE 2024
    python calculer_vec4_serie.py serie2021 "<bpe2016.csv.gz>" "<bpe21_ensemble_xy.csv>" "<communes_corse_coordonnees.csv>"   # écrit Données/vec4_serie_2016_2021.json
    python calculer_vec4_serie.py serie "<bpe2016.csv.gz>" "<bpe_deuxième_date.csv>" "<communes_corse_coordonnees.csv>"   # écrit Données/vec4_serie_temporelle.json
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import requests

OSRM = "http://localhost:5000/table/v1/driving/"
SEUIL_MINUTES = 20
GEOJSON = Path(__file__).resolve().parents[2] / "Données" / "Commune_Corse.geojson"
SORTIE = Path(__file__).resolve().parents[2] / "Données" / "vec4_serie_temporelle.json"
WEB_DATA = Path(__file__).resolve().parent.parent / "WEB" / "data_scores_0_10.json"


def temps_vers_equipements(communes, equipements, taille_sources=50, taille_dest=120):
    """Matrice (communes x équipements) des temps de trajet en minutes (NaN si pas de route). communes / equipements : listes de (longitude, latitude)."""
    matrice = np.full((len(communes), len(equipements)), np.nan)
    session = requests.Session()
    for i in range(0, len(communes), taille_sources):
        sources = communes[i:i + taille_sources]
        for j in range(0, len(equipements), taille_dest):
            dest = equipements[j:j + taille_dest]
            coords = ";".join(f"{lon:.6f},{lat:.6f}" for lon, lat in sources + dest)
            url = (f"{OSRM}{coords}?sources={';'.join(map(str, range(len(sources))))}"
                   f"&destinations={';'.join(map(str, range(len(sources), len(sources) + len(dest))))}")
            r = session.get(url, timeout=60)
            r.raise_for_status()
            d = r.json()
            if d.get("code") != "Ok":
                raise RuntimeError(f"OSRM : {d.get('code')} {d.get('message', '')}")
            bloc = np.array([[np.nan if v is None else v / 60 for v in ligne] for ligne in d["durations"]])
            matrice[i:i + len(sources), j:j + len(dest)] = bloc
    return matrice


def lire_communes(chemin):
    c = pd.read_csv(chemin)
    return c.reset_index(drop=True)


def compter(communes, equipements_lonlat):
    m = temps_vers_equipements(list(zip(communes.longitude, communes.latitude)), equipements_lonlat)
    return (m <= SEUIL_MINUTES).sum(axis=1)


def charger_bpe_2024(chemin):
    d = pd.read_csv(chemin, usecols=["TYPEQU", "LONGITUDE", "LATITUDE", "DEPCOM"], dtype={"TYPEQU": str}, low_memory=False)
    return d.rename(columns={"LONGITUDE": "longitude", "LATITUDE": "latitude", "TYPEQU": "typequ"}).dropna(subset=["longitude", "latitude"])


def charger_bpe_2016(chemin):
    d = pd.read_csv(chemin, compression="gzip", dtype=str, low_memory=False)
    d = d[d["dep"].isin(["2A", "2B"])].copy()
    d["longitude"] = pd.to_numeric(d["longitude"], errors="coerce")
    d["latitude"] = pd.to_numeric(d["latitude"], errors="coerce")
    return d.dropna(subset=["longitude", "latitude"])


def charger_bpe_2021(chemin):
    """BPE 2021 géolocalisée de la Corse (bpe21_ensemble_xy.csv de l'INSEE, ou extrait Corse) : coordonnées Lambert-93 (EPSG:2154) converties en longitude / latitude."""
    from pyproj import Transformer
    d = pd.read_csv(chemin, sep=None, engine="python", dtype=str) if str(chemin).endswith(".csv") and Path(chemin).stat().st_size < 50e6 else pd.read_csv(chemin, sep=";", dtype=str, low_memory=False)
    d = d[d["DEP"].isin(["2A", "2B"])].copy()
    x, y = pd.to_numeric(d["LAMBERT_X"], errors="coerce"), pd.to_numeric(d["LAMBERT_Y"], errors="coerce")
    lon, lat = Transformer.from_crs(2154, 4326, always_xy=True).transform(x.fillna(0).values, y.fillna(0).values)
    d["longitude"], d["latitude"] = np.where(x.notna(), lon, np.nan), np.where(x.notna(), lat, np.nan)
    return d.rename(columns={"TYPEQU": "typequ"}).dropna(subset=["longitude", "latitude"])


def valider(bpe_2024, communes_csv):
    communes = lire_communes(communes_csv)
    bpe = charger_bpe_2024(bpe_2024)
    print(f"{len(bpe)} équipements géolocalisés (BPE 2024), {len(communes)} communes")
    n = compter(communes, list(zip(bpe.longitude, bpe.latitude)))
    actuel = json.loads(WEB_DATA.read_text(encoding="utf-8"))
    noms = {f["properties"]["code"]: f["properties"]["nom"] for f in json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]}
    ecarts = [(abs(int(v) - actuel[noms[c]]["Vec4"]), c) for c, v in zip(communes.code_commune, n) if c in noms]
    print(f"écart absolu avec le Vec4 actuel : maximum {max(ecarts)[0]:.0f}, moyen {np.mean([e for e, _ in ecarts]):.2f}, communes identiques {sum(e == 0 for e, _ in ecarts)} / {len(ecarts)}")
    return n


def serie(bpe_a, bpe_b, communes_csv, annee_a=2016, annee_b=2024, chargeur_b=None, sortie=None):
    """Vec4 comparable aux deux dates : uniquement les types présents et géolocalisés aux deux dates. Écrit Données/vec4_serie_temporelle.json."""
    communes = lire_communes(communes_csv)
    a = charger_bpe_2016(bpe_a).rename(columns={"typequ": "typequ"})
    b = (chargeur_b or charger_bpe_2024)(bpe_b)
    types = sorted(set(a["typequ"]) & set(b["typequ"]))
    print(f"types communs et géolocalisés aux deux dates : {len(types)} ({annee_a} : {a["typequ"].nunique()}, {annee_b} : {b["typequ"].nunique()})")
    a, b = a[a["typequ"].isin(types)], b[b["typequ"].isin(types)]
    print(f"équipements retenus : {len(a)} en {annee_a}, {len(b)} en {annee_b}")
    na = compter(communes, list(zip(a.longitude, a.latitude)))
    nb = compter(communes, list(zip(b.longitude, b.latitude)))
    noms = {f["properties"]["code"]: f["properties"]["nom"] for f in json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]}
    sortie_fichier = sortie
    sortie = {"methode": "temps de trajet OSRM (réseau routier unique) du centre de chaque commune vers chaque équipement géolocalisé, comptage à 20 minutes ou moins ; "
                         "seuls les types d'équipements présents et géolocalisés aux deux dates sont comptés",
              "annees": [annee_a, annee_b], "types_communs": len(types),
              "equipements": {str(annee_a): int(len(a)), str(annee_b): int(len(b))},
              "communes": {noms[c]: {"code": c, str(annee_a): int(x), str(annee_b): int(y)} for c, x, y in zip(communes.code_commune, na, nb) if c in noms}}
    (sortie_fichier or SORTIE).write_text(json.dumps(sortie, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"moyenne par commune : {na.mean():.0f} en {annee_a}, {nb.mean():.0f} en {annee_b} ; écrit : {sortie_fichier or SORTIE}")


def main():
    if len(sys.argv) >= 4 and sys.argv[1] == "valider":
        valider(sys.argv[2], sys.argv[3])
    elif len(sys.argv) >= 5 and sys.argv[1] == "serie2021":       # 2016 -> 2021, mêmes types d'équipements aux deux dates
        serie(sys.argv[2], sys.argv[3], sys.argv[4], 2016, 2021, charger_bpe_2021, SORTIE.with_name("vec4_serie_2016_2021.json"))
    elif len(sys.argv) >= 5 and sys.argv[1] == "serie":
        serie(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
