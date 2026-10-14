"""12. Série temporelle (onglet Évolution) : indice comparable 2016 / 2021, recalculé en Python depuis les indicateurs bruts du fichier.

* normalisation min-max commune aux deux années, dimensions = moyenne des indicateurs disponibles, p_k de Betti sur les deux années ensemble,
  mise à l'échelle 0-10 sur les deux années ensemble, seuils de Jenks sur les deux années ensemble ;
* rejeu du script construire_serie_temporelle.py si OPPCHOVEC_SERIE désigne le dossier contenant les sous-dossiers 2016 et 2021 (fichiers INSEE / DGFiP).
"""
import os
import sys
import unittest
from pathlib import Path

import math

from common import PYDIR, WEB, charger_json, donnees_actuelles, exige_libs, indice_brut, pk_betti, vers_0_10

ANNEES = ("2016", "2021")
DIMENSIONS = {"Opp": ["Opp1", "Opp2", "Opp3"], "Cho": ["Cho2"], "Vec": ["Vec1", "Vec2", "Vec3"]}


class SerieTemporelle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = charger_json(WEB / "serie_temporelle.json")
        cls.noms = sorted(cls.d["communes"])

    def test_structure(self):
        self.assertEqual(len(self.noms), 360)
        self.assertEqual(self.d["annees"], [2016, 2021])
        self.assertEqual(self.d["indicateurs"], [k for ks in DIMENSIONS.values() for k in ks])
        self.assertEqual(set(self.d["exclus"]), {"Opp4", "Cho1", "Vec4"})
        for c in self.noms:
            for a in ANNEES:
                for v in self.d["communes"][c][a]["indicateurs"].values():
                    self.assertTrue(v == v and abs(v) != float("inf"), f"{c} {a}")

    def test_vec1_2021_est_exactement_celui_de_la_version_actuelle(self):
        """Vec1 = médiane Filosofi 2021 (valeur départementale quand elle n'est pas diffusée) : identique au fichier de l'appli ; 154 communes départementales aux deux dates."""
        actuel = donnees_actuelles()
        for c in self.noms:
            self.assertEqual(self.d["communes"][c]["2021"]["indicateurs"]["Vec1"], actuel[c]["Vec1"], c)
        for a in ANNEES:
            self.assertEqual(sum(self.d["communes"][c][a]["vec1_departementale"] for c in self.noms), 154, a)
        for a in ANNEES:
            for dep in ("2A", "2B"):                          # ces communes ont exactement la valeur de leur département : une seule valeur par département
                valeurs = {self.d["communes"][c][a]["indicateurs"]["Vec1"] for c in self.noms
                           if self.d["communes"][c]["code"].startswith(dep) and self.d["communes"][c][a]["vec1_departementale"]}
                self.assertEqual(len(valeurs), 1, f"{a} {dep}")

    def test_cho2_2021_proche_de_l_indicateur_actuel_calcule_en_2022(self):
        actuel = donnees_actuelles()
        a = [self.d["communes"][c]["2021"]["indicateurs"]["Cho2"] for c in self.noms]
        b = [actuel[c]["Cho2"] for c in self.noms]
        n = len(a)
        ma, mb = sum(a) / n, sum(b) / n
        r = sum((x - ma) * (y - mb) for x, y in zip(a, b)) / math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))
        self.assertGreater(r, 0.85)                           # mesuré : 0,888 (millésimes différents : 2021 et 2022)
        self.assertTrue(all(0 <= x <= 100 for x in a))

    def test_recalcul_independant_des_scores(self):
        d = self.d
        obs = [(c, a) for a in ANNEES for c in self.noms]
        brut = {o: d["communes"][o[0]][o[1]]["indicateurs"] for o in obs}
        ks = d["indicateurs"]
        lo = {k: min(brut[o][k] for o in obs) for k in ks}
        hi = {k: max(brut[o][k] for o in obs) for k in ks}
        norm = {o: {k: (brut[o][k] - lo[k]) / (hi[k] - lo[k]) for k in ks} for o in obs}
        dims = {o: {dim: sum(norm[o][k] for k in ind) / len(ind) for dim, ind in DIMENSIONS.items()} for o in obs}
        pk = pk_betti(dims)
        self.assertEqual(list(d["p_k_betti"]), ["Opp", "Cho", "Vec"])
        for a, b in zip(pk, d["p_k_betti"].values()):
            self.assertAlmostEqual(a, b, places=12)
        idx = indice_brut(dims, pk)
        idx10 = vers_0_10(idx)
        dim10 = {dim: vers_0_10({o: dims[o][dim] for o in obs}) for dim in DIMENSIONS}
        for o in obs:
            s = d["communes"][o[0]][o[1]]["scores_0_10"]
            self.assertAlmostEqual(s["OppChoVec"], idx10[o], places=9, msg=str(o))
            for dim in DIMENSIONS:
                self.assertAlmostEqual(s[dim], dim10[dim][o], places=9, msg=f"{o} {dim}")

    @exige_libs("jenkspy")
    def test_seuils_jenks_sur_les_deux_annees_ensemble(self):
        import jenkspy
        for v in ("OppChoVec", "Opp", "Cho", "Vec"):
            vals = [self.d["communes"][c][a]["scores_0_10"][v] for a in ANNEES for c in self.noms]
            attendu = jenkspy.jenks_breaks(vals, 5)[1:-1]
            for x, y in zip(attendu, self.d["seuils_jenks"][v]):
                self.assertAlmostEqual(x, y, places=9, msg=v)

    def test_chaque_annee_a_ses_bornes_dans_l_echelle_commune(self):
        for k, (lo, hi) in self.d["echelle"].items():
            for a in ANNEES:
                for c in self.noms:
                    x = self.d["communes"][c][a]["indicateurs"][k]
                    self.assertTrue(lo - 1e-9 <= x <= hi + 1e-9, f"{k} {a} {c}")

    @exige_libs("pandas", "openpyxl", "jenkspy", "geopandas", "xlrd")
    def test_le_script_reproduit_le_fichier_depuis_les_sources(self):
        dossier = os.environ.get("OPPCHOVEC_SERIE", "")
        if not dossier or not (Path(dossier) / "2016").exists():
            self.skipTest("définir OPPCHOVEC_SERIE = dossier avec les sous-dossiers 2016 et 2021 (fichiers INSEE et DGFiP) pour rejouer le calcul")
        sys.path.insert(0, str(PYDIR))
        import construire_serie_temporelle as m
        refait = m.calculer(dossier)
        for c in self.noms:
            for a in ANNEES:
                for k, v in refait["communes"][c][a]["indicateurs"].items():
                    self.assertAlmostEqual(v, self.d["communes"][c][a]["indicateurs"][k], places=6, msg=f"{c} {a} {k}")
                self.assertAlmostEqual(refait["communes"][c][a]["scores_0_10"]["OppChoVec"], self.d["communes"][c][a]["scores_0_10"]["OppChoVec"], places=6)


if __name__ == "__main__":
    unittest.main()
