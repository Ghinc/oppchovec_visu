"""5. Recalculabilité : indicateurs depuis les sources brutes, scripts de régénération rejoués dans un dossier temporaire.

Les tests qui lisent les fichiers sources (xlsx/csv hors dépôt) sont ignorés si ces fichiers sont introuvables :
définir OPPCHOVEC_SOURCES = dossier « Stage Ambroise » contenant Données/Corse_Commune/.
Les scripts sont exécutés sur une COPIE : aucun fichier du dépôt n'est modifié par ces tests.
"""
import functools
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from common import (ALIAS_NOMS_ANCIENS, GEOJSON, INDICATEURS, PYDIR, RACINE, WEB, charger_const_js, charger_json,
                    copie_du_projet, differences, donnees_actuelles, dossier_sources, exige_libs, exige_sources, lancer_script_racine, lent)

EDUCATION = RACINE / "stage_ambroise" / "Données" / "education_communes_opp1.json"
ALIAS_MAPPING = {"La Porta": "Porta", "L'Île-Rousse": "Île-Rousse"}   # noms du mapping INSEE -> noms des données
PYTHON = sys.executable


def lire(chemin):
    import pandas as pd
    chemin = Path(chemin)
    df = pd.read_csv(chemin) if chemin.suffix == ".csv" else pd.read_excel(chemin)
    cle = next(c for c in df.columns if c in ("Code commune", "code_commune"))
    return df.set_index(cle)


@exige_sources()
class IndicateursDepuisLesSources(unittest.TestCase):
    """Chaque indicateur de data_scores_0_10.json doit se retrouver à partir des fichiers sources, avec les formules documentées."""

    @classmethod
    def setUpClass(cls):
        import pandas as pd
        cls.data = donnees_actuelles()
        cls.src = dossier_sources()
        cls.d = cls.src / "Données" / "Corse_Commune"
        mp = pd.read_csv(cls.d / "mapping_communes.csv")
        cls.code2nom = {c: ALIAS_MAPPING.get(n, n) for c, n in zip(mp.code_commune, mp.nom_commune)}

    def comparer(self, indicateur, valeurs_par_code):
        self.assertEqual(len(valeurs_par_code), 360)
        pire = 0.0
        for code, v in valeurs_par_code.items():
            pire = max(pire, abs(v - self.data[self.code2nom[code]][indicateur]))
        self.assertLess(pire, 1e-9, f"{indicateur} : écart max {pire:.3g}")

    def test_opp2_theil(self):
        self.comparer("Opp2", lire(self.d / "Opp2.xlsx")["Indice de Theil"].to_dict())

    def test_opp3_mobilite(self):
        df = lire(self.d / "Opp3.xlsx")
        voit, tc = "Part des ménages ayant au moins 1 voiture 2021", "Accès aux réseaux de transport"
        bus = {"2A004", "2B033", "2A247"}   # Ajaccio, Bastia, Porto-Vecchio
        self.comparer("Opp3", {c: r[voit] + (100 if r[tc] > 0 else 0) + (100 if c in bus else 0) for c, r in df.iterrows()})

    def test_opp4_connectivite_inclut_la_fibre(self):
        df, fibre = lire(self.d / "Opp4.xlsx"), lire(self.d / "fibre_corse.csv")
        g4, hd = "Proportion de population couverte par la 4G", "Proportion de population avec débit > 30Mb/s"
        self.comparer("Opp4", {c: (r[g4] + r[hd] + fibre.loc[c, "taux_fibre"]) / 3 for c, r in df.iterrows()})

    def test_cho1_quartiers_prioritaires(self):
        df = lire(self.d / "Cho1_personnes.xlsx")
        self.comparer("Cho1", {c: (-math.log(n) if n > 0 else 0) for c, n in df["Nb_Personnes_Quartiers_Prioritaires"].items()})

    def test_cho2_vote_vient_du_fichier_francais_18_plus(self):
        self.comparer("Cho2", lire(self.d / "Cho2_francais_18plus.xlsx")["Proportion_Francais_18plus"].to_dict())

    def test_vec1_revenu(self):
        self.comparer("Vec1", lire(self.d / "Vec1.xlsx")["Médiane du niveau de vie 2021"].to_dict())

    def test_vec2_logement(self):
        df = lire(self.d / "vec2_lb.csv")
        self.comparer("Vec2", {c: (math.exp(-r.pers_par_piece_moy) + (r.pct_avec_sdb + r.pct_chauffage) / 2 + r.pct_maisons) / 3
                               for c, r in df.iterrows()})

    def test_vec3_stabilite_emploi_poids_corriges(self):
        df = lire(self.d / "Vec3.xlsx")
        cats = {"Emploi stable (5)": 1, "Contrat à durée déterminée (4)": 0.75, "Contrat ponctuel (3)": 0.5,
                "Chomeur (1)": 0, "Emploi aidé (2)": 0.25}
        self.comparer("Vec3", {c: sum(r[k] * w for k, w in cats.items()) / sum(r[k] for k in cats) for c, r in df.iterrows()})

    def test_vec4_services_20_minutes(self):
        df = lire(self.src / "Code" / "Python" / "services_accessibles_20min_local.csv")
        self.comparer("Vec4", df["nb_services_20min"].to_dict())

    def test_vec4_aussi_dans_le_depot(self):
        """Le dépôt embarque cette source (services_accessibles_20min_local.json) : elle doit rester cohérente."""
        embarque = {ALIAS_NOMS_ANCIENS.get(k, k): v for k, v in charger_json(PYDIR / "services_accessibles_20min_local.json").items()}
        for c, d in self.data.items():
            self.assertEqual(embarque[c]["nb_services_20min"], d["Vec4"], c)

    def test_exporter_sous_composantes_redonne_le_fichier_du_depot(self):
        sys.path.insert(0, str(PYDIR))
        import exporter_sous_composantes as exp
        sortie = exp.sous_composantes_par_commune(self.src, self.data)
        self.assertEqual(differences(sortie, charger_json(WEB / "sous_composantes.json")), [])


# ------------------------------------------------------------------------------------------------------------
class Opp1DepuisLeRecensement(unittest.TestCase):
    """Opp1 = niveau de diplôme moyen (1-7) des 18 ans ou plus non scolarisés, recensement INSEE 2020 (calculer_education_opp1.py)."""

    @classmethod
    def setUpClass(cls):
        cls.data = donnees_actuelles()
        cls.edu = charger_json(EDUCATION)

    def test_le_json_de_l_appli_utilise_le_fichier_education(self):
        self.assertEqual(set(self.edu["communes"]), set(self.data))
        for c, d in self.edu["communes"].items():
            self.assertEqual(self.data[c]["Opp1"], d["niveau_moyen"], c)

    def test_le_fichier_education_est_coherent_avec_lui_meme(self):
        for c, d in self.edu["communes"].items():
            eff = {int(k): v for k, v in d["effectifs_par_niveau"].items()}
            self.assertEqual(sorted(eff), [1, 2, 3, 4, 5, 6, 7], c)
            self.assertTrue(all(v >= 0 for v in eff.values()), c)
            self.assertAlmostEqual(sum(eff.values()), d["effectif_18p_non_scolarises"], places=6, msg=c)
            # 18+ = 15+ moins les 15-17 ans non scolarisés (retirés de la catégorie « aucun diplôme ou CEP »)
            self.assertAlmostEqual(d["effectif_15p_non_scolarises"] - d["retire_15_17_ans"], d["effectif_18p_non_scolarises"], places=6, msg=c)
            self.assertAlmostEqual(sum(n * v for n, v in eff.items()) / sum(eff.values()), d["niveau_moyen"], places=9, msg=c)
            self.assertGreaterEqual(d["niveau_moyen"], 1)
            self.assertLessEqual(d["niveau_moyen"], 7)

    def test_les_15_17_ans_retires_sont_marginaux(self):
        retires = sum(d["retire_15_17_ans"] for d in self.edu["communes"].values())
        total = sum(d["effectif_15p_non_scolarises"] for d in self.edu["communes"].values())
        self.assertAlmostEqual(retires, 500, delta=1)                 # mesuré : 500 personnes
        self.assertLess(retires / total, 0.0025)                      # 0,19 %

    def test_opp1_n_est_plus_la_suite_artificielle_de_l_ancien_fichier(self):
        ancien = [float("5." + str(75 + i)) for i in range(360)]     # Opp1.xlsx : 5,75 ; 5,76 ; ... (voir tests/README.md)
        self.assertLess(max(d["Opp1"] for d in self.data.values()), 5)
        self.assertNotIn(min(ancien), [d["Opp1"] for d in self.data.values()])

    @exige_libs("pandas", "openpyxl")
    def test_le_script_reproduit_le_fichier_depuis_le_recensement(self):
        xlsx = os.environ.get("OPPCHOVEC_INSEE_DIPLOMES", "")
        if not xlsx or not Path(xlsx).exists():
            self.skipTest("définir OPPCHOVEC_INSEE_DIPLOMES = chemin de base-ic-diplomes-formation-2020.xlsx (INSEE) pour rejouer le calcul")
        with tempfile.TemporaryDirectory() as tmp:
            code = construire_miroir(tmp)
            r = lancer(code, "calculer_education_opp1.py", xlsx)
            self.assertEqual(r.returncode, 0, r.stdout[-800:] + r.stderr[-800:])
            self.assertEqual(differences(charger_json(Path(tmp) / "Données" / "education_communes_opp1.json"), self.edu), [])


@exige_libs("pandas", "numpy")
class RegenererOpp1EstIdempotent(unittest.TestCase):
    def test_relancer_ne_change_pas_un_octet(self):
        with tempfile.TemporaryDirectory() as tmp:
            code = construire_miroir(tmp)
            avant = (code / "WEB" / "data_scores_0_10.json").read_bytes()
            r = lancer(code, "regenerer_opp1.py")
            self.assertEqual(r.returncode, 0, r.stdout[-800:] + r.stderr[-800:])
            self.assertEqual((code / "WEB" / "data_scores_0_10.json").read_bytes(), avant)


@exige_sources()
@exige_libs("pandas")
class OppchovecPyEstSynchroniseAvecLeJson(unittest.TestCase):
    """Le script documenté (Python/README.md) doit produire les mêmes indicateurs que le JSON utilisé par l'appli.

    DETTE CONNUE (2026-10-11, complétée le 2026-10-13) : oppchovec.py n'est pas encore resynchronisé pour Opp4 (fibre absente),
    Cho2 (lit Cho2.xlsx au lieu de Cho2_francais_18plus.xlsx) et Opp1 (lit Opp1.xlsx, une suite artificielle, au lieu du niveau
    de diplôme INSEE). Ces trois tests sont marqués « échec attendu » ; le jour où
    oppchovec.py est corrigé, ils passeront « par surprise » et il suffira de retirer le décorateur.
    """

    @classmethod
    def setUpClass(cls):
        import pandas as pd
        cls.data = donnees_actuelles()
        src = dossier_sources()
        sys.path.insert(0, str(PYDIR))
        import oppchovec
        d = src / "Données" / "Corse_Commune"
        oppchovec.DATA_DIR = d
        oppchovec.MAPPING_FILE = d / "mapping_communes.csv"
        oppchovec.INPUT_FILES = {k: (d / v.name if k != "Vec4" else src / "Code" / "Python" / "services_accessibles_20min_local.csv")
                                 for k, v in oppchovec.INPUT_FILES.items()}
        cache = functools.lru_cache(maxsize=None)
        lecteurs = [mock.patch.object(pd, "read_excel", cache(pd.read_excel)), mock.patch.object(pd, "read_csv", cache(pd.read_csv))]
        for m in lecteurs:
            m.start()
        cls._patches = lecteurs
        mapping = oppchovec.charger_mapping_communes()
        cls.ecarts = {k: 0.0 for k in INDICATEURS}
        for code in oppchovec.charger_toutes_communes():
            calc = oppchovec.calculer_indicateurs(oppchovec.charger_donnees_commune(code))
            nom = ALIAS_MAPPING.get(mapping[code], mapping[code])
            for k in INDICATEURS:
                cls.ecarts[k] = max(cls.ecarts[k], abs(calc.get(k, math.nan) - cls.data[nom][k])) if k in calc else math.inf

    @classmethod
    def tearDownClass(cls):
        for m in cls._patches:
            m.stop()

    def test_indicateurs_synchronises(self):
        for k in ("Opp2", "Opp3", "Cho1", "Vec1", "Vec2", "Vec3", "Vec4"):
            with self.subTest(indicateur=k):
                self.assertLess(self.ecarts[k], 1e-9)

    @unittest.expectedFailure
    def test_opp1_synchronise(self):
        """DETTE CONNUE (2026-10-13) : oppchovec.py lit encore Opp1.xlsx (suite artificielle 5,75, 5,76...) ; les données
        utilisent le niveau de diplôme INSEE (Données/education_communes_opp1.json, calculer_education_opp1.py)."""
        self.assertLess(self.ecarts["Opp1"], 1e-9)

    @unittest.expectedFailure
    def test_opp4_synchronise(self):
        self.assertLess(self.ecarts["Opp4"], 1e-9)

    @unittest.expectedFailure
    def test_cho2_synchronise(self):
        self.assertLess(self.ecarts["Cho2"], 1e-9)


# ------------------------------------------------------------------------------------------------------------
SCRIPTS_PYTHON = ["regenerer_data_scores.py", "regenerer_opp1.py", "calculer_education_opp1.py",
                  "exporter_sous_composantes.py", "calculer_jenks_5_classes.py",
                  "graphique_ecarts_types_cah.py", "preparer_donnees_cah_web_complet.py", "generer_cah_data_js_complet.py",
                  "generer_donnees_communes_chatbot.py"]


def construire_miroir(racine_tmp):
    """Reproduit l'arborescence {Code/{Python,WEB,OUTPUT},Données} (les scripts utilisent des chemins relatifs ../WEB, ../OUTPUT, ../../Données)."""
    code = Path(racine_tmp) / "Code"
    (code / "Python").mkdir(parents=True)
    (code / "WEB").mkdir()
    (code / "OUTPUT").mkdir()
    for s in SCRIPTS_PYTHON:
        shutil.copy(PYDIR / s, code / "Python" / s)
    shutil.copy(WEB / "data_scores_0_10.json", code / "WEB")
    donnees = Path(racine_tmp) / "Données"
    donnees.mkdir()
    shutil.copy(GEOJSON, donnees)
    shutil.copy(EDUCATION, donnees)
    return code


def lancer(code, script, *args, timeout=600):
    return subprocess.run([PYTHON, "-X", "utf8", script, *args], cwd=code / "Python", capture_output=True, text=True,
                          encoding="utf-8", timeout=timeout, env={**__import__("os").environ, "MPLBACKEND": "Agg", "PYTHONIOENCODING": "utf-8"})


@exige_libs("pandas", "numpy", "jenkspy", "scipy", "sklearn", "geopandas", "matplotlib")
class RejeuDesScriptsDeRegeneration(unittest.TestCase):
    """Rejoue la chaîne documentée sur une copie : les fichiers produits doivent être ceux du dépôt."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.code = construire_miroir(cls.tmp.name)
        cls.resultats = {}
        for s in ("calculer_jenks_5_classes.py", "graphique_ecarts_types_cah.py", "preparer_donnees_cah_web_complet.py",
                  "generer_cah_data_js_complet.py", "generer_donnees_communes_chatbot.py"):
            cls.resultats[s] = lancer(cls.code, s)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_les_scripts_se_terminent_sans_erreur(self):
        for s, r in self.resultats.items():
            with self.subTest(script=s):
                self.assertEqual(r.returncode, 0, r.stderr[-1500:])

    def test_seuils_jenks_identiques(self):
        a = charger_json(self.code / "WEB" / "seuils_jenks_optimal_gvf.json")
        b = charger_json(WEB / "seuils_jenks_optimal_gvf.json")
        a.pop("metadata"), b.pop("metadata")
        self.assertEqual(differences(a, b), [])

    def test_cah_identique(self):
        for f in ("cah_3_clusters.json", "cah_5_clusters.json"):
            with self.subTest(fichier=f):
                self.assertEqual(differences(charger_json(self.code / "WEB" / f), charger_json(WEB / f)), [])
        self.assertEqual((self.code / "WEB" / "cah_data.js").read_text(encoding="utf-8"), (WEB / "cah_data.js").read_text(encoding="utf-8"))

    def test_graphiques_cah_produits(self):
        for n in (3, 5):
            png = self.code / "WEB" / f"cah_{n}_clusters_ecarts.png"
            self.assertTrue(png.exists() and png.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n", png.name)

    def test_donnees_chatbot_identiques(self):
        self.assertEqual(differences(charger_json(self.code / "WEB" / "donnees_completes_communes.json"),
                                     charger_json(WEB / "donnees_completes_communes.json")), [])

    def test_regenerer_data_scores_est_idempotent(self):
        """Relancer la régénération sur les données actuelles ne change pas un seul octet."""
        src = dossier_sources()
        if src is None:
            self.skipTest("sources brutes introuvables")
        avant = (self.code / "WEB" / "data_scores_0_10.json").read_bytes()
        r = lancer(self.code, "regenerer_data_scores.py", str(src))
        self.assertEqual(r.returncode, 0, r.stdout[-800:] + r.stderr[-800:])
        self.assertEqual((self.code / "WEB" / "data_scores_0_10.json").read_bytes(), avant)
        self.assertEqual((self.code / "WEB" / "data_scores_0_10.json").read_bytes(), (WEB / "data_scores_0_10.json").read_bytes())


@exige_sources()
@exige_libs("pandas")
class GardeFousDesScriptsDeRegeneration(unittest.TestCase):
    """Les scripts doivent REFUSER d'écrire quand les données sont incohérentes (plutôt que propager une erreur)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.code = construire_miroir(self.tmp.name)
        self.src = dossier_sources()

    def tearDown(self):
        self.tmp.cleanup()

    def corrompre(self, commune, champ, delta):
        import json
        p = self.code / "WEB" / "data_scores_0_10.json"
        d = json.loads(p.read_text(encoding="utf-8"))
        d[commune][champ] += delta
        p.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")
        return p.read_bytes()

    def test_regeneration_refuse_un_json_dont_les_scores_ne_suivent_pas_les_indicateurs(self):
        avant = self.corrompre("Afa", "Opp1", 0.3)          # indicateur modifié sans recalcul des scores
        r = lancer(self.code, "regenerer_data_scores.py", str(self.src))
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("ne reproduit pas", r.stdout + r.stderr)
        self.assertEqual((self.code / "WEB" / "data_scores_0_10.json").read_bytes(), avant, "le fichier ne doit pas être réécrit")

    def test_regenerer_opp1_refuse_un_json_dont_les_scores_ne_suivent_pas_les_indicateurs(self):
        avant = self.corrompre("Afa", "Opp2", 0.2)
        r = lancer(self.code, "regenerer_opp1.py")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("ne reproduit pas", r.stdout + r.stderr)
        self.assertEqual((self.code / "WEB" / "data_scores_0_10.json").read_bytes(), avant, "le fichier ne doit pas être réécrit")

    def test_export_refuse_une_recomposition_non_conforme(self):
        self.corrompre("Afa", "Opp4", 5.0)                  # Opp4 ne correspond plus à (4G + débit + fibre) / 3
        r = lancer(self.code, "exporter_sous_composantes.py", str(self.src))
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("Opp4: KO", r.stdout)
        self.assertFalse((self.code / "WEB" / "sous_composantes.json").exists(), "aucun fichier ne doit être écrit")


# ------------------------------------------------------------------------------------------------------------
@lent()
@exige_libs("pandas", "numpy", "geopandas", "libpysal", "esda")
class RejeuLisa(unittest.TestCase):
    """gen_lisa_knn5.py (racine du dépôt) rejoué sur une copie via OPPCHOVEC_RACINE : 4 fichiers LISA identiques (9999 permutations)."""

    def test_les_quatre_fichiers_lisa_sont_reproduits(self):
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            copie = Path(tmp)
            copie_du_projet(copie)
            r = lancer_script_racine(copie, "gen_lisa_knn5.py", timeout=3000)
            self.assertEqual(r.returncode, 0, r.stderr[-1500:])
            for f, nom in (("lisa_data.js", "LISA_DATA"), ("lisa_data_1pct.js", "LISA_DATA_1PCT"),
                           ("lisa_data_betti.js", "LISA_DATA_BETTI"), ("lisa_data_betti_1pct.js", "LISA_DATA_BETTI_1PCT")):
                with self.subTest(fichier=f):
                    produit = copie / "stage_ambroise" / "Code" / "WEB" / f
                    self.assertEqual(differences(charger_const_js(produit, nom), charger_const_js(WEB / f, nom)), [])


if __name__ == "__main__":
    unittest.main()
