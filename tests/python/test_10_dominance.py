"""10. Onglet Dominance : couches de non-dominance recalculées en Python (stdlib), cohérence avec le score OppChoVec.

Le calcul de l'appli est dans WEB/dominance.js (testé en JavaScript dans tests/js/dominance.test.js). Ici : une seconde
implémentation indépendante (en Python, par récurrence sur les dominants) appliquée aux données, et le contrôle « si A domine B,
alors score(A) >= score(B) » avec les pondérations égales et celles de Betti.
"""
import json
import shutil
import subprocess
import unittest

from common import RACINE, WEB, donnees_actuelles, pk_betti, indice_brut

NODE = shutil.which("node")
DIMS = ("Score_Opp_0_10", "Score_Cho_0_10", "Score_Vec_0_10")


def domine(a, b):
    return all(x >= y for x, y in zip(a, b)) and any(x > y for x, y in zip(a, b))


def calcul_python(data):
    v = {c: tuple(d[k] for k in DIMS) for c, d in data.items()}
    dominants = {c: [o for o in v if domine(v[o], v[c])] for c in v}
    couche = {}
    for c in sorted(v, key=lambda c: -sum(v[c])):       # un dominant a une somme strictement plus grande : déjà traité
        couche[c] = 1 + max((couche[o] for o in dominants[c]), default=0)
    return v, dominants, couche


class TestDominance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = donnees_actuelles()
        cls.v, cls.dominants, cls.couche = calcul_python(cls.data)

    def test_dimensions_completes(self):
        self.assertEqual(len(self.v), 360)
        self.assertTrue(all(isinstance(x, (int, float)) and x == x for t in self.v.values() for x in t))

    def test_aucune_commune_ne_domine_une_couche_inferieure(self):
        for c, doms in self.dominants.items():
            for o in doms:
                self.assertLess(self.couche[o], self.couche[c], f"{o} domine {c}")
            if self.couche[c] == 1:
                self.assertEqual(doms, [], c)
            else:
                self.assertTrue(any(self.couche[o] == self.couche[c] - 1 for o in doms), c)

    def test_coherence_avec_oppchovec_fichier(self):
        exceptions = []
        for c, doms in self.dominants.items():
            for o in doms:
                for champ in ("OppChoVec", "OppChoVec_0_10"):
                    if not self.data[o][champ] >= self.data[c][champ]:
                        exceptions.append((o, c, champ, self.data[o][champ], self.data[c][champ]))
        self.assertEqual(exceptions, [], "exceptions : A domine B mais score(A) < score(B)")

    def test_coherence_avec_oppchovec_recalcule_egal_et_betti(self):
        # La dominance ne dépend pas des pondérations : le score recalculé avec p_k égaux ou p_k de Betti doit la respecter.
        s01 = {c: {"Opp": d["Score_Opp"], "Cho": d["Score_Cho"], "Vec": d["Score_Vec"]} for c, d in self.data.items()}
        for nom, pk in (("égal", (1, 1, 1)), ("Betti", pk_betti(s01))):
            idx = indice_brut(s01, pk)
            for c, doms in self.dominants.items():
                for o in doms:
                    self.assertGreaterEqual(idx[o], idx[c], f"p_k {nom} : {o} domine {c}")

    @unittest.skipUnless(NODE, "node introuvable")
    def test_meme_resultat_que_dominance_js(self):
        script = (
            "const {calculerDominance}=require(process.argv[1]);"
            "const d=JSON.parse(require('fs').readFileSync(process.argv[2],'utf8'));"
            "const s=Object.fromEntries(Object.entries(d).map(([c,v])=>[c,{Score_Opp:v.Score_Opp_0_10,Score_Cho:v.Score_Cho_0_10,Score_Vec:v.Score_Vec_0_10}]));"
            "const r=calculerDominance(s);console.log(JSON.stringify({c:r.couches,d:r.dominants}));"
        )
        r = subprocess.run([NODE, "-e", script, str(WEB / "dominance.js"), str(WEB / "data_scores_0_10.json")],
                           capture_output=True, text=True, encoding="utf-8", cwd=RACINE)
        self.assertEqual(r.returncode, 0, r.stderr)
        js = json.loads(r.stdout)
        self.assertEqual(js["c"], self.couche)
        self.assertEqual({c: sorted(v) for c, v in js["d"].items()}, {c: sorted(v) for c, v in self.dominants.items()})


if __name__ == "__main__":
    unittest.main()
