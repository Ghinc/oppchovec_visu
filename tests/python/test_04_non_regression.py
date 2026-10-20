"""4. Non-régression : passage de l'indice courant v1 (millésimes 2020-2024) à l'indice v2 (sources officielles 2023-2025).

Référence figée : tests/fixtures/v1_data_scores_0_10.json, copie de data_scores_0_10.json à l'étiquette Git `indice-courant-v1-2020-2024`
(avant le remplacement des sources, le 2026-10-19). Ces tests documentent ce que le remplacement a changé, et ce qu'il n'a PAS changé.

Les anciennes étapes de l'histoire (correction des poids de Vec3, Opp1 communal INSEE) sont conservées dans la référence « baseline » (tests/fixtures/baseline_data_scores_0_10.json).
"""
import unittest

from common import (ALIAS_NOMS_ANCIENS, CHAMPS_SCORES, FIXTURES, INDICATEURS, charger_json, donnees_actuelles, recalcul_complet, spearman)


def renommer(d):
    return {ALIAS_NOMS_ANCIENS.get(k, k): v for k, v in d.items()}


class ReferenceV1(unittest.TestCase):
    """La référence v1 elle-même doit être fiable : cohérente avec la formule de l'indice."""

    @classmethod
    def setUpClass(cls):
        cls.v1 = charger_json(FIXTURES / "v1_data_scores_0_10.json")

    def test_la_formule_reproduit_les_resultats_de_la_v1(self):
        indicateurs = {c: {k: d[k] for k in INDICATEURS} for c, d in self.v1.items()}
        recalcul = recalcul_complet(indicateurs)
        for c, d in self.v1.items():
            for k in CHAMPS_SCORES:
                self.assertAlmostEqual(d[k], recalcul[c][k], places=9, msg=f"{c}.{k}")

    def test_la_baseline_historique_est_toujours_lisible(self):
        base = renommer(charger_json(FIXTURES / "baseline_data_scores_0_10.json"))
        self.assertEqual(len(base), 360)


class PassageALaV2(unittest.TestCase):
    """Ce que le remplacement des sources a changé, et ce qu'il a laissé intact."""

    @classmethod
    def setUpClass(cls):
        cls.v1 = charger_json(FIXTURES / "v1_data_scores_0_10.json")
        cls.v2 = donnees_actuelles()

    def test_memes_communes_memes_champs(self):
        self.assertEqual(set(self.v1), set(self.v2))
        self.assertEqual(set(next(iter(self.v1.values()))), set(next(iter(self.v2.values()))))

    def test_vec4_est_inchange_au_bit_pres(self):
        """Vec4 vient de la BPE 2024 dans les deux versions : le remplacement ne doit pas l'avoir touché."""
        for c in self.v1:
            self.assertEqual(self.v1[c]["Vec4"], self.v2[c]["Vec4"], c)

    def test_cho1_memes_communes_concernees_et_valeurs_plus_basses(self):
        """Mêmes trois communes en quartier prioritaire ; la population officielle est plus élevée que celle de la v1 (62 à 69 % de l'officielle), donc −log plus bas."""
        avec1 = {c for c, d in self.v1.items() if d["Cho1"] != 0}
        avec2 = {c for c, d in self.v2.items() if d["Cho1"] != 0}
        self.assertEqual(avec1, avec2)
        self.assertEqual(avec2, {"Ajaccio", "Bastia", "Porto-Vecchio"})
        for c in avec2:
            self.assertLess(self.v2[c]["Cho1"], self.v1[c]["Cho1"], c)

    def test_correlations_de_rang_entre_la_v1_et_la_v2(self):
        """Corrélations de rang mesurées le 2026-10-19 (bornes basses avec marge) : même méthode et millésime plus récent pour Opp1, Opp2, Opp3, Cho2, Vec2, Vec3 ;
        sources changées pour Opp4 (4G et fibre recalculées) et Vec1 (médiane remplacée par le revenu fiscal moyen)."""
        bornes = {"Opp1": 0.7, "Opp2": 0.75, "Opp3": 0.7, "Cho1": 0.999, "Cho2": 0.9, "Vec2": 0.9, "Vec3": 0.55, "Vec4": 0.999, "Opp4": 0.25, "Vec1": 0.25}
        for k, mini in bornes.items():
            with self.subTest(indicateur=k):
                r = spearman([self.v1[c][k] for c in self.v1], [self.v2[c][k] for c in self.v1])
                self.assertGreater(r, mini, f"{k} : corrélation de rang {r:.3f}")

    def test_l_indice_global_reste_correle_mais_change(self):
        r = spearman([self.v1[c]["OppChoVec_0_10"] for c in self.v1], [self.v2[c]["OppChoVec_0_10"] for c in self.v1])
        self.assertGreater(r, 0.6, f"corrélation de rang de l'indice : {r:.3f}")
        self.assertLess(r, 0.95, "l'indice aurait dû changer avec le remplacement des sources")

    def test_les_dimensions_cho_et_vec_gardent_leur_classement(self):
        for dim, mini in (("Score_Cho_0_10", 0.9), ("Score_Vec_0_10", 0.65)):
            r = spearman([self.v1[c][dim] for c in self.v1], [self.v2[c][dim] for c in self.v1])
            self.assertGreater(r, mini, f"{dim} : {r:.3f}")


if __name__ == "__main__":
    unittest.main()
