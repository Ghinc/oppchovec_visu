"""11. Variante de Vec1 : revenu fiscal moyen par foyer (DGFiP, IRCOM 2021) à la place de la médiane du niveau de vie (Filosofi).

* l'indice de la variante et ses corrélations avec l'indice actuel sont recalculés en Python (implémentation indépendante de vec1_variante.js) ;
* le défaut qui motive la variante est figé : 154 communes ont la valeur DÉPARTEMENTALE de Filosofi ;
* le script calculer_revenu_fiscal_vec1.py est rejoué depuis le fichier DGFiP si OPPCHOVEC_IRCOM désigne ircom_communes_complet_revenus_2021.xlsx.
"""
import json
import math
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from common import INDICATEURS, PYDIR, RACINE, WEB, bornes_indicateurs, charger_json, donnees_actuelles, exige_libs, indice_brut, pk_betti, scores_01, vers_0_10

NODE = shutil.which("node")
VALEURS_DEPARTEMENTALES = (21460, 23420)       # Vec1 actuel (médiane Filosofi) attribué aux communes non diffusées : Haute-Corse, Corse-du-Sud


def indice_et_score_vec(indicateurs, mode):
    s01 = scores_01(indicateurs, bornes_indicateurs(indicateurs))
    pk = pk_betti(s01) if mode == "betti" else (1, 1, 1)
    return vers_0_10(indice_brut(s01, pk)), vers_0_10({c: s["Vec"] for c, s in s01.items()})


class VariantVec1(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = donnees_actuelles()
        cls.alt = charger_json(WEB / "vec1_revenu_fiscal.json")
        cls.noms = sorted(cls.data)

    def test_154_communes_ont_la_valeur_departementale_de_filosofi(self):
        departementales = [c for c in self.noms if self.data[c]["Vec1"] in VALEURS_DEPARTEMENTALES]
        self.assertEqual(len(departementales), 154)
        self.assertEqual(len({self.data[c]["Vec1"] for c in departementales}), 2)

    def test_le_fichier_de_la_variante_est_coherent(self):
        self.assertEqual(sorted(self.alt["communes"]), self.noms)
        sans_donnee = [c for c, v in self.alt["communes"].items() if v["estime_departement"]]
        self.assertEqual(len(sans_donnee), 12)
        for c in sans_donnee:
            self.assertEqual(self.alt["communes"][c]["revenu_moyen"], self.alt["moyenne_departement"][self.alt["communes"][c]["code"][:2]])
        for v in self.alt["communes"].values():
            self.assertGreater(v["revenu_moyen"], 0)

    @unittest.skipUnless(NODE, "node introuvable")
    @exige_libs("scipy")
    def test_comparaison_js_identique_a_un_recalcul_python_independant(self):
        from scipy.stats import pearsonr, spearmanr
        r = subprocess.run([NODE, str(RACINE / "tests" / "js" / "dump_vec1.js")], capture_output=True, text=True, encoding="utf-8", cwd=RACINE)
        self.assertEqual(r.returncode, 0, r.stderr[-800:])
        js = json.loads(r.stdout)
        base = {c: {k: self.data[c][k] for k in INDICATEURS} for c in self.noms}
        variante = {c: {**base[c], "Vec1": self.alt["communes"][c]["revenu_moyen"]} for c in self.noms}
        for mode in ("betti", "egal"):
            with self.subTest(mode=mode):
                ia, sa = indice_et_score_vec(base, mode)
                ib, sb = indice_et_score_vec(variante, mode)
                a, b = [ia[c] for c in self.noms], [ib[c] for c in self.noms]
                va, vb = [base[c]["Vec1"] for c in self.noms], [variante[c]["Vec1"] for c in self.noms]
                self.assertAlmostEqual(js[mode]["pearsonIndice"], pearsonr(a, b)[0], places=9)
                self.assertAlmostEqual(js[mode]["spearmanIndice"], spearmanr(a, b)[0], places=9)
                self.assertAlmostEqual(js[mode]["pearsonVec1"], pearsonr(va, vb)[0], places=9)
                self.assertAlmostEqual(js[mode]["spearmanVec1"], spearmanr(va, vb)[0], places=9)       # avec ex æquo : rangs moyens
                self.assertAlmostEqual(js[mode]["spearmanScoreVec"], spearmanr([sa[c] for c in self.noms], [sb[c] for c in self.noms])[0], places=9)
                for p in js[mode]["points"]:
                    self.assertAlmostEqual(p["x"], ia[p["commune"]], places=9)
                    self.assertAlmostEqual(p["y"], ib[p["commune"]], places=9)

    @exige_libs("pandas", "openpyxl", "geopandas")
    def test_le_script_reproduit_le_fichier_depuis_l_ircom(self):
        xlsx = os.environ.get("OPPCHOVEC_IRCOM", "")
        if not xlsx or not Path(xlsx).exists():
            self.skipTest("définir OPPCHOVEC_IRCOM = chemin de ircom_communes_complet_revenus_2021.xlsx (DGFiP) pour rejouer le calcul")
        import sys
        sys.path.insert(0, str(PYDIR))
        import calculer_revenu_fiscal_vec1 as m
        refait = m.calculer(xlsx)
        self.assertEqual(refait["communes"].keys(), self.alt["communes"].keys())
        for c, v in refait["communes"].items():
            self.assertAlmostEqual(v["revenu_moyen"], self.alt["communes"][c]["revenu_moyen"], places=6, msg=c)
            self.assertEqual(v["estime_departement"], self.alt["communes"][c]["estime_departement"], c)


if __name__ == "__main__":
    unittest.main()
