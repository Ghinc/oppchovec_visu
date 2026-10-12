"""9. Tableaux Excel proposés au téléchargement par le site (downloads/) : doivent refléter les données ACTUELLES.

Le site (index.html) propose deux fichiers générés par gen_excel_010.py. Après la correction des poids Vec3 ils étaient restés sur
l'ancien classement : ces tests le détectent, et vérifient qu'ils se régénèrent à l'identique avec les chemins relatifs du dépôt.
"""
import math
import re
import shutil
import tempfile
import unittest
from pathlib import Path

from common import (RACINE, donnees_actuelles, exige_libs, indice_brut, pk_betti, vers_0_10, copie_du_projet,
                    lancer_script_racine)

DOWNLOADS = RACINE / "downloads"
CLASSEMENT = DOWNLOADS / "oppchovec_betti_0_10_trie.xlsx"
STATS = DOWNLOADS / "stats_descriptives_betti_0_10.xlsx"
TOL = 1e-6   # les fichiers arrondissent à 6 décimales


def indice_betti(data):
    s01 = {c: {"Opp": d["Score_Opp"], "Cho": d["Score_Cho"], "Vec": d["Score_Vec"]} for c, d in data.items()}
    return vers_0_10(indice_brut(s01, pk_betti(s01)))


@exige_libs("pandas", "openpyxl")
class DownloadsCoherentsAvecLesDonnees(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import pandas as pd
        cls.data = donnees_actuelles()
        cls.attendu = indice_betti(cls.data)
        cls.classement = pd.ExcelFile(CLASSEMENT)
        cls.stats = pd.read_excel(STATS, sheet_name="Synthese", index_col=0)

    @classmethod
    def tearDownClass(cls):
        cls.classement.close()

    def test_liens_de_telechargement_de_index_html_existent(self):
        html = (RACINE / "index.html").read_text(encoding="utf-8")
        liens = re.findall(r'href="(downloads/[^"]+)"', html)
        self.assertEqual(len(liens), 2)
        for lien in liens:
            self.assertTrue((RACINE / lien).exists(), lien)

    def test_classement_betti_synthese(self):
        d = self.classement.parse("Synthese")
        self.assertEqual(len(d), 360)
        self.assertEqual(set(d["Zone"]), set(self.data))
        self.assertEqual(list(d["OppChoVec_0_10"]), sorted(d["OppChoVec_0_10"], reverse=True), "classement décroissant")
        for _, r in d.iterrows():
            c = r["Zone"]
            self.assertAlmostEqual(r["OppChoVec_0_10"], self.attendu[c], delta=TOL, msg=c)
            for dim in ("Opp", "Cho", "Vec"):
                self.assertAlmostEqual(r[f"Score_{dim}_0_10"], self.data[c][f"Score_{dim}_0_10"], delta=TOL, msg=f"{c} {dim}")
                self.assertAlmostEqual(r[f"Score_{dim}"], self.data[c][f"Score_{dim}"], delta=TOL, msg=f"{c} {dim}")

    def test_classement_betti_feuilles_par_dimension(self):
        for feuille, dim, indicateurs in (("Opp", "Opp", ["Opp1", "Opp2", "Opp3", "Opp4"]), ("Cho", "Cho", ["Cho1", "Cho2"]),
                                          ("Vec", "Vec", ["Vec1", "Vec2", "Vec3", "Vec4"])):
            d = self.classement.parse(feuille)
            with self.subTest(feuille=feuille):
                self.assertEqual(len(d), 360)
                self.assertEqual(list(d[f"Score_{dim}_0_10"]), sorted(d[f"Score_{dim}_0_10"], reverse=True))
                for _, r in d.iterrows():
                    for k in indicateurs:
                        self.assertAlmostEqual(r[k], self.data[r["Zone"]][k], delta=TOL, msg=f"{r['Zone']} {k}")

    def test_statistiques_descriptives_de_l_indice_betti(self):
        ligne = self.stats.loc["OppChoVec_0_10"]
        valeurs = list(self.attendu.values())
        moyenne = sum(valeurs) / 360
        ecart_type = math.sqrt(sum((v - moyenne) ** 2 for v in valeurs) / 360)    # écart-type de population, comme le script
        self.assertEqual(ligne["Nombre"], 360)
        self.assertAlmostEqual(ligne["Moyenne"], moyenne, delta=TOL)
        self.assertAlmostEqual(ligne["Ecart-type"], ecart_type, delta=TOL)
        self.assertAlmostEqual(ligne["Minimum"], 0.0, delta=TOL)
        self.assertAlmostEqual(ligne["Maximum"], 10.0, delta=TOL)

    def test_le_site_ne_propose_pas_un_classement_perime(self):
        """Garde-fou explicite : le top 10 du fichier téléchargé est celui de l'appli (mode Betti par défaut)."""
        d = self.classement.parse("Synthese")
        top_attendu = [c for c, _ in sorted(self.attendu.items(), key=lambda kv: -kv[1])[:10]]
        self.assertEqual(list(d["Zone"][:10]), top_attendu)


@exige_libs("pandas", "openpyxl")
class RejeuDesScriptsDesTableaux(unittest.TestCase):
    """Les scripts rejoués sur une copie écrivent DANS la copie (jamais ailleurs) et redonnent les fichiers du site."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)   # Windows peut garder un fichier verrouillé un instant
        cls.copie = Path(cls.tmp.name)
        copie_du_projet(cls.copie)
        cls.resultats = {s: lancer_script_racine(cls.copie, s) for s in ("gen_excel_010.py", "gen_comparaison.py", "gen_top5_betti.py", "gen_appendix2.py")}

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_les_quatre_scripts_se_terminent_sans_erreur(self):
        for s, r in self.resultats.items():
            with self.subTest(script=s):
                self.assertEqual(r.returncode, 0, r.stderr[-1200:])

    def test_les_sorties_sont_dans_la_copie(self):
        attendus = [self.copie / "downloads" / "oppchovec_betti_0_10_trie.xlsx", self.copie / "downloads" / "stats_descriptives_betti_0_10.xlsx"]
        sortie = self.copie / "stage_ambroise" / "Code" / "OUTPUT"
        attendus += [sortie / n for n in ("stats_descriptives_egal_0_10.xlsx", "oppchovec_egal_0_10_trie.xlsx", "comparaison_egal_vs_betti_0_10.xlsx",
                                           "top5_bottom5_betti.xlsx", "appendix2_cah5_classes.xlsx")]
        for f in attendus:
            self.assertTrue(f.exists() and f.stat().st_size > 1000, f.name)

    def test_fichiers_du_site_identiques_a_ceux_du_depot(self):
        import pandas as pd
        for nom in ("oppchovec_betti_0_10_trie.xlsx", "stats_descriptives_betti_0_10.xlsx"):
            with pd.ExcelFile(self.copie / "downloads" / nom) as neuf, pd.ExcelFile(DOWNLOADS / nom) as depot:
                self.assertEqual(neuf.sheet_names, depot.sheet_names)
                for feuille in depot.sheet_names:
                    pd.testing.assert_frame_equal(neuf.parse(feuille), depot.parse(feuille), check_exact=False, atol=1e-9, obj=f"{nom}/{feuille}")


class ScriptObsoleteGenLisaBetti(unittest.TestCase):
    def test_refuse_de_tourner_sans_option_explicite(self):
        """gen_lisa_betti.py (voisinage Queen) écraserait lisa_data_betti*.js avec une autre méthode que celle documentée (KNN k=5)."""
        with tempfile.TemporaryDirectory() as tmp:
            copie = Path(tmp)
            for nom in ("chemins.py", "gen_lisa_betti.py"):
                shutil.copy(RACINE / nom, copie / nom)
            r = lancer_script_racine(copie, "gen_lisa_betti.py")
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("obsolète", r.stdout + r.stderr)
            self.assertFalse(list(copie.rglob("lisa_data*.js")), "aucun fichier LISA ne doit être écrit")


if __name__ == "__main__":
    unittest.main()
