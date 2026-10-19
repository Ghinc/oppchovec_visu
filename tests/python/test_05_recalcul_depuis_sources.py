"""5. Recalculabilité (indice courant v2) : indicateurs depuis leurs composantes brutes, scripts de régénération rejoués dans un dossier temporaire.

Les composantes brutes de chaque indicateur sont dans stage_ambroise/Données/indice_v2/sources_indice_v2.json (produit par construire_indice_v2.py depuis les sources officielles 2023-2025).
Le test qui rejoue construire_indice_v2.py depuis les fichiers sources (volumineux, hors dépôt) est ignoré si le dossier est introuvable :
définir OPPCHOVEC_V2 = dossier des sources (par défaut C:/These/Données2/indice_v2_sources).
Les scripts sont exécutés sur une COPIE : aucun fichier du dépôt n'est modifié par ces tests.
"""
import math
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from common import (GEOJSON, INDICATEURS, PYDIR, RACINE, WEB, charger_const_js, charger_json, copie_du_projet, differences, donnees_actuelles,
                    exige_libs, lancer_script_racine, lent)

SOURCES_V2 = RACINE / "stage_ambroise" / "Données" / "indice_v2" / "sources_indice_v2.json"
DOSSIER_V2 = Path(os.environ.get("OPPCHOVEC_V2", "C:/These/Données2/indice_v2_sources"))
PYTHON = sys.executable


class IndicateursDepuisLesComposantes(unittest.TestCase):
    """Chaque indicateur de data_scores_0_10.json se retrouve depuis les composantes brutes de sources_indice_v2.json, avec la formule de sa définition."""

    @classmethod
    def setUpClass(cls):
        cls.v2 = charger_json(SOURCES_V2)["communes"]
        cls.data = donnees_actuelles()

    def verifier(self, indicateur, formule, tol=1e-9):
        for nom, c in self.v2.items():
            attendu = formule(c)
            with self.subTest(indicateur=indicateur, commune=nom):
                self.assertAlmostEqual(c[indicateur]["valeur"], attendu, delta=tol * max(1, abs(attendu)))
                self.assertAlmostEqual(self.data[nom][indicateur], attendu, delta=tol * max(1, abs(attendu)))

    def test_les_communes_sont_celles_de_l_appli(self):
        self.assertEqual(set(self.v2), set(self.data))
        self.assertEqual(len(self.v2), 360)

    def test_opp1_niveau_moyen_sur_7_niveaux(self):
        def f(c):
            o = c["Opp1"]
            effectifs = [o[f"niveau{n}"] for n in range(1, 8)]
            return sum(n * e for n, e in zip(range(1, 8), effectifs)) / sum(effectifs)
        self.verifier("Opp1", f)

    def test_opp2_theil_sur_8_categories(self):
        def f(c):
            x = [c["Opp2"][f"cs{i}"] for i in range(1, 9)]
            mu = sum(x) / 8
            return sum((v / mu) * math.log(v / mu) for v in x if v > 0) / 8
        self.verifier("Opp2", f)

    def test_opp3_voiture_transports_bus(self):
        self.verifier("Opp3", lambda c: c["Opp3"]["voiture"] + (100 if c["Opp3"]["tc_actifs"] > 0 else 0) + c["Opp3"]["bus"])

    def test_opp3_les_trois_villes_a_reseau_de_bus(self):
        villes = {nom for nom, c in self.v2.items() if c["Opp3"]["bus"] > 0}
        self.assertEqual(villes, {"Ajaccio", "Bastia", "Porto-Vecchio"})

    def test_opp4_inclut_la_4g_le_debit_et_la_fibre(self):
        self.verifier("Opp4", lambda c: (c["Opp4"]["g4"] + c["Opp4"]["debit"] + c["Opp4"]["fibre"]) / 3)
        for c in self.v2.values():
            for k in ("g4", "debit", "fibre"):
                self.assertTrue(0 <= c["Opp4"][k] <= 100)

    def test_cho1_quartiers_prioritaires(self):
        self.verifier("Cho1", lambda c: -math.log(c["Cho1"]["personnes_qpv"]) if c["Cho1"]["personnes_qpv"] > 0 else 0)
        avec = {nom: c["Cho1"]["personnes_qpv"] for nom, c in self.v2.items() if c["Cho1"]["personnes_qpv"] > 0}
        self.assertEqual(avec, {"Ajaccio": 5778, "Porto-Vecchio": 1127, "Bastia": 11027})          # INSEE, population communale en QPV 2024

    def test_cho2_francais_18_ans_et_plus(self):
        def f(c):
            o = c["Cho2"]
            etr = (o["pop_18_24"] - 0.7 * o["francais_15_24"]) + o["etrangers_25_plus"]
            self.assertAlmostEqual(o["etrangers_18_plus"], etr, delta=1e-6)
            return min(100.0, 100 - 100 * etr / o["population"])
        self.verifier("Cho2", f)

    def test_vec1_revenu_fiscal_moyen_par_foyer(self):
        propres = {}
        for nom, c in self.v2.items():
            v = c["Vec1"]
            if not v["departemental"]:
                self.assertAlmostEqual(v["valeur"], v["revenu_fiscal"] / v["foyers"], delta=1e-6, msg=nom)
            else:
                propres.setdefault(c["code"][:2], set()).add(round(v["valeur"], 6))
        for dep, valeurs in propres.items():                         # communes sous secret statistique : une seule valeur par département
            self.assertEqual(len(valeurs), 1, dep)
        self.verifier("Vec1", lambda c: c["Vec1"]["valeur"])

    def test_vec2_densite_et_maisons(self):
        self.verifier("Vec2", lambda c: (math.exp(-c["Vec2"]["pers_piece"]) + c["Vec2"]["maisons"]) / 2)

    def test_vec3_stabilite_de_l_emploi_a_trois_categories(self):
        def f(c):
            o = c["Vec3"]
            return (0.5 * o["autres"] + o["stable"]) / (o["chomeur"] + o["autres"] + o["stable"])
        self.verifier("Vec3", f)

    def test_vec4_services_a_20_minutes(self):
        self.verifier("Vec4", lambda c: c["Vec4"]["valeur"])

    def test_exporter_sous_composantes_redonne_le_fichier_du_depot(self):
        sys.path.insert(0, str(PYDIR))
        import exporter_sous_composantes as ex
        calcule = ex.sous_composantes_par_commune(self.data)
        self.assertEqual(differences(calcule, charger_json(WEB / "sous_composantes.json")), [])


class ProvenanceDesSources(unittest.TestCase):
    """Chaque indicateur a une source et un millésime documentés, et le millésime est dans la fenêtre 2023-2025 (sauf les quartiers prioritaires, référence 2020)."""

    @classmethod
    def setUpClass(cls):
        cls.s = charger_json(SOURCES_V2)

    def test_une_source_et_un_millesime_par_indicateur(self):
        self.assertEqual(set(self.s["sources"]), set(INDICATEURS))
        self.assertEqual(set(self.s["millesimes"]), set(INDICATEURS))
        for k, texte in self.s["sources"].items():
            self.assertGreater(len(texte), 20, k)

    def test_millesimes_homogenes(self):
        for k, m in self.s["millesimes"].items():
            if k == "Cho1":
                self.assertIn("2020", m)                      # seule référence publiée pour les QPV 2024 (population au 1er janvier 2020)
            else:
                self.assertTrue(any(a in m for a in ("2023", "2024")), f"{k} : {m}")


@unittest.skipUnless((DOSSIER_V2 / "rp2023").exists(), "sources de l'indice v2 introuvables (définir OPPCHOVEC_V2)")
@exige_libs("pandas", "numpy", "openpyxl", "geopandas")
@lent()
class ReconstruireLIndiceV2DepuisLesSources(unittest.TestCase):
    def test_construire_indice_v2_redonne_le_fichier_du_depot(self):
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            code = construire_miroir(tmp)
            r = lancer(code, "construire_indice_v2.py", str(DOSSIER_V2))
            self.assertEqual(r.returncode, 0, r.stdout[-800:] + r.stderr[-800:])
            produit = charger_json(Path(tmp) / "Données" / "indice_v2" / "sources_indice_v2.json")
            self.assertEqual(differences(produit, charger_json(SOURCES_V2)), [])


# ------------------------------------------------------------------------------------------------------------
SCRIPTS_PYTHON = ["regenerer_data_scores.py", "exporter_sous_composantes.py", "calculer_jenks_5_classes.py",
                  "graphique_ecarts_types_cah.py", "preparer_donnees_cah_web_complet.py", "generer_cah_data_js_complet.py",
                  "generer_donnees_communes_chatbot.py", "construire_indice_v2.py", "construire_serie_temporelle.py"]


def construire_miroir(racine_tmp):
    """Reproduit l'arborescence {Code/{Python,WEB,OUTPUT},Données} (les scripts utilisent des chemins relatifs ../WEB, ../OUTPUT, ../../Données)."""
    code = Path(racine_tmp) / "Code"
    (code / "Python").mkdir(parents=True)
    (code / "WEB").mkdir()
    (code / "OUTPUT").mkdir()
    for s in SCRIPTS_PYTHON:
        shutil.copy(PYDIR / s, code / "Python" / s)
    for f in ("data_scores_0_10.json", "sous_composantes.json"):
        shutil.copy(WEB / f, code / "WEB")
    donnees = Path(racine_tmp) / "Données"
    (donnees / "indice_v2").mkdir(parents=True)
    shutil.copy(GEOJSON, donnees)
    shutil.copy(SOURCES_V2, donnees / "indice_v2")
    return code


def lancer(code, script, *args, timeout=600):
    return subprocess.run([PYTHON, "-X", "utf8", script, *args], cwd=code / "Python", capture_output=True, text=True,
                          encoding="utf-8", timeout=timeout, env={**os.environ, "MPLBACKEND": "Agg", "PYTHONIOENCODING": "utf-8"})


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
        avant = (self.code / "WEB" / "data_scores_0_10.json").read_bytes()
        r = lancer(self.code, "regenerer_data_scores.py")
        self.assertEqual(r.returncode, 0, r.stdout[-800:] + r.stderr[-800:])
        self.assertEqual((self.code / "WEB" / "data_scores_0_10.json").read_bytes(), avant)
        self.assertEqual((self.code / "WEB" / "data_scores_0_10.json").read_bytes(), (WEB / "data_scores_0_10.json").read_bytes())


@exige_libs("pandas")
class GardeFousDesScriptsDeRegeneration(unittest.TestCase):
    """Les scripts doivent REFUSER d'écrire quand les données sont incohérentes (plutôt que propager une erreur)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.code = construire_miroir(self.tmp.name)

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
        r = lancer(self.code, "regenerer_data_scores.py")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("ne reproduit pas", r.stdout + r.stderr)
        self.assertEqual((self.code / "WEB" / "data_scores_0_10.json").read_bytes(), avant, "le fichier ne doit pas être réécrit")

    def test_export_refuse_une_recomposition_non_conforme(self):
        self.corrompre("Afa", "Opp4", 5.0)                  # Opp4 ne correspond plus à (4G + débit + fibre) / 3
        (self.code / "WEB" / "sous_composantes.json").unlink()
        r = lancer(self.code, "exporter_sous_composantes.py")
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
