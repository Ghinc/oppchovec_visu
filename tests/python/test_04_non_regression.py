"""4. Non-régression, en deux étapes de l'histoire des données (références figées dans tests/fixtures/) :

  état 4438162 (« baseline »)  --correction des poids de Vec3-->  état 9c8a310 (« avant_opp1 »)  --Opp1 communal INSEE-->  état actuel

* Vec3 : ce que la correction (chômeur 0,25 -> 0 ; emploi aidé 0 -> 0,25) a changé, et RIEN d'autre (empreinte mesurée le 2026-10-11).
* Opp1 : ce que le remplacement du compteur artificiel par le niveau de diplôme INSEE a changé (Opp1 et ce qui en dépend), et RIEN
  d'autre (empreinte mesurée le 2026-10-13).
"""
import unittest

from common import (RACINE, ALIAS_NOMS_ANCIENS, CHAMPS_SCORES, FIXTURES, INDICATEURS, PYDIR, WEB, charger_const_js, charger_json,
                    donnees_actuelles, exige_libs, indice_brut, pk_betti, recalcul_complet, spearman, vers_0_10)

CHAMPS_DEPENDANT_DE_VEC3 = {"Vec3", "Score_Vec", "Score_Vec_0_10", "OppChoVec", "OppChoVec_0_10"}
ANCIENS_POIDS = {"stable": 1, "cdd": 0.75, "ponctuel": 0.5, "chomeur": 0.25, "aide": 0}
NOUVEAUX_POIDS = {"stable": 1, "cdd": 0.75, "ponctuel": 0.5, "chomeur": 0, "aide": 0.25}


def renommer(d):
    return {ALIAS_NOMS_ANCIENS.get(k, k): v for k, v in d.items()}


def indice(d, mode):
    s01 = {c: {"Opp": v["Score_Opp"], "Cho": v["Score_Cho"], "Vec": v["Score_Vec"]} for c, v in d.items()}
    return vers_0_10(indice_brut(s01, pk_betti(s01) if mode == "betti" else (1, 1, 1)))


class ReferenceAvantCorrection(unittest.TestCase):
    """La référence elle-même doit être fiable : cohérente avec les archives et avec la formule."""

    @classmethod
    def setUpClass(cls):
        cls.base = renommer(charger_json(FIXTURES / "baseline_data_scores_0_10.json"))

    def test_identique_aux_archives_du_depot(self):
        archives = ["stage_ambroise/Code/Python/data_scores_0_10.json",
                    "stage_ambroise/Code/WEB/data_scores_0_10_backup_20251112_204530.json"]
        for chemin in archives:
            with self.subTest(archive=chemin):
                autre = renommer(charger_json(FIXTURES.parents[1] / chemin))
                self.assertEqual(autre, self.base)

    def test_la_formule_reproduit_les_resultats_d_origine(self):
        """Les résultats d'avant la session (produits par le pipeline Python d'origine) sont retrouvés à 1e-9 près."""
        indicateurs = {c: {k: d[k] for k in INDICATEURS} for c, d in self.base.items()}
        recalcul = recalcul_complet(indicateurs)
        for c, d in self.base.items():
            for k in CHAMPS_SCORES:
                self.assertAlmostEqual(d[k], recalcul[c][k], places=9, msg=f"{c}.{k}")


class EmpreinteDeLaCorrectionVec3(unittest.TestCase):
    """baseline (avant Vec3) contre l'état figé juste après la correction de Vec3 (et avant le changement d'Opp1)."""

    @classmethod
    def setUpClass(cls):
        cls.base = renommer(charger_json(FIXTURES / "baseline_data_scores_0_10.json"))
        cls.cur = charger_json(FIXTURES / "avant_opp1_data_scores_0_10.json")
        cls.sc = charger_json(WEB / "sous_composantes.json")

    def test_seuls_les_champs_dependant_de_vec3_ont_change(self):
        changes = set()
        for c in self.cur:
            for k, v in self.cur[c].items():
                if v != self.base[c][k]:
                    changes.add(k)
        self.assertEqual(changes, CHAMPS_DEPENDANT_DE_VEC3)

    def test_les_champs_non_concernes_sont_identiques_au_bit_pres(self):
        inchanges = [k for k in self.cur["Bastia"] if k not in CHAMPS_DEPENDANT_DE_VEC3]
        for c in self.cur:
            for k in inchanges:
                self.assertEqual(self.cur[c][k], self.base[c][k], f"{c}.{k}")

    def test_le_changement_de_vec3_vient_uniquement_de_l_echange_des_poids(self):
        """Vec3_nouveau - Vec3_ancien = (0 - 0,25) * chômeurs/total + (0,25 - 0) * aidés/total = 0,25 * (aidés - chômeurs) / total."""
        for c, d in self.cur.items():
            p = self.sc[c]["Vec3"]
            total = sum(p.values())
            self.assertAlmostEqual(d["Vec3"] - self.base[c]["Vec3"], 0.25 * (p["aide"] - p["chomeur"]) / total, places=12, msg=c)

    def test_anciens_poids_sur_sous_composantes_redonnent_exactement_la_reference(self):
        def vec3(p, poids):
            return sum(p[k] * w for k, w in poids.items()) / sum(p.values())
        for c, d in self.cur.items():
            self.assertAlmostEqual(vec3(self.sc[c]["Vec3"], ANCIENS_POIDS), self.base[c]["Vec3"], places=12, msg=c)
            self.assertAlmostEqual(vec3(self.sc[c]["Vec3"], NOUVEAUX_POIDS), d["Vec3"], places=12, msg=c)

    def test_classement_stable_quel_que_soit_le_mode_p_k(self):
        communes = sorted(self.cur)
        for mode in ("egal", "betti"):
            a, b = indice(self.base, mode), indice(self.cur, mode)
            with self.subTest(mode=mode):
                self.assertGreater(spearman([a[c] for c in communes], [b[c] for c in communes]), 0.999)
                ecarts = [abs(a[c] - b[c]) for c in communes]
                self.assertLess(sum(ecarts) / len(ecarts), 0.02)   # mesuré : 0,016 / 0,018
                self.assertLess(max(ecarts), 0.25)                  # mesuré : 0,21 (Azzana)
                top = lambda x: set(sorted(communes, key=lambda c: -x[c])[:10])
                self.assertLessEqual(len(top(a) - top(b)), 1)       # mesuré : 0 (égal) / 1 (Betti)

    def test_p_k_betti_quasi_inchanges(self):
        s = lambda d: {c: {"Opp": v["Score_Opp"], "Cho": v["Score_Cho"], "Vec": v["Score_Vec"]} for c, v in d.items()}
        for a, b in zip(pk_betti(s(self.base)), pk_betti(s(self.cur))):
            self.assertAlmostEqual(a, b, delta=1e-3)   # mesuré : 5,6e-4 au maximum (Cho)

    def test_le_score_vec_change_dans_la_limite_attendue(self):
        communes = sorted(self.cur)
        a = [self.base[c]["Score_Vec_0_10"] for c in communes]
        b = [self.cur[c]["Score_Vec_0_10"] for c in communes]
        self.assertGreater(spearman(a, b), 0.997)                   # mesuré : 0,998
        self.assertLess(max(abs(x - y) for x, y in zip(a, b)), 0.5)  # mesuré : 0,44


class EmpreinteSurLesFichiersDerives(unittest.TestCase):
    """Fichiers dérivés : baseline contre l'état figé après Vec3 (avant Opp1)."""

    @classmethod
    def setUpClass(cls):
        cls.der = charger_json(FIXTURES / "baseline_derives.json")
        cls.nv = charger_json(FIXTURES / "avant_opp1_derives.json")
        cls.noms = sorted(donnees_actuelles())

    def test_seuils_jenks_opp_et_cho_inchanges(self):
        for var in ("Score_Opp_0_10", "Score_Cho_0_10"):
            self.assertEqual(self.nv["jenks_gvf"][var], self.der["jenks_gvf"][var], var)

    def test_seuils_jenks_oppchovec_et_vec_deplaces_dans_la_limite_attendue(self):
        bornes = {"OppChoVec_0_10": 0.06, "Score_Vec_0_10": 0.7}   # mesuré : 0,047 et 0,658
        for var, tol in bornes.items():
            for a, b in zip(self.der["jenks_gvf"][var], self.nv["jenks_gvf"][var]):
                self.assertAlmostEqual(a, b, delta=tol, msg=var)

    def test_lisa_peu_de_communes_changent_de_cluster(self):
        """Mesuré : égal 0 et 0 ; Betti 5 % : 2 ; Betti 1 % : 1."""
        plafonds = {"egal_5": 0, "egal_1": 0, "betti_5": 3, "betti_1": 2}
        fichiers = {"egal_5": ("lisa_data.js", "LISA_DATA"), "egal_1": ("lisa_data_1pct.js", "LISA_DATA_1PCT"),
                    "betti_5": ("lisa_data_betti.js", "LISA_DATA_BETTI"), "betti_1": ("lisa_data_betti_1pct.js", "LISA_DATA_BETTI_1PCT")}
        for cle, (f, nom) in fichiers.items():
            nouveau = self.nv["lisa"][cle]
            ancien = renommer(self.der["lisa"][cle]["clusters"])
            changes = [c for c in self.noms if ancien[c] != nouveau["clusters"][c]]
            with self.subTest(fichier=cle):
                self.assertLessEqual(len(changes), plafonds[cle], f"communes dont le cluster LISA a changé : {changes}")
                self.assertAlmostEqual(self.der["lisa"][cle]["moran_I"], nouveau["moran_I"], delta=1e-3)

    @exige_libs("sklearn")
    def test_cah_les_groupes_extremes_ne_se_scindent_pas(self):
        """La CAH à 5 classes est recoupée (ARI mesuré 0,43) mais ses groupes atypiques restent entiers."""
        from sklearn.metrics import adjusted_rand_score
        for n, plancher_ari in ((3, 0.85), (5, 0.40)):    # mesuré : 0,888 et 0,431
            ancien = renommer(self.der["cah"][str(n)])
            nouveau = self.nv["cah"][str(n)]
            ari = adjusted_rand_score([ancien[c] for c in self.noms], [nouveau[c] for c in self.noms])
            self.assertGreater(ari, plancher_ari, f"CAH {n}")
        ancien5 = renommer(self.der["cah"]["5"])
        nouveau5 = self.nv["cah"]["5"]
        for groupe_ancien in (1, 3, 4):      # petit groupe de tête, groupe « Cho faible », groupe « Opp faible »
            membres = [c for c in self.noms if ancien5[c] == groupe_ancien]
            self.assertEqual(len({nouveau5[c] for c in membres}), 1, f"l'ancien groupe {groupe_ancien} s'est scindé")
        ancien3 = renommer(self.der["cah"]["3"])
        nouveau3 = self.nv["cah"]["3"]
        membres = [c for c in self.noms if ancien3[c] == 2]
        self.assertEqual(len({nouveau3[c] for c in membres}), 1, "le groupe « Cho faible » à 3 classes s'est scindé")


# ------------------------------------------------------------------------------------------------------------
CHAMPS_DEPENDANT_DE_OPP1 = {"Opp1", "Score_Opp", "Score_Opp_0_10", "OppChoVec", "OppChoVec_0_10"}


class EmpreinteDuRemplacementDOpp1(unittest.TestCase):
    """État figé avant Opp1 (commit 9c8a310) contre l'état actuel. Bornes mesurées le 2026-10-13, avec marge."""

    @classmethod
    def setUpClass(cls):
        cls.avant = charger_json(FIXTURES / "avant_opp1_data_scores_0_10.json")
        cls.cur = donnees_actuelles()
        cls.noms = sorted(cls.cur)
        cls.der = charger_json(FIXTURES / "avant_opp1_derives.json")
        cls.edu = charger_json(RACINE / "stage_ambroise" / "Données" / "education_communes_opp1.json")["communes"]

    def test_seuls_les_champs_dependant_d_opp1_ont_change(self):
        changes = {k for c in self.cur for k, v in self.cur[c].items() if v != self.avant[c][k]}
        self.assertEqual(changes, CHAMPS_DEPENDANT_DE_OPP1)

    def test_les_champs_non_concernes_sont_identiques_au_bit_pres(self):
        for c in self.cur:
            for k in self.cur[c]:
                if k not in CHAMPS_DEPENDANT_DE_OPP1:
                    self.assertEqual(self.cur[c][k], self.avant[c][k], f"{c}.{k}")

    def test_opp1_est_le_niveau_de_diplome_insee(self):
        for c in self.cur:
            self.assertEqual(self.cur[c]["Opp1"], self.edu[c]["niveau_moyen"], c)
        valeurs = [d["Opp1"] for d in self.cur.values()]
        self.assertGreaterEqual(min(valeurs), 1)           # échelle 1 à 7
        self.assertLessEqual(max(valeurs), 7)
        self.assertAlmostEqual(min(valeurs), 2.0, places=6)      # mesuré : 2,000 (Popolasca)
        self.assertAlmostEqual(max(valeurs), 4.5696, places=3)   # mesuré : 4,570 (Pigna)

    def test_le_classement_global_change_mais_reste_correle(self):
        for mode, plancher in (("egal", 0.90), ("betti", 0.80)):    # mesuré : 0,927 et 0,840
            a, b = indice(self.avant, mode), indice(self.cur, mode)
            with self.subTest(mode=mode):
                self.assertGreater(spearman([a[c] for c in self.noms], [b[c] for c in self.noms]), plancher)
                self.assertLess(max(abs(a[c] - b[c]) for c in self.noms), 3.5)   # mesuré : 1,85 (égal) / 3,09 (Betti)

    def test_score_opp_et_p_k_deplaces_dans_la_limite_attendue(self):
        a = [self.avant[c]["Score_Opp_0_10"] for c in self.noms]
        b = [self.cur[c]["Score_Opp_0_10"] for c in self.noms]
        self.assertGreater(spearman(a, b), 0.7)                          # mesuré : 0,759
        self.assertLess(max(abs(x - y) for x, y in zip(a, b)), 4.5)     # mesuré : 4,06
        s = lambda d: {c: {"Opp": v["Score_Opp"], "Cho": v["Score_Cho"], "Vec": v["Score_Vec"]} for c, v in d.items()}
        for x, y in zip(pk_betti(s(self.avant)), pk_betti(s(self.cur))):
            self.assertAlmostEqual(x, y, delta=0.1)                      # mesuré : 0,076 au maximum (Opp)

    def test_seuils_jenks_cho_et_vec_inchanges_opp_et_oppchovec_deplaces(self):
        n = charger_json(WEB / "seuils_jenks_optimal_gvf.json")
        for var in ("Score_Cho_0_10", "Score_Vec_0_10"):
            self.assertEqual(n[var]["breaks"], self.der["jenks_gvf"][var], var)
        for var, tol in (("OppChoVec_0_10", 0.35), ("Score_Opp_0_10", 0.6)):    # mesuré : 0,24 et 0,50
            for a, b in zip(self.der["jenks_gvf"][var], n[var]["breaks"]):
                self.assertAlmostEqual(a, b, delta=tol, msg=var)

    def test_lisa_recalcule_et_toujours_proche(self):
        fichiers = {"egal_5": ("lisa_data.js", "LISA_DATA", 30), "egal_1": ("lisa_data_1pct.js", "LISA_DATA_1PCT", 10),
                    "betti_5": ("lisa_data_betti.js", "LISA_DATA_BETTI", 40), "betti_1": ("lisa_data_betti_1pct.js", "LISA_DATA_BETTI_1PCT", 25)}
        for cle, (f, nom, plafond) in fichiers.items():       # mesuré : 20, 5, 30, 15 communes dont le cluster change
            nouveau = charger_const_js(WEB / f, nom)
            changes = [c for c in self.noms if self.der["lisa"][cle]["clusters"][c] != nouveau["clusters"][c]["cluster"]]
            with self.subTest(fichier=cle):
                self.assertLessEqual(len(changes), plafond)
                self.assertAlmostEqual(self.der["lisa"][cle]["moran_I"], nouveau["metadata"]["moran_global_I"], delta=0.02)   # mesuré : 0,009

    @exige_libs("sklearn")
    def test_cah_recalculee_et_toujours_correlee(self):
        from sklearn.metrics import adjusted_rand_score
        for n, plancher in ((3, 0.4), (5, 0.2)):              # mesuré : ARI 0,489 et 0,285
            ancien = self.der["cah"][str(n)]
            nouveau = {c: v["cluster"] for c, v in charger_json(WEB / f"cah_{n}_clusters.json")["clusters"].items()}
            self.assertGreater(adjusted_rand_score([ancien[c] for c in self.noms], [nouveau[c] for c in self.noms]), plancher, f"CAH {n}")


if __name__ == "__main__":
    unittest.main()
