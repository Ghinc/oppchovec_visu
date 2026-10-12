"""6. Cohérence avec la documentation : les affirmations vérifiables des .md doivent correspondre aux fichiers et aux données.

Documents couverts : WEB/README_FICHIERS.md, Code/VERIFICATION_COHERENCE_DONNEES.md, Python/guide_integration_web.md, Python/README.md.
Si un de ces tests échoue après une régénération des données, c'est le document qu'il faut mettre à jour.
"""
import re
import unittest

from common import (ALPHA, BETA, CHAMPS_SCORES, INDICATEURS, PYDIR, RACINE, STAGE, WEB, charger_json, donnees_actuelles,
                    dossier_sources)

CODE = STAGE / "Code"
EXTENSIONS = r"(?:json|js|py|md|xlsx|csv|html|css|geojson|png)"
NOMS_VARIABLES = {"OppChoVec": "OppChoVec_0_10", "Score_Opp": "Score_Opp_0_10", "Score_Cho": "Score_Cho_0_10",
                  "Score_Vec": "Score_Vec_0_10"}


def lire(chemin):
    return chemin.read_text(encoding="utf-8")


def fichiers_mentionnes(texte):
    """Noms de fichiers écrits en `code` ou en **gras** (« data_scores_0_10.json », « lisa_data.js »...)."""
    trouves = set(re.findall(rf"`([\w\-\.]+\.{EXTENSIONS})`", texte))
    trouves |= set(re.findall(rf"\*\*([\w\-\.]+\.{EXTENSIONS})\*\*", texte))
    return trouves


# Sources brutes citées par la documentation mais volontairement absentes du dépôt (voir sources-donnees-brutes dans tests/README.md)
SOURCES_HORS_DEPOT = {"Cho2.xlsx", "Cho2_francais_18plus.xlsx", "fibre_corse.csv"}


# Fichiers générés à la demande et non versionnés : on vérifie que le script générateur existe et produit bien ce nom
GENERES_A_PART = {"tableau_indicateurs_0_10.xlsx": "generer_tableau_excel_0_10.py"}


def existe_dans_le_depot(nom):
    if nom in GENERES_A_PART:
        generateur = PYDIR / GENERES_A_PART[nom]
        return generateur.exists() and nom in generateur.read_text(encoding="utf-8")
    if nom in SOURCES_HORS_DEPOT:
        src = dossier_sources()
        return src is None or (src / "Données" / "Corse_Commune" / nom).exists()
    return any(True for _ in RACINE.rglob(nom) if "node_modules" not in str(_) and ".git" not in _.parts)


class ReadmeFichiersWeb(unittest.TestCase):
    """stage_ambroise/Code/WEB/README_FICHIERS.md : documentation des fichiers chargés par l'appli."""

    @classmethod
    def setUpClass(cls):
        cls.texte = lire(WEB / "README_FICHIERS.md")
        cls.data = donnees_actuelles()
        cls.seuils = charger_json(WEB / "seuils_jenks_optimal_gvf.json")

    def test_tous_les_fichiers_cites_existent(self):
        for nom in sorted(fichiers_mentionnes(self.texte)):
            with self.subTest(fichier=nom):
                self.assertTrue(existe_dans_le_depot(nom), f"« {nom} » est cité mais n'existe pas dans le dépôt")

    def test_champs_cites_existent_dans_les_donnees(self):
        champs = set(re.findall(r"`((?:OppChoVec|Score_\w+|Opp\d|Cho\d|Vec\d)(?:_0_10)?)`", self.texte))
        self.assertTrue(champs)
        for c in champs:
            self.assertIn(c, self.data["Afa"], f"champ « {c} » cité mais absent des données")

    def test_tableaux_de_seuils_jenks_correspondent_au_fichier(self):
        """Les tableaux « Classe 1 : a - b » de la doc doivent être les seuils réellement utilisés (arrondis à 2 décimales)."""
        for titre, variable in NOMS_VARIABLES.items():
            bloc = re.search(rf"\*\*{titre} :\*\*\s*```(.*?)```", self.texte, re.S)
            self.assertIsNotNone(bloc, f"tableau de seuils de {titre} introuvable dans README_FICHIERS.md")
            bornes = [(float(a), float(b)) for a, b in re.findall(r":\s*([\d.]+)\s*-\s*([\d.]+)", bloc.group(1))]
            attendu = [0.0] + self.seuils[variable]["breaks"] + [10.0]
            self.assertEqual(len(bornes), 5, titre)
            for i, (a, b) in enumerate(bornes):
                with self.subTest(variable=titre, classe=i + 1):
                    self.assertAlmostEqual(a, attendu[i], delta=0.0051)
                    self.assertAlmostEqual(b, attendu[i + 1], delta=0.0051)

    def test_exemple_de_verification_afa(self):
        m = re.search(r"console\.log\((\w+)\['(\w+)'\]\.OppChoVec_0_10\)`? devrait afficher `([\d.]+)`", self.texte)
        self.assertIsNotNone(m, "exemple de vérification introuvable")
        self.assertAlmostEqual(self.data[m.group(2)]["OppChoVec_0_10"], float(m.group(3)))
        # la variable citée doit exister dans l'appli (l'e2e vérifie sa valeur dans le navigateur)
        self.assertRegex((WEB / "script.js").read_text(encoding="utf-8"), rf"(?:let|var|const)\s+{m.group(1)}\b")

    def test_le_nombre_de_seuils_annonce_est_le_bon(self):
        """Le doc annonce « 6 valeurs (pour 5 classes) » : [0, 4 seuils internes, 10]."""
        self.assertIn("6 valeurs", self.texte)
        for v in NOMS_VARIABLES.values():
            self.assertEqual(len(self.seuils[v]["breaks"]) + 2, 6)

    def test_tableau_lisa_correspond_aux_fichiers(self):
        from common import charger_const_js
        for fichier, constante in (("lisa_data.js", "LISA_DATA"), ("lisa_data_1pct.js", "LISA_DATA_1PCT"),
                                   ("lisa_data_betti.js", "LISA_DATA_BETTI"), ("lisa_data_betti_1pct.js", "LISA_DATA_BETTI_1PCT")):
            meta = charger_const_js(WEB / fichier, constante)["metadata"]
            m = re.search(rf"`{fichier}`\s*\|\s*`{constante}`\s*\|[^|]*\|[^|]*\|\s*(\d+) communes \(([\d,]+) %\)", self.texte)
            self.assertIsNotNone(m, f"ligne de {fichier} introuvable")
            self.assertEqual(int(m.group(1)), meta["nb_significatives"], fichier)
            self.assertAlmostEqual(float(m.group(2).replace(",", ".")), meta["pourcent_significatives"], delta=0.051, msg=fichier)

    def test_decrit_la_procedure_de_regeneration(self):
        for script in ("regenerer_data_scores.py", "exporter_sous_composantes.py", "calculer_jenks_5_classes.py",
                       "gen_lisa_knn5.py", "preparer_donnees_cah_web_complet.py", "generer_cah_data_js_complet.py"):
            self.assertIn(script, self.texte, f"la procédure de régénération doit citer {script}")


class VerificationCoherenceDonnees(unittest.TestCase):
    """stage_ambroise/Code/VERIFICATION_COHERENCE_DONNEES.md."""

    @classmethod
    def setUpClass(cls):
        cls.texte = lire(CODE / "VERIFICATION_COHERENCE_DONNEES.md")
        cls.data = donnees_actuelles()

    def test_les_echelles_documentees_couvrent_les_valeurs_reelles(self):
        section = self.texte.split("## Échelles utilisées")[1]
        trouves = {}
        for nom, a, b in re.findall(r"\*\*(\w+)\*\*\s*:\s*(-?[\d.,\s]+?)\s*à\s*(-?[\d.,\s]+?)(?:\s*\(|\s*$)", section, re.M):
            trouves[nom] = (float(a.replace(" ", "").replace(",", ".")), float(b.replace(" ", "").replace(",", ".")))
        for ind in INDICATEURS:
            self.assertIn(ind, trouves, f"échelle de {ind} non documentée")
            valeurs = [d[ind] for d in self.data.values()]
            lo, hi = trouves[ind]
            with self.subTest(indicateur=ind):
                self.assertLessEqual(lo, min(valeurs), f"{ind}: la doc dit min {lo}, réel {min(valeurs)}")
                self.assertGreaterEqual(hi, max(valeurs), f"{ind}: la doc dit max {hi}, réel {max(valeurs)}")
        for score in ("Score_Opp_0_10", "Score_Cho_0_10", "Score_Vec_0_10", "OppChoVec_0_10"):
            self.assertEqual(trouves.get(score), (0.0, 10.0), score)
        for score in ("Score_Opp", "Score_Cho", "Score_Vec"):
            self.assertEqual(trouves.get(score), (0.0, 1.0), score)
        self.assertGreaterEqual(trouves["OppChoVec"][1], 3 ** (2 / 3) - 0.01)   # maximum théorique de la formule
        self.assertEqual(trouves["OppChoVec"][0], 0.0)

    def test_exemple_ajaccio_correspond_aux_donnees(self):
        lignes = re.findall(r"\|\s*\*\*(\w+)\*\*\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*\*\*([\d.]+)\*\*\s*\|", self.texte)
        self.assertGreaterEqual(len(lignes), 4, "tableau d'exemple introuvable")
        for champ, excel, web, diff in lignes:
            attendu = self.data["Ajaccio"][champ]
            with self.subTest(champ=champ):
                self.assertAlmostEqual(float(web), attendu, delta=5e-7)
                self.assertAlmostEqual(float(excel), attendu, delta=5e-7)
                self.assertEqual(float(diff), 0.0)

    def test_constantes_citees(self):
        self.assertIn(f"ALPHA = {ALPHA}", self.texte)
        self.assertIn(f"BETA = {BETA}", self.texte)

    def test_ne_renvoie_pas_vers_des_scripts_inexistants(self):
        for nom in re.findall(r"`(\w+\.py)`", self.texte):
            self.assertTrue(existe_dans_le_depot(nom), f"script « {nom} » cité mais absent du dépôt")


class GuideIntegrationWeb(unittest.TestCase):
    """stage_ambroise/Code/Python/guide_integration_web.md."""

    @classmethod
    def setUpClass(cls):
        cls.texte = lire(PYDIR / "guide_integration_web.md")

    def test_tous_les_fichiers_cites_existent(self):
        for nom in sorted(fichiers_mentionnes(self.texte) | set(re.findall(rf"\*\*([\w\-\.]+\.{EXTENSIONS})\*\* - ", self.texte))):
            with self.subTest(fichier=nom):
                self.assertTrue(existe_dans_le_depot(nom), f"« {nom} » est cité mais n'existe pas dans le dépôt")

    def test_convention_de_classement_identique_a_celle_de_l_appli(self):
        """Les seuils de Jenks sont des valeurs observées : une commune égale à un seuil appartient à la classe INFÉRIEURE.
        L'appli (afficherCarteUnique) teste `value <= seuil` ; l'exemple du guide doit faire de même."""
        code = "\n".join(re.findall(r"```javascript(.*?)```", self.texte, re.S))
        self.assertNotRegex(code, r"score\s*<\s*seuils\[i\s*\+\s*1\]", "le guide utilise encore la borne supérieure exclusive")
        self.assertRegex(code, r"<=\s*seuils\[")

    def test_structure_des_donnees_decrite(self):
        data = donnees_actuelles()
        for champ in re.findall(r'"(\w+_0_10|Opp\d|Cho\d|Vec\d)": float', self.texte):
            self.assertIn(champ, data["Afa"], champ)
        for champ in INDICATEURS + [c for c in CHAMPS_SCORES if c.endswith("_0_10")]:
            self.assertIn(f'"{champ}": float', self.texte, f"{champ} manque dans la description de data_scores_0_10.json")


class ReadmePython(unittest.TestCase):
    """stage_ambroise/Code/Python/README.md : description du calcul (oppchovec.py)."""

    @classmethod
    def setUpClass(cls):
        cls.texte = lire(PYDIR / "README.md")
        cls.code = lire(PYDIR / "oppchovec.py")

    def test_fichiers_de_sortie_decrits_sont_ceux_que_le_script_ecrit(self):
        sortis = re.findall(r"`((?:df_indicateur|dimensions_V|oppchovec_resultats_V|stats_descriptives_normalisées_V|Comparaison_V|data_indicateurs)\.\w+)`", self.texte)
        self.assertGreaterEqual(len(sortis), 5)
        for nom in sortis:
            stem, ext = nom.rsplit(".", 1)
            motif = stem.replace("_V", "_{suffixe}")
            self.assertTrue(nom in self.code or f"{motif}.{ext}" in self.code, f"{nom} n'est pas produit par oppchovec.py")

    def test_ponderations_decrites(self):
        self.assertRegex(self.texte, r"`Opp`.*pondération égale \(25%")
        self.assertRegex(self.texte, r"Cho1 et Cho2 \(50% chacun\)")
        self.assertRegex(self.texte, r"Vec1 à Vec4 \(25% chacun\)")
        self.assertRegex(self.texte, r"α=2\.5 et β=1\.5")


if __name__ == "__main__":
    unittest.main()
