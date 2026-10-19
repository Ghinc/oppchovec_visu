"""3. Fichiers dérivés de data_scores_0_10.json : seuils Jenks, CAH, LISA, chatbot, sous-composantes."""
import re
import unittest
from collections import Counter

from common import (GEOJSON, INDICATEURS, SLOW, WEB, charger_const_js, charger_json, classe_jenks, donnees_actuelles,
                    exige_libs, indice_brut, lent, pk_betti, vers_0_10)

VARIABLES_JENKS = {"OppChoVec_0_10": "oppchovec", "Score_Opp_0_10": "opp", "Score_Cho_0_10": "cho", "Score_Vec_0_10": "vec"}


def indices_0_10(data, mode):
    s01 = {c: {"Opp": d["Score_Opp"], "Cho": d["Score_Cho"], "Vec": d["Score_Vec"]} for c, d in data.items()}
    pk = pk_betti(s01) if mode == "betti" else (1, 1, 1)
    return vers_0_10(indice_brut(s01, pk))


# ------------------------------------------------------------------------------------------------------------
@exige_libs("jenkspy", "numpy")
class SeuilsJenks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = donnees_actuelles()
        cls.fichier = charger_json(WEB / "seuils_jenks_optimal_gvf.json")

    def test_seuils_et_gvf_recalcules_avec_jenkspy(self):
        import numpy as np
        from jenkspy import jenks_breaks
        for var in VARIABLES_JENKS:
            with self.subTest(variable=var):
                arr = np.array([d[var] for d in self.data.values()])
                breaks = jenks_breaks(arr, n_classes=5)
                internes = [min(b, 10.0) for b in breaks[1:-1]]
                self.assertEqual(len(self.fichier[var]["breaks"]), 4)
                for a, b in zip(internes, self.fichier[var]["breaks"]):
                    self.assertAlmostEqual(a, b, places=9)
                classes = np.digitize(arr, breaks[1:-1])
                sdam = sum(((arr[classes == i] - arr[classes == i].mean()) ** 2).sum() for i in range(5) if (classes == i).any())
                gvf = (((arr - arr.mean()) ** 2).sum() - sdam) / ((arr - arr.mean()) ** 2).sum()
                self.assertAlmostEqual(gvf, self.fichier[var]["gvf"], places=9)

    def test_les_seuils_sont_des_valeurs_observees_et_croissants(self):
        """Propriété de la méthode de Jenks : chaque seuil est la valeur d'une commune (borne supérieure incluse)."""
        for var in VARIABLES_JENKS:
            vals = {d[var] for d in self.data.values()}
            b = self.fichier[var]["breaks"]
            self.assertEqual(b, sorted(b))
            for x in b:
                self.assertTrue(any(abs(x - v) < 1e-9 for v in vals), f"{var}: {x} n'est pas une valeur observée")

    def test_aucune_classe_vide(self):
        for var in VARIABLES_JENKS:
            comptes = Counter(classe_jenks(d[var], self.fichier[var]["breaks"]) for d in self.data.values())
            self.assertEqual(sorted(comptes), [0, 1, 2, 3, 4], var)

    def test_seuils_de_repli_codes_en_dur_dans_script_js_sont_a_jour(self):
        """Le script utilise des seuils par défaut si le fichier n'est pas chargé : ils ne doivent pas être périmés."""
        src = (WEB / "script.js").read_text(encoding="utf-8")
        bloc = re.search(r"let seuilsJenks = \{(.*?)\};", src, re.S).group(1)
        for var, cle in VARIABLES_JENKS.items():
            valeurs = [float(x) for x in re.search(rf"(?<![A-Za-z]){cle}:\s*\[([^\]]*)\]", bloc).group(1).split(",")]
            attendus = [0.0] + self.fichier[var]["breaks"] + [10.0]
            for a, b in zip(valeurs, attendus):
                self.assertAlmostEqual(a, b, delta=0.0051, msg=f"seuil de repli périmé pour {cle}")


# ------------------------------------------------------------------------------------------------------------
@exige_libs("scipy", "sklearn")
class CAH(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = donnees_actuelles()
        cls.cah = {n: charger_json(WEB / f"cah_{n}_clusters.json") for n in (3, 5)}
        cls.ordre = [f["properties"]["nom"] for f in charger_json(GEOJSON)["features"]]

    def test_scores_embarques_identiques_aux_donnees(self):
        for n, cah in self.cah.items():
            for c, v in cah["clusters"].items():
                d = self.data[c]
                self.assertEqual((v["Score_Opp"], v["Score_Cho"], v["Score_Vec"], v["OppChoVec"]),
                                 (d["Score_Opp_0_10"], d["Score_Cho_0_10"], d["Score_Vec_0_10"], d["OppChoVec_0_10"]),
                                 f"CAH{n} {c}")

    def test_partition_identique_a_ward_recalcule(self):
        """Ward sur les 3 scores 0-10 standardisés (méthode de preparer_donnees_cah_web_complet.py)."""
        import numpy as np
        from scipy.cluster.hierarchy import fcluster, linkage
        from sklearn.preprocessing import StandardScaler
        X = np.array([[self.data[c]["Score_Opp_0_10"], self.data[c]["Score_Cho_0_10"], self.data[c]["Score_Vec_0_10"]]
                      for c in self.ordre])
        Z = linkage(StandardScaler().fit_transform(X), method="ward")
        for n, cah in self.cah.items():
            labels = fcluster(Z, t=n, criterion="maxclust")
            recalcule = {c: int(l) for c, l in zip(self.ordre, labels)}
            fichier = {c: v["cluster"] for c, v in cah["clusters"].items()}
            # même partition (les numéros peuvent différer d'une version de scipy à l'autre)
            correspondance = {}
            for c in self.ordre:
                self.assertEqual(correspondance.setdefault(fichier[c], recalcule[c]), recalcule[c], f"CAH{n}: {c}")
            self.assertEqual(len(set(correspondance.values())), n)
            self.assertEqual(fichier, recalcule, f"CAH{n}: mêmes numéros de classes que le recalcul")

    def test_statistiques_par_cluster_coherentes(self):
        for n, cah in self.cah.items():
            self.assertEqual(sum(s["n_communes"] for s in cah["stats"]), 360)
            for s in cah["stats"]:
                membres = [c for c, v in cah["clusters"].items() if v["cluster"] == s["cluster"]]
                self.assertEqual(len(membres), s["n_communes"])
                for cle, champ in (("opp_moyen", "Score_Opp_0_10"), ("cho_moyen", "Score_Cho_0_10"),
                                   ("vec_moyen", "Score_Vec_0_10"), ("oppchovec_moyen", "OppChoVec_0_10")):
                    moy = sum(self.data[c][champ] for c in membres) / len(membres)
                    self.assertAlmostEqual(moy, s[cle], places=9, msg=f"CAH{n} cluster {s['cluster']} {cle}")

    def test_cah_data_js_reprend_les_json(self):
        js = charger_const_js(WEB / "cah_data.js")
        self.assertEqual(js["CAH_DATA_3"], self.cah[3])
        self.assertEqual(js["CAH_DATA_5"], self.cah[5])
        texte = (WEB / "cah_data.js").read_text(encoding="utf-8")
        self.assertIn("const CAH_DATA = CAH_DATA_3;", texte, "CAH_DATA (compatibilité) doit rester la version 3 classes")


# ------------------------------------------------------------------------------------------------------------
LISA_FICHIERS = {  # clé -> (fichier, constante, mode p_k, seuil)
    "egal_5": ("lisa_data.js", "LISA_DATA", "egal", 0.05),
    "egal_1": ("lisa_data_1pct.js", "LISA_DATA_1PCT", "egal", 0.01),
    "betti_5": ("lisa_data_betti.js", "LISA_DATA_BETTI", "betti", 0.05),
    "betti_1": ("lisa_data_betti_1pct.js", "LISA_DATA_BETTI_1PCT", "betti", 0.01),
}
NON_SIG = "Non significatif"


class LisaCoherenceInterne(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = donnees_actuelles()
        cls.lisa = {k: charger_const_js(WEB / f, n) for k, (f, n, _, _) in LISA_FICHIERS.items()}

    def test_valeur_d_indice_embarquee_identique_au_recalcul(self):
        for k, (_, _, mode, _) in LISA_FICHIERS.items():
            attendu = indices_0_10(self.data, mode)
            for c, v in self.lisa[k]["clusters"].items():
                self.assertAlmostEqual(v["oppchovec"], attendu[c], places=9, msg=f"{k} {c}")

    def test_significativite_et_etiquettes(self):
        for k, (_, _, _, seuil) in LISA_FICHIERS.items():
            L = self.lisa[k]
            self.assertEqual(L["metadata"]["seuil_significativite"], seuil)
            for c, v in L["clusters"].items():
                self.assertEqual(v["significatif"], v["p_value"] < seuil, f"{k} {c}")
                self.assertEqual(v["cluster"] == NON_SIG, not v["significatif"], f"{k} {c}")
            nb = sum(v["significatif"] for v in L["clusters"].values())
            self.assertEqual(L["metadata"]["nb_significatives"], nb, k)
            self.assertEqual(L["metadata"]["nb_communes"], 360)
            comptes = Counter(v["cluster"] for v in L["clusters"].values())
            for etiquette, n in L["statistiques"].items():
                self.assertEqual(comptes.get(etiquette, 0), n, f"{k} {etiquette}")

    def test_1pct_est_inclus_dans_5pct_avec_memes_p_values(self):
        """Même graine et même nombre de permutations => mêmes p-values ; le seuil 1 % est plus strict."""
        for mode in ("egal", "betti"):
            a, b = self.lisa[f"{mode}_5"]["clusters"], self.lisa[f"{mode}_1"]["clusters"]
            for c in a:
                self.assertEqual(a[c]["p_value"], b[c]["p_value"], f"{mode} {c}")
                self.assertEqual(a[c]["lisa_I"], b[c]["lisa_I"])
                if b[c]["significatif"]:
                    self.assertEqual(a[c]["cluster"], b[c]["cluster"])
                    self.assertTrue(a[c]["significatif"])

    def test_poids_enregistres(self):
        self.assertEqual(self.lisa["egal_5"]["metadata"]["poids"]["pk"], [1, 1, 1])
        self.assertEqual(self.lisa["egal_1"]["metadata"]["poids"]["pk"], [1, 1, 1])
        for k in ("betti_5", "betti_1"):
            p = self.lisa[k]["metadata"]["poids"]
            self.assertAlmostEqual(p["Opp"] + p["Cho"] + p["Vec"], 1.0, delta=2e-4)


@exige_libs("geopandas", "libpysal", "esda", "pandas")
class LisaRecalcule(unittest.TestCase):
    """Recalcule avec esda/libpysal la partie déterministe (I local, quadrant, I global) : pas besoin des 9999 permutations."""

    @classmethod
    def setUpClass(cls):
        import geopandas as gpd
        import pandas as pd
        from libpysal.weights import KNN
        cls.data = donnees_actuelles()
        cls.lisa = {k: charger_const_js(WEB / f, n) for k, (f, n, _, _) in LISA_FICHIERS.items()}
        gdf = gpd.read_file(GEOJSON)
        cls.indices = {m: indices_0_10(cls.data, m) for m in ("egal", "betti")}
        gdf = gdf.merge(pd.DataFrame({"nom": list(cls.data), "egal": [cls.indices["egal"][c] for c in cls.data],
                                      "betti": [cls.indices["betti"][c] for c in cls.data]}), on="nom", how="inner")
        cls.gdf = gdf
        w = KNN.from_dataframe(gdf.to_crs("EPSG:2154"), k=5)  # matrice du script gen_lisa_knn5.py
        w.transform = "r"
        cls.w = w

    def test_moran_global_et_local_deterministes(self):
        from esda.moran import Moran, Moran_Local
        etiquettes = {1: "HH (High-High)", 2: "LH (Low-High)", 3: "LL (Low-Low)", 4: "HL (High-Low)"}
        for mode in ("egal", "betti"):
            y = self.gdf[mode].values
            local = Moran_Local(y, self.w, permutations=0)
            global_i = Moran(y, self.w).I
            for seuil in ("5", "1"):
                L = self.lisa[f"{mode}_{seuil}"]
                self.assertAlmostEqual(L["metadata"]["moran_global_I"], global_i, places=9)
                for i, nom in enumerate(self.gdf["nom"]):
                    c = L["clusters"][nom]
                    self.assertAlmostEqual(c["lisa_I"], local.Is[i], places=9, msg=f"{mode}{seuil} {nom}")
                    if c["significatif"]:
                        self.assertEqual(c["cluster"], etiquettes[int(local.q[i])], f"{mode}{seuil} {nom}")

    @lent()
    def test_rejeu_complet_9999_permutations_graine_42(self):
        """Reproduit exactement les p-values stockées (reproductibilité de la chaîne LISA). ~1 minute par mode."""
        from esda.moran import Moran_Local
        for mode in ("egal", "betti"):
            lisa = Moran_Local(self.gdf[mode].values, self.w, permutations=9999, seed=42)
            L = self.lisa[f"{mode}_5"]["clusters"]
            for i, nom in enumerate(self.gdf["nom"]):
                self.assertAlmostEqual(L[nom]["p_value"], lisa.p_sim[i], places=12, msg=f"{mode} {nom}")


# ------------------------------------------------------------------------------------------------------------
class FichiersAnnexes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = donnees_actuelles()

    def test_donnees_chatbot_sont_les_valeurs_arrondies(self):
        """Arrondis exacts du script generer_donnees_communes_chatbot.py (round(x, d) / int(x))."""
        chat = charger_json(WEB / "donnees_completes_communes.json")
        for c, d in self.data.items():
            attendu = {
                "scores_globaux": {"OppChoVec": round(d["OppChoVec_0_10"], 2), "Opportunités": round(d["Score_Opp_0_10"], 2),
                                   "Choix": round(d["Score_Cho_0_10"], 2), "Vécu": round(d["Score_Vec_0_10"], 2)},
                "opportunites": {"Opp1_Education": round(d["Opp1"], 2), "Opp2_Inegalites": round(d["Opp2"], 4),
                                 "Opp3_Mobilite": round(d["Opp3"], 2), "Opp4_Connectivite": round(d["Opp4"], 2)},
                "choix": {"Cho1_QuartierPrioritaire": round(d["Cho1"], 2), "Cho2_ParticipationElectorale": round(d["Cho2"], 2)},
                "vecu": {"Vec1_NiveauVie": int(d["Vec1"]), "Vec2_Logement": round(d["Vec2"], 4),
                         "Vec3_StatutSocial": round(d["Vec3"], 4), "Vec4_Emploi": int(d["Vec4"])},
            }
            self.assertEqual(chat[c], attendu, c)

    def test_sous_composantes_recomposent_les_indicateurs(self):
        sc = charger_json(WEB / "sous_composantes.json")
        formules = {
            "Opp3": lambda s: s["voiture"] + (100 if s["tc"] > 0 else 0) + (100 if s["bus"] else 0),
            "Opp4": lambda s: (s["g4"] + s["debit"] + s["fibre"]) / 3,
            "Cho1": lambda s: -__import__("math").log(s["personnes_qpv"]) if s["personnes_qpv"] > 0 else 0,
            "Vec2": lambda s: (__import__("math").exp(-s["pers_piece"]) + s["maisons"]) / 2,
            "Vec3": lambda s: (s["stable"] * 1 + s["autres"] * 0.5 + s["chomeur"] * 0) / (s["stable"] + s["autres"] + s["chomeur"]),
        }
        for c, d in self.data.items():
            for ind, f in formules.items():
                self.assertAlmostEqual(f(sc[c][ind]), d[ind], places=9, msg=f"{c}.{ind}")

    def test_parts_d_emploi_somment_a_100_aux_arrondis_pres(self):
        """Les trois parts d'emploi (stable, autres contrats, chômeurs) somment à 100 (curseurs couplés de l'appli)."""
        for c, s in charger_json(WEB / "sous_composantes.json").items():
            self.assertAlmostEqual(sum(s["Vec3"].values()), 100, delta=1e-9, msg=c)

    def test_aucune_composante_n_est_constante(self):
        """L'appli grise le curseur d'une composante constante ; dans la v2 aucune ne l'est (le chauffage constant de la v1 a été retiré)."""
        sc = charger_json(WEB / "sous_composantes.json")
        constantes = set()
        for ind in ("Opp3", "Opp4", "Cho1", "Vec2", "Vec3"):
            for comp in sc["Bastia"][ind]:
                if len({s[ind][comp] for s in sc.values()}) == 1:
                    constantes.add(f"{ind}.{comp}")
        self.assertEqual(constantes, set())


if __name__ == "__main__":
    unittest.main()
