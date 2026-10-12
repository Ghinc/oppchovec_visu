"""2. Formules : recalcul indépendant de tout le JSON depuis les 10 indicateurs, p_k Betti, propriétés, oppchovec.py."""
import math
import random
import re
import sys
import unittest

from common import (ALPHA, BETA, CHAMPS_SCORES, DIMENSIONS, INDICATEURS, PYDIR, WEB, bornes_indicateurs,
                    charger_const_js, donnees_actuelles, exige_libs, indice_brut, pk_betti, recalcul_complet,
                    scores_01)


def indicateurs_de(data):
    return {c: {k: d[k] for k in INDICATEURS} for c, d in data.items()}


class RecalculIndependant(unittest.TestCase):
    """Recalcule les 8 champs de scores avec une implémentation écrite ici, sans réutiliser le code de l'appli."""

    @classmethod
    def setUpClass(cls):
        cls.data = donnees_actuelles()
        cls.recalcul = recalcul_complet(indicateurs_de(cls.data))

    def test_les_8_champs_de_scores_sont_reproduits(self):
        pire = {k: 0.0 for k in CHAMPS_SCORES}
        for c, d in self.data.items():
            for k in CHAMPS_SCORES:
                pire[k] = max(pire[k], abs(d[k] - self.recalcul[c][k]))
        for k, ecart in pire.items():
            self.assertLess(ecart, 1e-9, f"{k}: écart max {ecart:.2e}")

    def test_nombre_d_indicateurs_par_dimension(self):
        """Python/README.md : Opp 4 indicateurs (25 % chacun), Cho 2 (50 %), Vec 4 (25 %)."""
        self.assertEqual({k: len(v) for k, v in DIMENSIONS.items()}, {"Opp": 4, "Cho": 2, "Vec": 4})

    def test_valeurs_remarquables(self):
        """Valeurs que l'on peut vérifier à la main sur la formule (1/3)(Σ p_k D_k^β)^(α/β), p_k = 1."""
        f = lambda *d: (1 / 3) * sum(x ** BETA for x in d) ** (ALPHA / BETA)
        self.assertAlmostEqual(f(0, 0, 0), 0.0)
        self.assertAlmostEqual(f(1, 0, 0), 1 / 3)
        self.assertAlmostEqual(f(1, 1, 1), 3 ** (2 / 3))
        self.assertAlmostEqual(f(1, 1, 0), (1 / 3) * 2 ** (ALPHA / BETA))


class ProprietesDeLIndice(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = donnees_actuelles()
        cls.ind = indicateurs_de(cls.data)
        cls.bornes = bornes_indicateurs(cls.ind)
        cls.base = indice_brut(scores_01(cls.ind, cls.bornes))

    def test_monotonie_chaque_indicateur_va_dans_le_sens_du_bien_etre(self):
        """Améliorer n'importe quel indicateur (+10 % de son amplitude) doit augmenter l'indice de la commune."""
        rng = random.Random(2026)
        communes = rng.sample(sorted(self.ind), 40)
        for c in communes:
            for k in INDICATEURS:
                lo, hi = self.bornes[k]
                modif = {cc: dict(v) for cc, v in self.ind.items() if cc == c}
                modif[c][k] = min(hi, self.ind[c][k] + 0.1 * (hi - lo))
                if modif[c][k] == self.ind[c][k]:
                    continue  # déjà au maximum
                nouveau = indice_brut(scores_01(modif, self.bornes))[c]
                self.assertGreater(nouveau, self.base[c], f"{c}.{k}")

    def test_modifier_une_commune_ne_change_pas_les_autres_avec_bornes_figees(self):
        c = "Bastia"
        modif = {c: dict(self.ind[c])}
        modif[c]["Vec4"] = self.bornes["Vec4"][1]
        autres = {cc: v for cc, v in self.ind.items() if cc != c}
        modif.update(autres)
        nouveau = indice_brut(scores_01(modif, self.bornes))
        for cc in autres:
            self.assertEqual(nouveau[cc], self.base[cc])


class PkBetti(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = donnees_actuelles()
        cls.s01 = {c: {"Opp": d["Score_Opp"], "Cho": d["Score_Cho"], "Vec": d["Score_Vec"]} for c, d in cls.data.items()}
        cls.pk = pk_betti(cls.s01)

    def test_somme_a_un_et_positifs(self):
        self.assertAlmostEqual(sum(self.pk), 1.0, places=12)
        self.assertTrue(all(0 < p < 1 for p in self.pk))

    def test_invariance_d_echelle(self):
        """Raison d'être du calcul sur les scores 0-1 : le p_k ne dépend pas de l'échelle (0-1 ou 0-10)."""
        x10 = {c: {k: v * 10 for k, v in s.items()} for c, s in self.s01.items()}
        for a, b in zip(self.pk, pk_betti(x10)):
            self.assertAlmostEqual(a, b, places=12)

    def test_identique_aux_poids_enregistres_dans_les_fichiers_lisa(self):
        for fichier, nom in (("lisa_data_betti.js", "LISA_DATA_BETTI"), ("lisa_data_betti_1pct.js", "LISA_DATA_BETTI_1PCT")):
            poids = charger_const_js(WEB / fichier, nom)["metadata"]["poids"]
            for dim, p in zip(("Opp", "Cho", "Vec"), self.pk):
                self.assertAlmostEqual(poids[dim], round(p, 4), places=4, msg=f"{fichier} {dim}")


@exige_libs("pandas", "numpy")
class FonctionsDeOppchovecPy(unittest.TestCase):
    """Fonctions de Code/Python/oppchovec.py (le script documenté dans Python/README.md)."""

    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(PYDIR))
        import oppchovec
        cls.m = oppchovec

    def test_constantes(self):
        self.assertEqual((self.m.ALPHA, self.m.BETA), (ALPHA, BETA))
        self.assertEqual(self.m.PONDERATIONS["Opp"], {f"Opp{i}": 0.25 for i in range(1, 5)})
        self.assertEqual(self.m.PONDERATIONS["Cho"], {"Cho1": 0.5, "Cho2": 0.5})
        self.assertEqual(self.m.PONDERATIONS["Vec"], {f"Vec{i}": 0.25 for i in range(1, 5)})
        self.assertEqual(list(self.m.POND_FINALE), [1, 1, 1])

    def test_calc_oppchovec_valeurs_remarquables(self):
        import numpy as np
        pk = np.array([1, 1, 1])
        self.assertAlmostEqual(self.m.calc_oppchovec(np.array([1.0, 1.0, 1.0]), pk), 3 ** (2 / 3))
        self.assertAlmostEqual(self.m.calc_oppchovec(np.array([0.0, 0.0, 0.0]), pk), 0.0)

    def test_normaliser(self):
        self.assertEqual(self.m.normaliser(5, 0, 10), 0.5)
        self.assertEqual(self.m.normaliser(3, 3, 3), 0, "colonne constante : 0, pas de division par zéro")

    def test_indicateurs_elementaires(self):
        m = self.m
        self.assertEqual(m.calc_opp3(80.0, 0, "Gavignano"), 80.0)
        self.assertEqual(m.calc_opp3(80.0, 100, "Gavignano"), 180.0, "+100 si transports en commun")
        self.assertEqual(m.calc_opp3(80.0, 100, "Bastia"), 280.0, "+100 si réseau de bus urbain")
        self.assertEqual(m.calc_cho1(0), 0)
        self.assertAlmostEqual(m.calc_cho1(1000), -math.log(1000))
        self.assertAlmostEqual(m.calc_vec2(0.5, 1.0, 1.0, 0.9), (math.exp(-0.5) + 1.0 + 0.9) / 3)
        self.assertAlmostEqual(m.calc_opp4(90, 70), 80)

    def test_poids_vec3_suivent_le_rang_inscrit_dans_les_libelles(self):
        """Chaque colonne s'appelle « ... (n) » avec n = rang de stabilité (1 chômeur ... 5 CDI) : poids = (n-1)/4."""
        colonnes = self.m.COLONNES["Vec3"]
        self.assertEqual(len(colonnes), len(self.m.POND_VEC3))
        for col, poids in zip(colonnes, self.m.POND_VEC3):
            n = int(re.search(r"\((\d)\)", col).group(1))
            self.assertAlmostEqual(poids, (n - 1) / 4, msg=f"{col} : poids {poids}")

    def test_calc_vec3_cas_limites(self):
        parts = lambda i: [100.0 if j == i else 0.0 for j in range(5)]
        poids = self.m.POND_VEC3
        self.assertEqual(self.m.calc_vec3(parts(0), poids), 1.0)    # 100 % emploi stable
        self.assertEqual(self.m.calc_vec3(parts(3), poids), 0.0)    # 100 % chômeurs
        self.assertEqual(self.m.calc_vec3(parts(4), poids), 0.25)   # 100 % emploi aidé
        self.assertEqual(self.m.calc_vec3([0, 0, 0, 0, 0], poids), 0)


if __name__ == "__main__":
    unittest.main()
