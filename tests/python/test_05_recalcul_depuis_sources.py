"""5. Recalculabilité : indicateurs depuis les sources brutes, scripts de régénération rejoués dans un dossier temporaire.

Les tests qui lisent les fichiers sources (xlsx/csv hors dépôt) sont ignorés si ces fichiers sont introuvables :
définir OPPCHOVEC_SOURCES = dossier « Stage Ambroise » contenant Données/Corse_Commune/.
Les scripts sont exécutés sur une COPIE : aucun fichier du dépôt n'est modifié par ces tests.
"""
import functools
import math
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from common import (ALIAS_NOMS_ANCIENS, GEOJSON, INDICATEURS, PYDIR, RACINE, WEB, charger_const_js, charger_json,
                    differences, donnees_actuelles, dossier_sources, exige_libs, exige_sources, lent)

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

    def test_opp1_education(self):
        self.comparer("Opp1", lire(self.d / "Opp1.xlsx")["Niveau d'education moyen"].to_dict())

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
@exige_sources()
@exige_libs("pandas")
class OppchovecPyEstSynchroniseAvecLeJson(unittest.TestCase):
    """Le script documenté (Python/README.md) doit produire les mêmes indicateurs que le JSON utilisé par l'appli.

    DETTE CONNUE (2026-10-11) : oppchovec.py n'est pas encore resynchronisé pour Opp4 (fibre absente) et Cho2
    (lit Cho2.xlsx au lieu de Cho2_francais_18plus.xlsx). Ces deux tests sont marqués « échec attendu » ; le jour où
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
        for k in ("Opp1", "Opp2", "Opp3", "Cho1", "Vec1", "Vec2", "Vec3", "Vec4"):
            with self.subTest(indicateur=k):
                self.assertLess(self.ecarts[k], 1e-9)

    @unittest.expectedFailure
    def test_opp4_synchronise(self):
        self.assertLess(self.ecarts["Opp4"], 1e-9)

    @unittest.expectedFailure
    def test_cho2_synchronise(self):
        self.assertLess(self.ecarts["Cho2"], 1e-9)


# ------------------------------------------------------------------------------------------------------------
SCRIPTS_PYTHON = ["regenerer_data_scores.py", "exporter_sous_composantes.py", "calculer_jenks_5_classes.py",
                  "graphique_ecarts_types_cah.py", "preparer_donnees_cah_web_complet.py", "generer_cah_data_js_complet.py",
                  "generer_donnees_communes_chatbot.py"]


def construire_miroir(racine_tmp):
    """Reproduit l'arborescence Code/{Python,WEB,OUTPUT} (les scripts utilisent des chemins relatifs ../WEB et ../OUTPUT)."""
    code = Path(racine_tmp) / "Code"
    (code / "Python").mkdir(parents=True)
    (code / "WEB").mkdir()
    (code / "OUTPUT").mkdir()
    for s in SCRIPTS_PYTHON:
        shutil.copy(PYDIR / s, code / "Python" / s)
    shutil.copy(WEB / "data_scores_0_10.json", code / "WEB")
    shutil.copy(GEOJSON, code / "WEB")
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
        # La chaîne documentée ne produit le graphique à 5 classes que si l'on élargit la liste à la main :
        # on le fait ici (voir tests/README.md, « points d'attention »).
        graphique = cls.code / "Python" / "graphique_ecarts_types_cah.py"
        texte = graphique.read_text(encoding="utf-8")
        assert "n_clusters_list = [3, 4]" in texte
        graphique.write_text(texte.replace("n_clusters_list = [3, 4]", "n_clusters_list = [3, 4, 5]"), encoding="utf-8")
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
    """gen_lisa_knn5.py (à la racine du dépôt) rejoué sur une copie : 4 fichiers LISA identiques (9999 permutations)."""

    def test_les_quatre_fichiers_lisa_sont_reproduits(self):
        with tempfile.TemporaryDirectory() as tmp:
            code = construire_miroir(tmp)
            script = (RACINE / "gen_lisa_knn5.py").read_text(encoding="utf-8")
            # ce script contient des chemins absolus vers un autre clone du projet : on les redirige vers la copie
            script, n1 = re.subn(r"WEB_DIR\s*=\s*'[^']*'", f"WEB_DIR  = {str(code / 'WEB').replace(chr(92), '/') + '/'!r}", script)
            script, n2 = re.subn(r"GEOJSON\s*=\s*'[^']*'", f"GEOJSON  = {str(code / 'WEB' / 'Commune_Corse.geojson').replace(chr(92), '/')!r}", script)
            self.assertEqual((n1, n2), (1, 1), "chemins du script non reconnus")
            (code / "Python" / "gen_lisa_knn5.py").write_text(script, encoding="utf-8")
            r = lancer(code, "gen_lisa_knn5.py", timeout=3000)
            self.assertEqual(r.returncode, 0, r.stderr[-1500:])
            for f, nom in (("lisa_data.js", "LISA_DATA"), ("lisa_data_1pct.js", "LISA_DATA_1PCT"),
                           ("lisa_data_betti.js", "LISA_DATA_BETTI"), ("lisa_data_betti_1pct.js", "LISA_DATA_BETTI_1PCT")):
                with self.subTest(fichier=f):
                    self.assertEqual(differences(charger_const_js(code / "WEB" / f, nom), charger_const_js(WEB / f, nom)), [])


if __name__ == "__main__":
    unittest.main()
