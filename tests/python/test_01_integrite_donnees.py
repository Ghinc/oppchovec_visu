"""1. Intégrité des données chargées par l'appli : complétude, bornes, noms de communes alignés partout."""
import json
import math
import unittest

from common import (CHAMPS_SCORES, GEOJSON, INDICATEURS, WEB, charger_const_js, charger_json, donnees_actuelles)


class IntegriteDataScores(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = donnees_actuelles()

    def test_360_communes_et_champs_attendus(self):
        self.assertEqual(len(self.data), 360)
        attendus = set(CHAMPS_SCORES) | set(INDICATEURS)
        for commune, champs in self.data.items():
            self.assertEqual(set(champs), attendus, f"champs inattendus pour {commune}")

    def test_toutes_valeurs_numeriques_finies(self):
        for commune, champs in self.data.items():
            for k, v in champs.items():
                self.assertIsInstance(v, (int, float), f"{commune}.{k} n'est pas numérique")
                self.assertTrue(math.isfinite(v), f"{commune}.{k} = {v}")

    def test_champs_0_10_couvrent_exactement_0_a_10(self):
        """README_FICHIERS : « toutes les valeurs sont entre 0 et 10 » ; min-max => min 0 et max 10 exactement."""
        for k in ("OppChoVec_0_10", "Score_Opp_0_10", "Score_Cho_0_10", "Score_Vec_0_10"):
            vals = [d[k] for d in self.data.values()]
            self.assertAlmostEqual(min(vals), 0.0, places=9, msg=k)
            self.assertAlmostEqual(max(vals), 10.0, places=9, msg=k)

    def test_scores_bruts_dans_leurs_intervalles(self):
        for c, d in self.data.items():
            for k in ("Score_Opp", "Score_Cho", "Score_Vec"):
                self.assertTrue(0 <= d[k] <= 1, f"{c}.{k}={d[k]}")
            # (1/3) * (3 scores <= 1, élevés à beta)^(alpha/beta) <= 3^(2/3)
            self.assertTrue(0 <= d["OppChoVec"] <= 3 ** (2 / 3) + 1e-12, f"{c}.OppChoVec={d['OppChoVec']}")

    def test_echelles_des_indicateurs_bruts(self):
        """Plages réelles documentées dans VERIFICATION_COHERENCE_DONNEES.md (section « Échelles utilisées »)."""
        plages = {"Opp1": (1, 7), "Opp2": (0, 2.1), "Opp3": (0, 300), "Opp4": (0, 100), "Cho1": (-20, 0),
                  "Cho2": (0, 100), "Vec1": (0, 70000), "Vec2": (0, 1), "Vec3": (0, 1), "Vec4": (0, 6000)}
        for ind, (lo, hi) in plages.items():
            vals = [d[ind] for d in self.data.values()]
            self.assertGreaterEqual(min(vals), lo, ind)
            self.assertLessEqual(max(vals), hi, ind)

    def test_aucun_indicateur_constant(self):
        """Un indicateur constant ferait diviser par zéro la normalisation min-max."""
        for ind in INDICATEURS:
            vals = {d[ind] for d in self.data.values()}
            self.assertGreater(len(vals), 1, f"{ind} est constant")


class NomsDeCommunesAlignes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.noms = set(donnees_actuelles())
        cls.geo = {f["properties"]["nom"] for f in charger_json(GEOJSON)["features"]}

    def test_geojson_et_donnees_ont_les_memes_360_noms(self):
        self.assertEqual(len(self.geo), 360)
        self.assertEqual(self.noms ^ self.geo, set())

    def test_pas_d_espaces_parasites(self):
        for n in self.noms:
            self.assertEqual(n, n.strip())

    def test_fichiers_derives_ont_les_memes_noms(self):
        cibles = {
            "sous_composantes.json": set(charger_json(WEB / "sous_composantes.json")),
            "details_calcul.json": set(charger_json(WEB / "details_calcul.json")),
            "densite_entrepreneuriale.json": set(charger_json(WEB / "densite_entrepreneuriale.json")),
            "donnees_completes_communes.json": set(charger_json(WEB / "donnees_completes_communes.json")),
            "cah_3_clusters.json": set(charger_json(WEB / "cah_3_clusters.json")["clusters"]),
            "cah_5_clusters.json": set(charger_json(WEB / "cah_5_clusters.json")["clusters"]),
        }
        for fichier in ("lisa_data.js", "lisa_data_1pct.js", "lisa_data_betti.js", "lisa_data_betti_1pct.js"):
            const = next(iter(charger_const_js(WEB / fichier).values()))
            cibles[fichier] = set(const["clusters"])
        for nom, ensemble in cibles.items():
            with self.subTest(fichier=nom):
                self.assertEqual(ensemble ^ self.noms, set())

    def test_bien_etre_subjectif_est_un_sous_ensemble(self):
        """Fichier partiel par nature (enquête sur 16 communes) : tous ses noms doivent exister."""
        subj = charger_json(WEB / "bien_etre_subjectif.json")
        self.assertEqual(set(subj) - self.noms, set())
        for nom, v in subj.items():
            self.assertTrue(math.isfinite(v["score"]) and v["n"] > 0, nom)


class FichiersWebLisibles(unittest.TestCase):
    def test_tous_les_json_du_dossier_web_sont_valides(self):
        for p in WEB.glob("*.json"):
            with self.subTest(fichier=p.name):
                json.loads(p.read_text(encoding="utf-8"))

    def test_fichiers_js_de_donnees_sont_parsables(self):
        for p in ("cah_data.js", "lisa_data.js", "lisa_data_1pct.js", "lisa_data_betti.js", "lisa_data_betti_1pct.js"):
            with self.subTest(fichier=p):
                self.assertTrue(charger_const_js(WEB / p))


if __name__ == "__main__":
    unittest.main()
