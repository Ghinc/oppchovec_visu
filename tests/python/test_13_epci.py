"""13. EPCI (onglet « EPCI ») : données d'appartenance, populations par millésime et contours.

* Données/epci_corse_2026.json (construire_epci_corse.py) : 19 EPCI, 360 communes, une seule fois chacune, mêmes codes que le GeoJSON ;
  somme des communes = population de l'EPCI ; pas d'EPCI à cheval sur la Corse et le continent ;
* Code/WEB/epci_agregation.json (construire_epci_agregation.py) : mêmes EPCI et communes avec les noms de l'appli, population à chaque millésime d'indicateur ;
  la population 2022 est celle du fichier utilisé par le projet (population_corse.xlsx, si les sources sont disponibles) ;
* Code/WEB/epci_corse.geojson : un contour par EPCI, qui couvre exactement les communes membres.
"""
import unittest

from common import GEOJSON, STAGE, WEB, charger_json, exige_libs

INDICATEURS = ["Opp1", "Opp2", "Opp3", "Opp4", "Cho1", "Cho2", "Vec1", "Vec2", "Vec3", "Vec4"]


class DonneesEPCI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.epci = charger_json(STAGE / "Données" / "epci_corse_2026.json")
        cls.agreg = charger_json(WEB / "epci_agregation.json")
        cls.geo = charger_json(GEOJSON)
        cls.noms = {f["properties"]["code"]: f["properties"]["nom"] for f in cls.geo["features"]}

    def test_19_epci_360_communes_une_seule_fois(self):
        self.assertEqual(self.epci["nb_epci"], 19)
        codes = [c for e in self.epci["epci"] for c in e["communes"]]
        self.assertEqual(len(codes), 360)
        self.assertEqual(sorted(codes), sorted(self.noms))
        self.assertEqual(sorted(self.epci["communes"]), sorted(self.noms))

    def test_populations_et_sommes(self):
        for e in self.epci["epci"]:
            self.assertEqual(e["nb_communes"], len(e["communes"]), e["nom"])
            self.assertEqual(sum(self.epci["communes"][c]["population_municipale"] for c in e["communes"]), e["population_municipale"], e["nom"])
            self.assertEqual(sum(self.epci["communes"][c]["population_totale"] for c in e["communes"]), e["population_totale"], e["nom"])
            for c in e["communes"]:
                self.assertEqual(self.epci["communes"][c]["epci"], e["siren"])
        self.assertEqual(sum(e["population_municipale"] for e in self.epci["epci"]), 355486)

    def test_fichier_de_l_appli_meme_decoupage_avec_les_noms_de_l_appli(self):
        self.assertEqual(len(self.agreg["epci"]), 19)
        par_siren = {e["siren"]: e for e in self.epci["epci"]}
        for e in self.agreg["epci"]:
            attendu = {self.noms[c] for c in par_siren[e["siren"]]["communes"]}
            self.assertEqual(set(e["communes"]), attendu, e["nom"])
            self.assertEqual(e["nb_communes"], len(attendu))
            for nom, c in e["communes"].items():
                self.assertEqual(self.noms[c["code"]], nom)
                self.assertEqual(set(c["pop"]), set(INDICATEURS))
                self.assertTrue(all(v > 0 for v in c["pop"].values()), nom)

    def test_millesimes_des_indicateurs(self):
        m = self.agreg["millesimes"]
        self.assertEqual(set(m), set(INDICATEURS))
        self.assertEqual((m["Opp1"], m["Opp2"], m["Cho2"], m["Vec1"], m["Vec2"]), (2020, 2021, 2022, 2021, 2022))
        for k in self.agreg["millesime_approche"]:
            self.assertEqual(m[k], 2023, k)                 # dernière population publiée
        # la population du millésime est bien celle de l'année : une commune de chaque millésime, comparée à la population totale de son EPCI
        for e in self.agreg["epci"]:
            self.assertEqual(sum(c["pop"]["Vec4"] for c in e["communes"].values()), e["population_2023"])

    def test_la_population_2022_est_celle_du_fichier_du_projet(self):
        import os
        from pathlib import Path
        base = os.environ.get("OPPCHOVEC_SOURCES") or r"C:\These\Données2\visualisation_oppchovec_1111\Stage Ambroise"
        f = Path(base) / "Données" / "Corse_Commune" / "population_corse.xlsx"
        if not f.exists():
            self.skipTest("population_corse.xlsx introuvable (définir OPPCHOVEC_SOURCES)")
        try:
            import pandas as pd
            p = pd.read_excel(f).set_index("code_commune")["population_2022"]
        except Exception as e:                                      # pandas / openpyxl absents
            self.skipTest(f"lecture impossible : {e}")
        for e in self.agreg["epci"]:
            for c in e["communes"].values():
                self.assertEqual(c["pop"]["Cho2"], int(p[c["code"]]), c["code"])

    def test_contours(self):
        g = charger_json(WEB / "epci_corse.geojson")
        self.assertEqual(len(g["features"]), 19)
        self.assertEqual({f["properties"]["siren"] for f in g["features"]}, {e["siren"] for e in self.epci["epci"]})
        for f in g["features"]:
            self.assertIn(f["geometry"]["type"], ("Polygon", "MultiPolygon"))

    @exige_libs("geopandas", "shapely")
    def test_chaque_contour_couvre_ses_communes(self):
        import geopandas as gpd
        epci = gpd.read_file(WEB / "epci_corse.geojson").set_index("siren")
        com = gpd.read_file(GEOJSON).set_index("code")
        for e in self.epci["epci"]:
            union = com.loc[e["communes"], "geometry"].union_all() if hasattr(com.geometry, "union_all") else com.loc[e["communes"], "geometry"].unary_union
            aire_commune = union.area
            recouvrement = epci.loc[e["siren"], "geometry"].intersection(union).area / aire_commune
            self.assertGreater(recouvrement, 0.99, e["nom"])      # contour simplifié : écart < 1 % de la surface


if __name__ == "__main__":
    unittest.main()
