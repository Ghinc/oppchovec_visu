"""7. Cohérence du code : constantes et poids dupliqués, fichiers référencés, identifiants du DOM, scripts de la chaîne."""
import ast
import re
import shutil
import subprocess
import sys
import unittest

from common import ALPHA, BETA, PYDIR, RACINE, STAGE, WEB, exige_libs, libs_disponibles

SCRIPT_JS = (WEB / "script.js")
INDEX = RACINE / "index.html"
INDEX_WEB = WEB / "index.html"
POIDS_VEC3 = {"stable": 1.0, "autres": 0.5, "chomeur": 0.0}   # le recensement 2023 regroupe CDD, intérim, aidés et apprentis : poids moyen 0,5
CHAINE_DE_REGENERATION = ["regenerer_data_scores.py", "exporter_sous_composantes.py", "calculer_jenks_5_classes.py",
                          "graphique_ecarts_types_cah.py", "preparer_donnees_cah_web_complet.py",
                          "generer_cah_data_js_complet.py", "generer_donnees_communes_chatbot.py"]


def chemins_absolus(texte):
    """Littéraux de chaîne du code (hors docstrings) qui ressemblent à un chemin absolu Windows."""
    arbre = ast.parse(texte)
    docstrings = {id(n.body[0].value) for n in ast.walk(arbre)
                  if isinstance(n, (ast.Module, ast.FunctionDef, ast.ClassDef)) and n.body
                  and isinstance(n.body[0], ast.Expr) and isinstance(n.body[0].value, ast.Constant)}
    return [n.value for n in ast.walk(arbre) if isinstance(n, ast.Constant) and isinstance(n.value, str)
            and id(n) not in docstrings and re.match(r"^[a-zA-Z]:[/\\]", n.value)]


def js():
    return SCRIPT_JS.read_text(encoding="utf-8")


class PoidsEtConstantesDupliques(unittest.TestCase):
    """Ces valeurs vivent à plusieurs endroits (Python, JavaScript, scripts de génération) : elles doivent rester identiques."""

    def test_poids_vec3_dans_script_js(self):
        m = re.search(r"c\.stable \* ([\d.]+) \+ c\.autres \* ([\d.]+) \+ c\.chomeur \* ([\d.]+)", js())
        self.assertIsNotNone(m, "formule Vec3 de SOUS_COMPOSANTES introuvable")
        self.assertEqual(dict(zip(POIDS_VEC3, map(float, m.groups()))), POIDS_VEC3)

    def test_poids_vec3_affiches_sur_les_curseurs(self):
        src = js()
        for cle, poids in POIDS_VEC3.items():
            m = re.search(rf"{cle}:\s*\{{ label: '[^']*\(poids ([\d,]+)\)'", src)
            self.assertIsNotNone(m, f"libellé de {cle}")
            self.assertEqual(float(m.group(1).replace(",", ".")), poids, f"poids affiché pour {cle}")

    def test_poids_vec3_dans_l_exporteur(self):
        sys.path.insert(0, str(PYDIR))
        import exporter_sous_composantes as exp
        self.assertEqual({k: p for k, (_, p) in exp.VEC3_CATEGORIES.items()}, POIDS_VEC3)

    def test_alpha_beta_partout(self):
        self.assertRegex(js(), r"const alpha = 2\.5;\s*const beta = 1\.5;")
        for fichier in ("regenerer_data_scores.py", "oppchovec.py"):
            texte = (PYDIR / fichier).read_text(encoding="utf-8")
            self.assertRegex(texte, rf"ALPHA(?:, BETA)?\s*=\s*{ALPHA}", fichier)
            self.assertRegex(texte, rf"BETA\s*=\s*{BETA}|ALPHA, BETA = {ALPHA}, {BETA}", fichier)
        for fichier in ("gen_lisa_knn5.py", "gen_lisa_betti.py"):
            self.assertIn(f"alpha, beta = {ALPHA}, {BETA}", (RACINE / fichier).read_text(encoding="utf-8"), fichier)

    @exige_libs("pandas")
    def test_ponderations_intra_dimension_script_js_et_python(self):
        src = js()
        sys.path.insert(0, str(PYDIR))
        import oppchovec
        for nom, dim in (("oppPonderation", "Opp"), ("choPonderation", "Cho"), ("vecPonderation", "Vec")):
            bloc = re.search(rf"const {nom}\s*=\s*\{{(.*?)\}};", src, re.S).group(1)
            js_poids = {k: float(v) for k, v in re.findall(r'"(\w+)":\s*([\d.]+)', bloc)}
            self.assertEqual(js_poids, oppchovec.PONDERATIONS[dim], f"pondérations de la dimension {dim}")
            self.assertAlmostEqual(sum(js_poids.values()), 1.0)


class FichiersEtIdentifiantsReferences(unittest.TestCase):
    def test_script_js_est_syntaxiquement_valide(self):
        node = shutil.which("node")
        if node is None:
            self.skipTest("node absent")
        r = subprocess.run([node, "--check", str(SCRIPT_JS)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_fichiers_charges_par_script_js_existent(self):
        src = js()
        noms = set(re.findall(r"BASE_PATH \+ '([\w.\-]+)'", src))
        self.assertIn("data_scores_0_10.json", noms)
        for nom in noms:
            self.assertTrue((WEB / nom).exists(), f"{nom} est chargé par script.js mais absent de WEB/")
        self.assertIn("Commune_Corse.geojson", src)
        self.assertTrue((STAGE / "Données" / "Commune_Corse.geojson").exists())

    def test_balises_script_et_link_de_index_html_existent(self):
        for index in (INDEX, INDEX_WEB):
            texte = index.read_text(encoding="utf-8")
            for ref in re.findall(r'<(?:script|link)[^>]*(?:src|href)="([^"]+)"', texte):
                if ref.startswith(("http://", "https://", "//")):
                    continue
                chemin = ref.split("?")[0]          # « ?v=… » : version ajoutée aux liens pour éviter les anciens fichiers en cache
                with self.subTest(index=index.name, ref=ref):
                    self.assertTrue((index.parent / chemin).exists(), f"{ref} introuvable depuis {index.parent}")

    def test_index_html_charge_tous_les_fichiers_de_donnees_js(self):
        texte = INDEX.read_text(encoding="utf-8")
        for f in ("cah_data.js", "lisa_data.js", "lisa_data_1pct.js", "lisa_data_betti.js", "lisa_data_betti_1pct.js", "script.js"):
            self.assertRegex(texte, rf'src="[^"]*{f}(\?v=[\w.-]+)?"')
        # script.js doit venir après les fichiers de données qu'il lit au chargement
        self.assertLess(texte.index("lisa_data_betti_1pct.js"), texte.index("script.js"))
        self.assertLess(texte.index("cah_data.js"), texte.index("script.js"))

    def test_identifiants_du_dom_utilises_par_script_js_existent(self):
        """Chaque getElementById('x') littéral doit viser un id de index.html ou un id créé dynamiquement par script.js."""
        src = js()
        html = INDEX.read_text(encoding="utf-8")
        ids_html = set(re.findall(r'\bid="([^"]+)"', html))
        ids_dynamiques = set(re.findall(r'\bid="([\w\-]+)"', src)) | set(re.findall(r"\.id\s*=\s*'([\w\-]+)'", src))
        utilises = set(re.findall(r"getElementById\(\s*['\"]([\w\-]+)['\"]\s*\)", src))
        manquants = sorted(utilises - ids_html - ids_dynamiques)
        self.assertEqual(manquants, [], f"identifiants utilisés par script.js mais absents de index.html : {manquants}")

    def test_onglets_cibles_par_script_js_existent_dans_index_html(self):
        """`document.querySelector('[data-tab="x"]')` sur un onglet absent renvoie null : l'appel suivant lève une erreur au
        chargement (c'était le cas de l'ancien onglet « Numbered », dont le code mort a été supprimé)."""
        onglets_html = set(re.findall(r'data-tab="([\w\-]+)"', INDEX.read_text(encoding="utf-8")))
        cites = set(re.findall(r'\[data-tab="([\w\-]+)"\]', js()))
        self.assertEqual(sorted(cites - onglets_html), [], "onglets visés par script.js mais absents de index.html")
        self.assertNotIn("numberedtab", js().lower())


class DescriptionsDeLInterface(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        src = js()
        cls.fr = re.search(r"fr:\s*\{.*?descriptions:\s*\{(.*?)\n\s*\}", src, re.S).group(1)
        cls.en = re.search(r"en:\s*\{.*?descriptions:\s*\{(.*?)\n\s*\}", src, re.S).group(1)

    def desc(self, bloc, ind):
        return re.search(rf"Indicateur_{ind}:\s*\"([^\"]*)\"", bloc).group(1)

    def test_dix_indicateurs_decrits_en_francais_et_en_anglais(self):
        for ind in ("Opp1", "Opp2", "Opp3", "Opp4", "Cho1", "Cho2", "Vec1", "Vec2", "Vec3", "Vec4"):
            self.assertTrue(self.desc(self.fr, ind))
            self.assertTrue(self.desc(self.en, ind))

    def test_descriptions_conformes_aux_formules(self):
        for bloc in (self.fr, self.en):
            self.assertIn("log(", self.desc(bloc, "Cho1"))
            self.assertNotIn("exp(", self.desc(bloc, "Cho1"), "Cho1 est −log(nombre de personnes), pas exp(−pourcentage)")
            opp4 = self.desc(bloc, "Opp4").lower()
            self.assertIn("4g", opp4)
            self.assertTrue("fibre" in opp4 or "fiber" in opp4, "Opp4 = moyenne de 4G, haut débit ET fibre")
            self.assertIn("20", self.desc(bloc, "Vec4"))


class ScriptsDeLaChaine(unittest.TestCase):
    def test_les_scripts_de_la_chaine_existent_et_se_compilent(self):
        for nom in CHAINE_DE_REGENERATION:
            chemin = PYDIR / nom
            with self.subTest(script=nom):
                self.assertTrue(chemin.exists())
                ast.parse(chemin.read_text(encoding="utf-8"), filename=nom)

    def test_scripts_de_la_chaine_sans_chemin_absolu(self):
        for nom in CHAINE_DE_REGENERATION:
            self.assertEqual(chemins_absolus((PYDIR / nom).read_text(encoding="utf-8")), [], f"{nom} contient un chemin absolu")

    def test_scripts_de_la_racine_sans_chemin_absolu(self):
        """Ces scripts écrivaient dans un AUTRE clone du projet (c:/These/oppchovec_visu/) et dans Téléchargements : tout passe
        maintenant par chemins.py, relatif au dépôt."""
        for nom in ("chemins.py", "gen_lisa_knn5.py", "gen_lisa_betti.py", "gen_excel_010.py", "gen_appendix2.py",
                    "gen_comparaison.py", "gen_top5_betti.py"):
            texte = (RACINE / nom).read_text(encoding="utf-8")
            self.assertEqual(chemins_absolus(texte), [], f"{nom} contient un chemin absolu")
            self.assertNotIn("oppchovec_visu", texte, f"{nom} vise l'autre clone du projet")
            self.assertNotIn("Downloads", texte, f"{nom} écrit dans Téléchargements")
            if nom != "chemins.py":
                self.assertIn("chemins", texte, f"{nom} doit prendre ses chemins dans chemins.py")

    @unittest.expectedFailure
    def test_les_deux_index_html_exposent_les_memes_onglets(self):
        """DETTE CONNUE : stage_ambroise/Code/WEB/index.html est une copie plus ancienne (il lui manque 3 onglets)."""
        onglets = lambda p: set(re.findall(r'data-tab="([\w\-]+)"', p.read_text(encoding="utf-8")))
        self.assertEqual(onglets(INDEX), onglets(INDEX_WEB))


if __name__ == "__main__":
    unittest.main()
