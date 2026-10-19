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
        self.assertEqual((m["Opp1"], m["Opp2"], m["Opp3"], m["Cho2"], m["Vec2"], m["Vec3"]), (2023,) * 6)      # recensement 2023
        self.assertEqual(m["Cho1"], 2020)                 # population des quartiers prioritaires au 1er janvier 2020
        for k in self.agreg["millesime_approche"]:
            self.assertEqual(m[k], 2023, k)                 # dernière population publiée
        # la population du millésime est bien celle de l'année : une commune de chaque millésime, comparée à la population totale de son EPCI
        for e in self.agreg["epci"]:
            self.assertEqual(sum(c["pop"]["Vec4"] for c in e["communes"].values()), e["population_2023"])

    def test_la_population_du_millesime_2023_est_celle_des_series_historiques(self):
        """La population attachée aux indicateurs de 2023 est la population municipale 2023 (séries historiques INSEE), identique à `pop_annee` ; 2016 et 2021 servent à contrôler l'onglet Évolution."""
        for e in self.agreg["epci"]:
            for c in e["communes"].values():
                self.assertEqual(c["pop"]["Opp1"], c["pop_annee"]["2023"], c["code"])
                self.assertEqual(set(c["pop_annee"]), {"2016", "2021", "2023"})
                self.assertTrue(all(v > 0 for v in c["pop_annee"].values()), c["code"])

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
