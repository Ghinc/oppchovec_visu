"""8. L'appli (JavaScript) contre un recalcul indépendant en Python : état de base et scénarios de modification aléatoires.

Un pilote Node (tests/js/dump_app.js) exécute le vrai script.js ; ici on recalcule le résultat attendu avec common.py (stdlib)
et jenkspy, à partir des seules données et des bornes figées sur les données d'origine.
"""
import json
import math
import random
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from common import (INDICATEURS, RACINE, WEB, bornes_indicateurs, charger_json, classe_jenks, donnees_actuelles, exige_libs,
                    indice_brut, pk_betti, scores_01, vers_0_10)

NODE = shutil.which("node")
GRAINE = 20261011
NB_SCENARIOS = 30
DECOMPOSES = ("Opp3", "Opp4", "Cho1", "Vec2", "Vec3")
BINAIRES = {("Opp3", "tc"): 100, ("Opp3", "bus"): 1}          # valeur de la composante quand la case est cochée
ENTIERS = {("Cho1", "personnes_qpv")}
PARTS = ("Vec3",)


def formule(ind, s):
    if ind == "Opp3":
        return s["voiture"] + (100 if s["tc"] > 0 else 0) + (100 if s["bus"] else 0)
    if ind == "Opp4":
        return (s["g4"] + s["debit"] + s["fibre"]) / 3
    if ind == "Cho1":
        return -math.log(s["personnes_qpv"]) if s["personnes_qpv"] > 0 else 0
    if ind == "Vec2":
        return (math.exp(-s["pers_piece"]) + (s["sdb"] + s["chauffage"]) / 2 + s["maisons"]) / 3
    poids = {"stable": 1, "cdd": 0.75, "ponctuel": 0.5, "chomeur": 0, "aide": 0.25}
    return sum(s[k] * w for k, w in poids.items()) / sum(s.values())


def redistribuer(parts, cle, nouvelle):
    """Règle documentée : la part modifiée prend sa valeur (bornée à [0, total]), les autres se partagent le reste au prorata."""
    total = sum(parts.values())
    nouvelle = min(max(nouvelle, 0), total)
    reste_avant, reste_apres = total - parts[cle], total - nouvelle
    autres = [k for k in parts if k != cle]
    for k in autres:
        parts[k] = parts[k] * reste_apres / reste_avant if reste_avant > 0 else reste_apres / len(autres)
    parts[cle] = nouvelle


@unittest.skipIf(NODE is None, "node absent")
class AppliContrePython(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = donnees_actuelles()
        cls.communes = sorted(cls.data)
        cls.ind = {c: {k: d[k] for k in INDICATEURS} for c, d in cls.data.items()}
        cls.sc = charger_json(WEB / "sous_composantes.json")
        cls.bornes = bornes_indicateurs(cls.ind)
        cls.s01 = scores_01(cls.ind, cls.bornes)
        cls.pk = {"egal": (1, 1, 1), "betti": tuple(pk_betti(cls.s01))}
        cls.ref = {}
        for mode, pk in cls.pk.items():
            brut = indice_brut(cls.s01, pk)
            cls.ref[mode] = (min(brut.values()), max(brut.values()))
        cls.bornes_sc = {ind: {comp: (min(cls.sc[c][ind][comp] for c in cls.communes), max(cls.sc[c][ind][comp] for c in cls.communes))
                               for comp in cls.sc["Bastia"][ind]} for ind in DECOMPOSES}
        cls.scenarios = cls.generer_scenarios()
        with tempfile.TemporaryDirectory() as tmp:
            fichier = Path(tmp) / "scenarios.json"
            fichier.write_text(json.dumps(cls.scenarios), encoding="utf-8")
            r = subprocess.run([NODE, str(RACINE / "tests" / "js" / "dump_app.js"), str(fichier)], capture_output=True,
                               text=True, encoding="utf-8", timeout=600)
        assert r.returncode == 0, r.stderr[-2000:]
        cls.js = json.loads(r.stdout)

    # ------------------------------------------------------------------ scénarios
    @classmethod
    def generer_scenarios(cls):
        rng = random.Random(GRAINE)
        sortie = []
        for _ in range(NB_SCENARIOS):
            sc = {"mode": rng.choice(["egal", "betti"]), "commune": rng.choice(cls.communes), "curseurs": {}, "sous": []}
            simples = [k for k in INDICATEURS if k not in DECOMPOSES]
            for k in rng.sample(simples, rng.randint(0, 3)):
                sc["curseurs"][f"Indicateur_{k}"] = round(rng.uniform(0, 100), 3)
            for ind in rng.sample(DECOMPOSES, rng.randint(0, 3)):
                comps = [c for c in cls.sc["Bastia"][ind] if cls.bornes_sc[ind][c][0] != cls.bornes_sc[ind][c][1]]
                for comp in rng.sample(comps, rng.randint(1, min(2, len(comps)))):
                    if (ind, comp) in BINAIRES:
                        sc["sous"].append({"ind": f"Indicateur_{ind}", "comp": comp, "binaire": True, "coche": rng.random() < 0.5})
                    else:
                        sc["sous"].append({"ind": f"Indicateur_{ind}", "comp": comp, "pct": round(rng.uniform(0, 100), 3)})
            sortie.append(sc)
        return sortie

    def attendu(self, sc):
        """Résultat attendu d'un scénario : indicateurs de la commune modifiée, puis chaîne complète avec références figées."""
        c, mode = sc["commune"], sc["mode"]
        valeurs = dict(self.ind[c])
        for ident, pct in sc["curseurs"].items():
            k = ident.replace("Indicateur_", "")
            lo, hi = self.bornes[k]
            valeurs[k] = lo + pct / 100 * (hi - lo)
        edits = {}                                                    # sous-composantes modifiées, par indicateur décomposé
        for e in sc["sous"]:
            ind = e["ind"].replace("Indicateur_", "")
            parts = edits.setdefault(ind, dict(self.sc[c][ind]))
            comp = e["comp"]
            if (ind, comp) in BINAIRES:
                parts[comp] = BINAIRES[(ind, comp)] if e["coche"] else 0
                continue
            lo, hi = self.bornes_sc[ind][comp]
            v = lo + e["pct"] / 100 * (hi - lo)
            if (ind, comp) in ENTIERS:
                v = round(v)
            if ind in PARTS:
                redistribuer(parts, comp, v)
            else:
                parts[comp] = v
        for ind, parts in edits.items():
            if parts != self.sc[c][ind]:                              # l'appli ne recalcule que si une sous-composante a bougé
                valeurs[ind] = formule(ind, parts)
        ind_modif = {**self.ind, c: valeurs}
        s01 = scores_01(ind_modif, self.bornes)
        brut = indice_brut(s01, self.pk[mode])
        lo, hi = self.ref[mode]
        return valeurs, {n: (v - lo) / (hi - lo) * 10 for n, v in brut.items()}

    # ------------------------------------------------------------------ vérifications
    def test_etat_de_base_mode_egal(self):
        base = self.js["base"]["egal"]
        for c in self.communes:
            self.assertAlmostEqual(base["indice"][c], self.data[c]["OppChoVec_0_10"], places=9)
            for d in ("Opp", "Cho", "Vec"):
                self.assertAlmostEqual(base["scores"][c][f"Score_{d}"], self.data[c][f"Score_{d}_0_10"], places=9)
        self.assertEqual(base["pk"], [1, 1, 1])

    def test_etat_de_base_mode_betti(self):
        base = self.js["base"]["betti"]
        attendu = vers_0_10(indice_brut(self.s01, self.pk["betti"]))
        for c in self.communes:
            self.assertAlmostEqual(base["indice"][c], attendu[c], places=9)
        for a, b in zip(base["pk"], self.pk["betti"]):
            self.assertAlmostEqual(a, b, places=12)

    @exige_libs("jenkspy", "numpy")
    def test_seuils_de_jenks_js_egaux_a_jenkspy_dans_les_deux_modes(self):
        import numpy as np
        from jenkspy import jenks_breaks
        for mode in ("egal", "betti"):
            valeurs = np.array([self.js["base"][mode]["indice"][c] for c in self.communes])
            attendu = [0.0] + list(jenks_breaks(valeurs, n_classes=5)[1:-1]) + [10.0]
            for a, b in zip(self.js["base"][mode]["jenks"], attendu):
                self.assertAlmostEqual(a, b, places=9, msg=mode)

    def test_scenarios_de_modification_contre_recalcul_independant(self):
        self.assertEqual(len(self.js["scenarios"]), NB_SCENARIOS)
        for i, (sc, res) in enumerate(zip(self.scenarios, self.js["scenarios"])):
            c = sc["commune"]
            valeurs, indice = self.attendu(sc)
            with self.subTest(scenario=i, commune=c, mode=sc["mode"]):
                for k in INDICATEURS:
                    self.assertAlmostEqual(res["indicateurs"][f"Indicateur_{k}"], valeurs[k], places=9, msg=k)
                for nom in self.communes:
                    self.assertAlmostEqual(res["indice"][nom], indice[nom], places=9, msg=nom)
                for nom in self.communes:
                    if nom != c:
                        self.assertEqual(res["indice"][nom], self.js["base"][sc["mode"]]["indice"][nom],
                                         f"{nom} ne doit pas bouger quand on modifie {c}")

    def test_les_scenarios_couvrent_bien_les_cas(self):
        """Garde-fou sur le générateur : le tirage doit exercer curseurs simples, cases à cocher, parts d'emploi et les deux modes."""
        modes = {s["mode"] for s in self.scenarios}
        self.assertEqual(modes, {"egal", "betti"})
        self.assertTrue(any(s["curseurs"] for s in self.scenarios))
        sous = [e for s in self.scenarios for e in s["sous"]]
        self.assertTrue(any(e.get("binaire") for e in sous))
        self.assertTrue(any(e["ind"] == "Indicateur_Vec3" for e in sous))
        self.assertTrue(any(e["ind"] == "Indicateur_Cho1" for e in sous))

    def test_les_scenarios_modifient_effectivement_l_indice(self):
        """Sans cela, un test « rien ne change » passerait même si l'appli ignorait les curseurs."""
        modifies = 0
        for sc, res in zip(self.scenarios, self.js["scenarios"]):
            avant = self.js["base"][sc["mode"]]["indice"][sc["commune"]]
            modifies += abs(res["indice"][sc["commune"]] - avant) > 1e-6
        self.assertGreaterEqual(modifies, 20, f"seulement {modifies}/{NB_SCENARIOS} scénarios modifient l'indice")

    def test_aucune_erreur_pendant_les_scenarios(self):
        self.assertEqual(self.js["erreurs"], [])
        self.assertEqual(self.js["alertes"], 2 * NB_SCENARIOS, "une alerte au recalcul et une à la réinitialisation par scénario")


if __name__ == "__main__":
    unittest.main()
