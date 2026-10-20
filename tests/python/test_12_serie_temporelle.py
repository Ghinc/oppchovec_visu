"""12. Série temporelle (onglet Évolution) : indice comparable 2016 / 2021, recalculé en Python depuis les indicateurs bruts du fichier.

* normalisation min-max commune aux deux années, dimensions = moyenne des indicateurs disponibles, p_k de Betti sur les deux années ensemble,
  mise à l'échelle 0-10 sur les deux années ensemble, seuils de Jenks sur les deux années ensemble ;
* rejeu du script construire_serie_temporelle.py si OPPCHOVEC_SERIE désigne le dossier contenant les sous-dossiers 2016 et 2021 (fichiers INSEE / DGFiP).
"""
import json
import os
import sys
import unittest
from pathlib import Path

import math

from common import PYDIR, RACINE, WEB, charger_json, donnees_actuelles, exige_libs, indice_brut, pk_betti, vers_0_10

ANNEES = ("2016", "2021")
DIMENSIONS = {"Opp": ["Opp1", "Opp2", "Opp3", "Opp4"], "Cho": ["Cho1", "Cho2"], "Vec": ["Vec1", "Vec2", "Vec3", "Vec4"]}


class SerieTemporelle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = charger_json(WEB / "serie_temporelle.json")
        cls.noms = sorted(cls.d["communes"])

    def test_structure(self):
        self.assertEqual(len(self.noms), 360)
        self.assertEqual(self.d["annees"], [2016, 2021])
        self.assertEqual(self.d["indicateurs"], [k for ks in DIMENSIONS.values() for k in ks])
        self.assertEqual(self.d["exclus"], {})
        for c in self.noms:
            for a in ANNEES:
                for v in self.d["communes"][c][a]["indicateurs"].values():
                    self.assertTrue(v == v and abs(v) != float("inf"), f"{c} {a}")

    def test_vec1_est_le_revenu_fiscal_moyen_par_foyer_de_la_commune(self):
        """Vec1 = revenu fiscal moyen par foyer fiscal (IRCOM) : propre à la commune aux deux dates, valeur départementale seulement sous secret statistique
        (11 communes en 2016, 12 en 2021) ; 2021 identique à la variante « revenu fiscal 2021 » archivée de l'ancien indice (Données/archive_indice_v1_2020_2024/vec1_revenu_fiscal.json)."""
        alt = json.loads((RACINE / "stage_ambroise" / "Données" / "archive_indice_v1_2020_2024" / "vec1_revenu_fiscal.json").read_text(encoding="utf-8"))["communes"]
        for c in self.noms:
            x = self.d["communes"][c]["2021"]
            self.assertAlmostEqual(x["indicateurs"]["Vec1"], alt[c]["revenu_moyen"], 6, c)
            self.assertEqual(x["vec1_departementale"], alt[c]["estime_departement"], c)
        for a, attendu in (("2016", 11), ("2021", 12)):
            self.assertEqual(sum(self.d["communes"][c][a]["vec1_departementale"] for c in self.noms), attendu, a)
            for c in self.noms:
                x = self.d["communes"][c][a]
                comp = x["composantes"]["Vec1"]
                if not x["vec1_departementale"]:
                    self.assertAlmostEqual(x["indicateurs"]["Vec1"], comp["revenu_fiscal"] / comp["nb_foyers"], 4, f"{c} {a}")
            for dep in ("2A", "2B"):                          # communes sous secret : exactement la valeur de leur département
                valeurs = {self.d["communes"][c][a]["indicateurs"]["Vec1"] for c in self.noms
                           if self.d["communes"][c]["code"].startswith(dep) and self.d["communes"][c][a]["vec1_departementale"]}
                self.assertLessEqual(len(valeurs), 1, f"{a} {dep}")

    def test_cho1_est_moins_log_des_personnes_en_quartier_prioritaire_geographie_2015(self):
        """Cho1 = -log(personnes en QPV), 0 sans quartier ; trois communes (Ajaccio, Bastia, Porto-Vecchio) ; population 2013 pour 2016, 2018 pour 2021."""
        attendu = {"Ajaccio": (2833, 2877), "Bastia": (10432, 11488), "Porto-Vecchio": (1012, 797)}
        for c in self.noms:
            for a, i in (("2016", 0), ("2021", 1)):
                x = self.d["communes"][c][a]
                if c in attendu:
                    self.assertEqual(x["composantes"]["Cho1"]["personnes_qpv"], attendu[c][i], f"{c} {a}")
                    self.assertAlmostEqual(x["indicateurs"]["Cho1"], -math.log(attendu[c][i]), 9, f"{c} {a}")
                else:
                    self.assertEqual(x["indicateurs"]["Cho1"], 0.0, f"{c} {a}")

    def test_vec4_est_celui_du_fichier_2016_2021(self):
        """Vec4 de la série = nombre d'équipements à 20 minutes du fichier Données/vec4_serie_2016_2021.json (BPE 2016 et 2021, 147 types, pharmacies et gynécologues rapprochés)."""
        v = json.loads((RACINE / "stage_ambroise" / "Données" / "vec4_serie_2016_2021.json").read_text(encoding="utf-8"))
        self.assertEqual(v["types_communs"], 147)
        for c in self.noms:
            for a in ANNEES:
                self.assertEqual(self.d["communes"][c][a]["indicateurs"]["Vec4"], v["communes"][c][a], f"{c} {a}")
                self.assertEqual(self.d["communes"][c][a]["composantes"]["Vec4"]["services_20min"], v["communes"][c][a], f"{c} {a}")

    def test_opp4_est_la_moyenne_de_la_4g_du_debit_et_de_la_fibre(self):
        """Opp4 = (4G + débit >= 30 Mbit/s + fibre) / 3, en %, depuis Données/opp4_serie_2016_2021.json (4G : population couverte par au moins un opérateur)."""
        o = json.loads((RACINE / "stage_ambroise" / "Données" / "opp4_serie_2016_2021.json").read_text(encoding="utf-8"))["communes"]
        for c in self.noms:
            for a in ANNEES:
                x = o[c][a]
                for k in ("g4", "debit", "fibre"):
                    self.assertTrue(0 <= x[k] <= 100, f"{c} {a} {k} = {x[k]}")
                    self.assertAlmostEqual(self.d["communes"][c][a]["composantes"]["Opp4"][k], x[k], 5, f"{c} {a} {k}")
                self.assertAlmostEqual(self.d["communes"][c][a]["indicateurs"]["Opp4"], (x["g4"] + x["debit"] + x["fibre"]) / 3, 9, f"{c} {a}")
        # ordre de grandeur : la 4G et le débit progressent, la fibre part de presque rien
        moy = lambda a, k: sum(o[c][a][k] for c in self.noms) / len(self.noms)
        self.assertLess(moy("2016", "fibre"), 1)
        self.assertGreater(moy("2021", "debit"), moy("2016", "debit") + 15)
        self.assertGreater(moy("2021", "g4"), moy("2016", "g4") + 15)

    def test_cho2_2021_proche_de_l_indicateur_courant_calcule_en_2023(self):
        actuel = donnees_actuelles()
        a = [self.d["communes"][c]["2021"]["indicateurs"]["Cho2"] for c in self.noms]
        b = [actuel[c]["Cho2"] for c in self.noms]
        n = len(a)
        ma, mb = sum(a) / n, sum(b) / n
        r = sum((x - ma) * (y - mb) for x, y in zip(a, b)) / math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))
        self.assertGreater(r, 0.8)                            # mesuré : 0,830 (millésimes différents : 2021 et 2023, bruit des petites communes)
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

    @exige_libs("jenkspy")
    def test_seuils_jenks_de_la_carte_d_evolution_sur_les_variations(self):
        import jenkspy
        for v in ("OppChoVec", "Opp", "Cho", "Vec"):
            var = [self.d["communes"][c][ANNEES[-1]]["scores_0_10"][v] - self.d["communes"][c][ANNEES[0]]["scores_0_10"][v] for c in self.noms]
            attendu = jenkspy.jenks_breaks(var, 5)[1:-1]
            donnes = self.d["seuils_jenks_variation"][v]
            self.assertEqual(len(donnes), 4, v)
            for x, y in zip(attendu, donnes):
                self.assertAlmostEqual(x, y, places=9, msg=v)
            self.assertTrue(min(var) < donnes[0] and donnes[-1] < max(var), v)

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


class SerieRobuste(SerieTemporelle):
    """Variante « Opp3 robuste » (serie_temporelle_robuste.json) : mêmes indicateurs, drapeau « transports en commun » levé à partir de 5 personnes. Toutes les vérifications de la série
    (structure, scores recalculés, p_k de Betti, seuils de Jenks, échelle commune) valent aussi pour elle ; le rejeu du script ne concerne que la série standard."""

    @classmethod
    def setUpClass(cls):
        cls.d = charger_json(WEB / "serie_temporelle_robuste.json")
        cls.noms = sorted(cls.d["communes"])

    def test_le_script_reproduit_le_fichier_depuis_les_sources(self):
        self.skipTest("rejeu couvert par la série standard (même script, seuil différent)")


class FiabiliteEtDrapeauTransports(unittest.TestCase):
    """Audit des écarts aberrants (RAPPORT_AUDIT_EVOLUTION) : le drapeau « transports en commun » d'Opp3 et la fiabilité des petites communes."""

    @classmethod
    def setUpClass(cls):
        cls.std = charger_json(WEB / "serie_temporelle.json")
        cls.rob = charger_json(WEB / "serie_temporelle_robuste.json")
        cls.noms = sorted(cls.std["communes"])

    def test_seuils_declares(self):
        self.assertEqual(self.std["opp3_seuil_transports"], 0)
        self.assertEqual(self.rob["opp3_seuil_transports"], 5)

    def test_drapeau_conforme_a_l_effectif_brut(self):
        for c in self.noms:
            for a in ANNEES:
                o_s = self.std["communes"][c][a]["composantes"]["Opp3"]; o_r = self.rob["communes"][c][a]["composantes"]["Opp3"]
                self.assertEqual(o_s["actifs_transports"], o_r["actifs_transports"], c)             # même donnée brute
                self.assertEqual(o_s["transport_commun"], 100.0 if o_s["actifs_transports"] > 0 else 0.0, f"{c} {a} standard")
                self.assertEqual(o_r["transport_commun"], 100.0 if o_r["actifs_transports"] >= 5 else 0.0, f"{c} {a} robuste")

    def test_la_variante_ne_change_que_opp3_et_ce_qui_en_depend(self):
        for c in self.noms:
            for a in ANNEES:
                s, r = self.std["communes"][c][a]["indicateurs"], self.rob["communes"][c][a]["indicateurs"]
                for k in s:
                    if k == "Opp3":
                        self.assertIn(round(s[k] - r[k], 6), (0.0, 100.0), f"{c} {a}")           # le drapeau standard est levé quand le robuste l'est : écart 0 ou 100
                    else:
                        self.assertEqual(s[k], r[k], f"{c} {a} {k}")

    def test_le_drapeau_robuste_change_moins_souvent(self):
        def changements(d):
            return sum(1 for c in self.noms if (d["communes"][c]["2016"]["composantes"]["Opp3"]["transport_commun"] > 0) != (d["communes"][c]["2021"]["composantes"]["Opp3"]["transport_commun"] > 0))
        self.assertEqual(changements(self.std), 78)
        self.assertEqual(changements(self.rob), 27)

    def test_les_changements_du_drapeau_standard_reposent_sur_des_effectifs_minuscules(self):
        eff = sorted(max(self.std["communes"][c]["2016"]["composantes"]["Opp3"]["actifs_transports"], self.std["communes"][c]["2021"]["composantes"]["Opp3"]["actifs_transports"])
                     for c in self.noms if (self.std["communes"][c]["2016"]["composantes"]["Opp3"]["transport_commun"] > 0) != (self.std["communes"][c]["2021"]["composantes"]["Opp3"]["transport_commun"] > 0))
        self.assertEqual(len(eff), 78)
        self.assertLess(eff[len(eff) // 2], 2)                  # médiane de l'effectif du côté « levé » : environ une personne
        self.assertLess(max(eff), 7)

    def test_le_bruit_diminue_avec_la_taille_de_la_commune(self):
        """Écart-type de la variation de l'indice par classe de population : décroissant (1,25 sous 50 habitants ; 1,16 sous 100 ; 0,90 de 100 à 999 ; 0,82 à partir de 1 000). Opp4 (progression réelle de la connectivité, commune à toutes les tailles) atténue l'écart : avant Opp4, 1,8 contre 0,6."""
        import statistics
        var = {c: self.std["communes"][c]["2021"]["scores_0_10"]["OppChoVec"] - self.std["communes"][c]["2016"]["scores_0_10"]["OppChoVec"] for c in self.noms}
        hab = {c: self.std["communes"][c]["2021"]["composantes"]["Cho2"]["population"] for c in self.noms}
        sd = lambda lo, hi: statistics.pstdev([var[c] for c in self.noms if lo <= hab[c] < hi])
        petites, moyennes, grandes = sd(0, 100), sd(100, 1000), sd(1000, 10 ** 9)
        self.assertGreater(petites, 1.2 * moyennes)
        self.assertGreater(moyennes, 1.05 * grandes)
        self.assertGreater(sum(1 for c in self.noms if hab[c] < 100), 100)                       # 121 communes de moins de 100 habitants

    def test_populations_de_la_serie_egales_aux_populations_municipales(self):
        import json
        agreg = charger_json(WEB / "epci_agregation.json")
        pop2021 = {n: c["pop_annee"]["2021"] for e in agreg["epci"] for n, c in e["communes"].items()}         # population municipale 2021 (séries historiques INSEE)
        for c in self.noms:
            self.assertAlmostEqual(self.std["communes"][c]["2021"]["composantes"]["Cho2"]["population"], pop2021[c], delta=0.51, msg=c)


class Vec4Comparable(unittest.TestCase):
    """Vec4 comparable (BPE 2016 et 2024, mêmes types d'équipements, même réseau routier) : Données/vec4_serie_temporelle.json, produit par calculer_vec4_serie.py (serveur OSRM)."""

    @classmethod
    def setUpClass(cls):
        from common import RACINE, donnees_actuelles
        cls.v = charger_json(RACINE / "stage_ambroise" / "Données" / "vec4_serie_temporelle.json")
        cls.actuel = donnees_actuelles()

    def test_structure(self):
        self.assertEqual(sorted(self.v["communes"]), sorted(self.actuel))
        self.assertEqual(self.v["annees"], [2016, 2024])
        for c, d in self.v["communes"].items():
            self.assertGreaterEqual(d["2016"], 0, c)
            self.assertGreaterEqual(d["2024"], 0, c)
            self.assertEqual(int(d["2016"]), d["2016"])

    def test_2024_restreint_ressemble_au_vec4_actuel(self):
        a = [self.v["communes"][c]["2024"] for c in sorted(self.actuel)]
        b = [self.actuel[c]["Vec4"] for c in sorted(self.actuel)]
        n = len(a)
        ma, mb = sum(a) / n, sum(b) / n
        r = sum((x - ma) * (y - mb) for x, y in zip(a, b)) / math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))
        self.assertGreater(r, 0.99)                           # mesuré : 0,995 (105 types sur 212)
        # une commune ne peut pas avoir plus de services (types restreints) que le Vec4 actuel (tous types)
        for c in self.actuel:
            self.assertLessEqual(self.v["communes"][c]["2024"], self.actuel[c]["Vec4"], c)

    def test_types_et_effectifs_documentes(self):
        self.assertEqual(self.v["types_communs"], 105)
        self.assertEqual(self.v["equipements"], {"2016": 9611, "2024": 9409})


if __name__ == "__main__":
    unittest.main()
