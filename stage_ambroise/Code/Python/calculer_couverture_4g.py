"""
Part de la POPULATION de chaque commune corse couverte par la 4G, à partir des cartes de couverture théorique de l'ARCEP (un polygone par opérateur) et de la grille
de population de l'INSEE (carreaux de 200 m, Filosofi : colonne « ind », individus des ménages fiscaux).

Méthode : le centre de chaque carreau habité reçoit la population du carreau ; il est affecté à sa commune (jointure spatiale avec le GeoJSON des communes) ; il est
« couvert » par un opérateur s'il tombe dans un polygone de sa carte 4G. Pour chaque commune on écrit la part de la population couverte :
    - par chaque opérateur ;
    - par au moins un opérateur ("au_moins_un") ;
    - par tous les opérateurs ("tous") ;
    - en moyenne sur les opérateurs ("moyenne").
Ce programme sert à Opp4 (4G) de la série temporelle : mêmes opérateurs, même méthode aux deux dates. Les cartes antérieures à 2018 se trouvent dans
data.arcep.fr/mobile/couvertures_theoriques/archives/ (2017_T1 = situation de mars 2017), les suivantes dans data.arcep.fr/mobile/couvertures_theoriques/<année_Tn>/Metropole/00_Metropole/.

Usage (depuis stage_ambroise/Code/Python/) :
    python calculer_couverture_4g.py "<grille.parquet>" "<dossier des cartes 4G>" "<sortie.json>" "<libellé>" [EPSG des cartes]
où <dossier des cartes 4G> contient (à n'importe quelle profondeur) un fichier .shp par opérateur (4 fichiers, tous en 4G). Cartes de 2017 : passer 27572 en dernier argument (Lambert II étendu, .prj de l'ARCEP illisible).
"""

import json
import re
import struct
import sys
import warnings
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import pyarrow.parquet as pq
import shapely
from pyproj import Transformer

warnings.filterwarnings("ignore")
RACINE = Path(__file__).resolve().parents[2]
GEOJSON = RACINE / "Données" / "Commune_Corse.geojson"
BORNES_CORSE = (8.3, 41.2, 9.8, 43.1)                                           # lon min, lat min, lon max, lat max


def population_corse(parquet):
    """Points (Lambert-93) des carreaux habités de Corse avec leur population. Le centre du carreau se déduit de l'identifiant « CRS3035RES200mN<y>E<x> » (coin sud-ouest)."""
    t = pq.read_table(parquet, columns=["idcar_200m", "ind"]).to_pandas()
    m = t["idcar_200m"].str.extract(r"N(\d+)E(\d+)").astype(float)
    t["y"], t["x"] = m[0] + 100, m[1] + 100
    to3035 = Transformer.from_crs(4326, 3035, always_xy=True)
    (x0, y0), (x1, y1) = to3035.transform(BORNES_CORSE[0], BORNES_CORSE[1]), to3035.transform(BORNES_CORSE[2], BORNES_CORSE[3])
    t = t[(t.x >= min(x0, x1)) & (t.x <= max(x0, x1)) & (t.y >= min(y0, y1)) & (t.y <= max(y0, y1)) & (t["ind"] > 0)].copy()
    lon, lat = Transformer.from_crs(3035, 4326, always_xy=True).transform(t.x.values, t.y.values)
    t = t[(lon >= BORNES_CORSE[0]) & (lon <= BORNES_CORSE[2]) & (lat >= BORNES_CORSE[1]) & (lat <= BORNES_CORSE[3])]
    g = gpd.GeoDataFrame(t[["ind"]], geometry=gpd.points_from_xy(t.x, t.y), crs=3035).to_crs(2154)
    return g


class CarteAnneaux:
    """Carte de couverture lue directement dans un shapefile : liste de contours (anneaux) sans distinction extérieur / trou. Un point est « couvert » s'il est dans un nombre
    IMPAIR de contours (règle pair-impair), ce qui gère les trous sans reconstruire les polygones. Nécessaire pour les cartes de 2017 : une seule entité de plusieurs millions de
    sommets par opérateur, que les bibliothèques de lecture standard mettent des heures à traiter."""

    def __init__(self, anneaux):
        self.anneaux = anneaux

    def contient(self, x, y):
        parite = np.zeros(len(x), dtype=bool)
        for poly, (x0, y0, x1, y1) in self.anneaux:
            m = (x >= x0) & (x <= x1) & (y >= y0) & (y <= y1)
            if m.any():
                parite[m] ^= shapely.contains_xy(poly, x[m], y[m])
        return parite


def lire_shp_anneaux(chemin, bbox):
    """Anneaux d'un shapefile de polygones dont l'emprise touche bbox (xmin, ymin, xmax, ymax), dans le système de coordonnées du fichier."""
    data = Path(chemin).read_bytes()
    pos, anneaux = 100, []
    while pos + 12 <= len(data):
        _, mots = struct.unpack(">ii", data[pos:pos + 8])
        debut = pos + 8
        if struct.unpack("<i", data[debut:debut + 4])[0] in (5, 15, 25):               # polygone (simple, Z, M)
            nparts, npts = struct.unpack("<ii", data[debut + 36:debut + 44])
            parts = np.frombuffer(data, "<i4", nparts, debut + 44)
            pts = np.frombuffer(data, "<f8", npts * 2, debut + 44 + 4 * nparts).reshape(-1, 2)
            bornes = list(parts) + [npts]
            for i in range(nparts):
                r = pts[bornes[i]:bornes[i + 1]]
                x0, y0 = r.min(axis=0)
                x1, y1 = r.max(axis=0)
                if len(r) >= 4 and x1 >= bbox[0] and x0 <= bbox[2] and y1 >= bbox[1] and y0 <= bbox[3]:
                    poly = shapely.Polygon(r)
                    shapely.prepare(poly)
                    anneaux.append((poly, (x0, y0, x1, y1)))
        pos = debut + mots * 2
    return CarteAnneaux(anneaux)


def lire_carte(chemin, zone, crs_force=None):
    """Lit une carte de couverture limitée à la Corse SANS la reprojeter (les polygones sont énormes : on convertit plutôt les points de population dans le système de la carte).
    Renvoie (zone couverte, code EPSG de la carte). Par défaut la carte est en Lambert-93 (EPSG:2154) ; les cartes de 2017 sont en Lambert II étendu (NTF, EPSG:27572) avec un
    fichier .prj illisible : on passe alors crs_force=27572, ce qui ignore le .prj et lit le shapefile directement."""
    epsg = crs_force or 2154
    t = Transformer.from_crs(2154, epsg, always_xy=True)
    xs, ys = zip(*[t.transform(x, y) for x in (zone[0], zone[2]) for y in (zone[1], zone[3])])
    bbox = (min(xs) - 5000, min(ys) - 5000, max(xs) + 5000, max(ys) + 5000)
    if crs_force and Path(chemin).suffix == ".shp":
        return lire_shp_anneaux(chemin, bbox), epsg
    g = gpd.read_file(chemin, bbox=bbox)
    geoms = g.geometry.make_valid().clip_by_rect(*bbox)
    return geoms[~geoms.is_empty].union_all(), epsg


def cartes_operateurs(dossier, crs_force=None):
    fichiers = sorted(list(Path(dossier).rglob("*.shp")) + list(Path(dossier).rglob("*.gpkg")))
    if len(fichiers) != 4:
        sys.exit(f"{dossier} : 4 cartes .shp ou .gpkg attendues (un opérateur chacune), trouvé {[p.name for p in fichiers]}")
    zone = gpd.GeoSeries.from_xy([BORNES_CORSE[0], BORNES_CORSE[2]], [BORNES_CORSE[1], BORNES_CORSE[3]], crs=4326).to_crs(2154).total_bounds
    cartes = {}
    for p in fichiers:
        nom = re.sub(r"(?i)^(\d{4}_t\d_couv_metropole_)", "", p.stem).replace("_4G_data", "").replace("_4G", "")
        nom = {"ORA": "Orange", "OF": "Orange", "SFR": "SFR", "SFR0": "SFR", "BYT": "Bouygues", "BOUY": "Bouygues", "FREE": "Free"}.get(nom.upper(), nom)
        cartes[nom] = lire_carte(p, zone, crs_force)
    return cartes


def calculer(parquet, dossier_cartes, crs_force=None):
    pts = population_corse(parquet)
    communes = gpd.read_file(GEOJSON).to_crs(2154)[["code", "nom", "geometry"]]
    pts = gpd.sjoin(pts, communes, how="inner", predicate="within")
    # Commune sans carreau habité dans la grille (Campana) : couverture évaluée au point représentatif de la commune (0 ou 100 %), marquée « estime_au_centre ».
    manquantes = communes[~communes["code"].isin(pts["code"])]
    if len(manquantes):
        ajout = gpd.GeoDataFrame({"ind": 1.0, "code": manquantes["code"].values, "nom": manquantes["nom"].values},
                                 geometry=manquantes.geometry.representative_point().values, crs=2154)
        pts = pd.concat([pts, ajout], ignore_index=True)
    cartes = cartes_operateurs(dossier_cartes, crs_force)
    x, y = pts.geometry.x.values, pts.geometry.y.values
    for nom, (poly, epsg) in cartes.items():
        xn, yn = Transformer.from_crs(2154, epsg, always_xy=True).transform(x, y)
        if isinstance(poly, CarteAnneaux):
            pts[nom] = poly.contient(np.asarray(xn), np.asarray(yn))
        else:
            shapely.prepare(poly)
            pts[nom] = shapely.contains_xy(poly, xn, yn)
    ops = list(cartes)
    pts["au_moins_un"] = pts[ops].any(axis=1)
    pts["tous"] = pts[ops].all(axis=1)
    pts["moyenne"] = pts[ops].mean(axis=1)
    resultat = {}
    for code, nom in zip(communes["code"], communes["nom"]):
        s = pts[pts["code"] == code]
        pop = float(s["ind"].sum())
        if pop > 0:
            part = {k: float((s["ind"] * s[k].astype(float)).sum() / pop * 100) for k in ops + ["au_moins_un", "tous", "moyenne"]}
        else:
            part = {k: None for k in ops + ["au_moins_un", "tous", "moyenne"]}
        centre = code in set(manquantes["code"])
        resultat[nom] = {"code": code, "population_grille": 0.0 if centre else round(pop, 1), "estime_au_centre": centre, "part_population_couverte_4g_pct": part}
    return {"operateurs": ops, "communes": resultat}


def main():
    if len(sys.argv) not in (5, 6):
        sys.exit(__doc__)
    parquet, dossier, sortie, libelle = sys.argv[1:5]
    d = calculer(parquet, dossier, int(sys.argv[5]) if len(sys.argv) == 6 else None)
    d["libelle"] = libelle
    d["methode"] = ("part de la population (carreaux de 200 m, Filosofi) dont le centre de carreau est dans la carte de couverture 4G théorique de l'ARCEP ; "
                    "au_moins_un = couvert par au moins un des 4 opérateurs, tous = par les 4, moyenne = moyenne des 4 opérateurs")
    Path(sortie).write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")
    v = [c["part_population_couverte_4g_pct"] for c in d["communes"].values() if c["part_population_couverte_4g_pct"]["moyenne"] is not None]
    for k in d["operateurs"] + ["au_moins_un", "tous", "moyenne"]:
        print(f"{k:12s} moyenne des communes {np.mean([x[k] for x in v]):5.1f} %")
    print(f"{len(v)} communes avec population ; écrit : {sortie}")


if __name__ == "__main__":
    main()
