"""Test des tests : on introduit volontairement UNE faute à la fois dans une COPIE du projet et on vérifie que la suite devient rouge.

Une suite qui passe ne prouve rien tant qu'on n'a pas vu qu'elle sait échouer. Chaque « mutation » ci-dessous reproduit une régression
plausible (donnée altérée, constante modifiée, formule inversée, ancien défaut réintroduit, document périmé...). Le rapport indique quelle
couche l'a détectée (Python / JavaScript / navigateur). Une mutation NON détectée est une lacune des tests.

Usage (depuis la racine du dépôt) :
    python tests/mutations.py                 # toutes les mutations (~20 min avec le navigateur)
    python tests/mutations.py --sans-e2e      # sans les mutations qui exigent le navigateur
    python tests/mutations.py --seulement alpha_js poids_vec3_js_inverses
    python tests/mutations.py --liste
Aucun fichier du dépôt n'est modifié.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
WEB = "stage_ambroise/Code/WEB"
PY = "stage_ambroise/Code/Python"
A_COPIER = ["tests", "index.html", "gen_lisa_knn5.py", "gen_lisa_betti.py", WEB, PY, "stage_ambroise/Données",
            "stage_ambroise/Code/VERIFICATION_COHERENCE_DONNEES.md"]
IGNORER = shutil.ignore_patterns("__pycache__", "*.pyc", "captures")


@dataclass
class Mutation:
    nom: str
    description: str
    fichier: str
    transformer: object            # fonction(texte) -> texte ; None = supprimer le fichier
    suites: tuple = ("python", "js")   # couches à lancer pour la détecter
    attendu: tuple = ()            # couches qui DOIVENT la détecter (vide = au moins une)


def remplacer(ancien, nouveau, nb=1):
    def f(texte):
        assert ancien in texte, f"motif introuvable : {ancien[:70]!r}"
        return texte.replace(ancien, nouveau, nb)
    return f


def json_modifie(fonction):
    def f(texte):
        d = json.loads(texte)
        fonction(d)
        return json.dumps(d, indent=2, ensure_ascii=False)
    return f


def lisa_modifie(commune_selon):
    def f(texte):
        m = re.search(r"const (\w+) = (\{.*\n\});", texte, re.S)
        d = json.loads(m.group(2))
        commune_selon(d)
        return texte[:m.start(2)] + json.dumps(d, ensure_ascii=False, indent=2) + texte[m.end(2):]
    return f


def _afa_opp1(d): d["Afa"]["Opp1"] += 0.3
def _renommer(d): d["Afa-bis"] = d.pop("Afa")
def _supprimer(d): d.pop("Afa")
def _score_vec(d): d["Ajaccio"]["Score_Vec_0_10"] += 0.2
def _seuil(d): d["OppChoVec_0_10"]["breaks"][0] += 0.01
def _cah(d): c = d["clusters"]; premier = next(iter(c)); c[premier]["cluster"] = 1 if c[premier]["cluster"] != 1 else 2
def _lisa(d):
    for nom, v in d["clusters"].items():
        if not v["significatif"]:
            v["cluster"] = "HH (High-High)"
            return


MUTATIONS = [
    # ---- données ---------------------------------------------------------------------------------------------------
    Mutation("donnee_indicateur_modifiee", "un indicateur modifié sans recalculer les scores", f"{WEB}/data_scores_0_10.json", json_modifie(_afa_opp1)),
    Mutation("donnee_score_modifie", "un Score_Vec_0_10 altéré", f"{WEB}/data_scores_0_10.json", json_modifie(_score_vec)),
    Mutation("donnee_commune_renommee", "une commune renommée (n'existe plus dans le GeoJSON)", f"{WEB}/data_scores_0_10.json", json_modifie(_renommer)),
    Mutation("donnee_commune_supprimee", "une commune supprimée (359 au lieu de 360)", f"{WEB}/data_scores_0_10.json", json_modifie(_supprimer)),
    Mutation("seuil_jenks_modifie", "un seuil de Jenks décalé de 0,01", f"{WEB}/seuils_jenks_optimal_gvf.json", json_modifie(_seuil)),
    Mutation("cah_classe_modifiee", "une commune change de classe CAH", f"{WEB}/cah_5_clusters.json", json_modifie(_cah)),
    Mutation("lisa_cluster_incoherent", "un cluster LISA affiché pour une commune non significative", f"{WEB}/lisa_data_betti.js", lisa_modifie(_lisa)),
    Mutation("sous_composantes_absentes", "fichier sous_composantes.json supprimé", f"{WEB}/sous_composantes.json", None),
    # ---- formules et constantes dans script.js ---------------------------------------------------------------------
    Mutation("alpha_js", "α = 2,0 au lieu de 2,5 dans l'appli", f"{WEB}/script.js", remplacer("const alpha = 2.5;", "const alpha = 2.0;")),
    Mutation("poids_vec3_js_inverses", "poids Vec3 chômeur/aidé inversés dans l'appli (ancien défaut)", f"{WEB}/script.js",
             remplacer("c.chomeur * 0 + c.aide * 0.25", "c.chomeur * 0.25 + c.aide * 0")),
    Mutation("opp4_diviseur_2", "Opp4 = (4G + débit + fibre) / 2", f"{WEB}/script.js", remplacer("(c.g4 + c.debit + c.fibre) / 3", "(c.g4 + c.debit + c.fibre) / 2")),
    Mutation("pk_betti_sans_valeur_absolue", "p_k de Betti sans |corrélation|", f"{WEB}/script.js",
             remplacer("Math.abs(pearsonCorr(a, b))", "pearsonCorr(a, b)")),
    Mutation("bornes_recalculees", "bornes de normalisation recalculées à chaque modification (ancien défaut)", f"{WEB}/script.js",
             remplacer("normaliserDonnees(indicateurs, bornesRef.min, bornesRef.max)", "normaliserDonnees(indicateurs, minmax(indicateurs).min, minmax(indicateurs).max)")),
    Mutation("tolerance_curseur_retiree", "comparaison stricte value/defaultValue (ancien défaut : bruit de 1e-16 au recalcul)", f"{WEB}/script.js",
             remplacer("if (Math.abs(parseFloat(input.value) - parseFloat(input.defaultValue)) < 1e-9) return", "if (input.value === input.defaultValue) return"),
             suites=("js", "e2e"), attendu=("js", "e2e")),
    Mutation("reinit_sans_sous_composantes", "« Réinitialiser » oublie les sous-composantes", f"{WEB}/script.js",
             remplacer("    sousComposantesCommune = structuredClone(sousComposantesOrigine);\r\n    recalculerCarteOppChoVec();", "    recalculerCarteOppChoVec();")),
    Mutation("parts_vec3_non_couplees", "les parts d'emploi ne sont plus couplées", f"{WEB}/script.js", remplacer("if (def.parts) redistribuerParts", "if (false) redistribuerParts")),
    Mutation("mode_par_defaut_egal", "mode p_k par défaut = égal au lieu de Betti", f"{WEB}/script.js", remplacer("let modeCalculPk = 'betti';", "let modeCalculPk = 'egal';")),
    Mutation("description_cho1_exp", "description de Cho1 redevenue exp(-...)", f"{WEB}/script.js", remplacer("−log(nombre de personnes vivant", "exp(−nombre de personnes vivant")),
    Mutation("seuil_de_repli_perime", "seuil de repli codé en dur périmé", f"{WEB}/script.js", remplacer("oppchovec: [0, 2.28,", "oppchovec: [0, 2.30,")),
    Mutation("identifiant_dom_inexistant", "script.js lit un id absent de index.html", f"{WEB}/script.js", lambda t: t + "\r\ndocument.getElementById('id-qui-nexiste-pas');\r\n"),
    Mutation("syntaxe_cassee", "erreur de syntaxe JavaScript", f"{WEB}/script.js", lambda t: t + "\r\n}}}\r\n", suites=("python", "js", "e2e"), attendu=("python", "js", "e2e")),
    # ---- scripts Python ------------------------------------------------------------------------------------------
    Mutation("poids_vec3_exporteur_anciens", "ancien poids Vec3 dans exporter_sous_composantes.py", f"{PY}/exporter_sous_composantes.py",
             lambda t: remplacer('"chomeur": ("Chomeur (1)", 0)', '"chomeur": ("Chomeur (1)", 0.25)')(remplacer('"aide": ("Emploi aidé (2)", 0.25)', '"aide": ("Emploi aidé (2)", 0)')(t))),
    Mutation("poids_vec3_oppchovec_anciens", "ancien POND_VEC3 dans oppchovec.py", f"{PY}/oppchovec.py", remplacer("POND_VEC3 = [1, 0.75, 0.5, 0, 0.25]", "POND_VEC3 = [1, 0.75, 0.5, 0.25, 0]")),
    Mutation("alpha_regeneration", "α modifié dans regenerer_data_scores.py", f"{PY}/regenerer_data_scores.py", remplacer("ALPHA, BETA = 2.5, 1.5", "ALPHA, BETA = 2.0, 1.5")),
    # ---- documentation ------------------------------------------------------------------------------------------
    Mutation("doc_seuil_perime", "un seuil du README_FICHIERS.md ne correspond plus aux données", f"{WEB}/README_FICHIERS.md", remplacer("Classe 2 : 2.28 - 3.94", "Classe 2 : 2.41 - 3.94")),
    Mutation("doc_fichier_inexistant", "le README cite un fichier qui n'existe pas", f"{WEB}/README_FICHIERS.md", remplacer("**sous_composantes.json**", "**sous_composantes_v2.json**")),
    Mutation("doc_echelle_trop_etroite", "une échelle documentée plus étroite que les données", "stage_ambroise/Code/VERIFICATION_COHERENCE_DONNEES.md", remplacer("**Vec4** : 0 à 5300", "**Vec4** : 0 à 5000")),
    # ---- comportements visibles dans le navigateur -------------------------------------------------------------------
    Mutation("jenks_borne_exclusive_cartes", "carte : une valeur égale à un seuil passe dans la classe supérieure", f"{WEB}/script.js",
             remplacer("""        for (let i = 1; i < seuils.length - 1; i++) {\r\n            if (value <= seuils[i]) {\r\n                return colorsJenks[i - 1];""",
                       """        for (let i = 1; i < seuils.length - 1; i++) {\r\n            if (value < seuils[i]) {\r\n                return colorsJenks[i - 1];"""),
             suites=("e2e",), attendu=("e2e",)),
    Mutation("histogramme_borne_exclusive", "histogramme : seuil exclu de sa classe", f"{WEB}/script.js",
             remplacer("item.score >= seuils[i] && item.score <= seuils[i + 1]", "item.score >= seuils[i] && item.score < seuils[i + 1]"), suites=("e2e",), attendu=("e2e",)),
    Mutation("top10_tri_inverse", "top 10 trié à l'envers", f"{WEB}/script.js",
             remplacer("})).sort((a, b) => b.score - a.score);", "})).sort((a, b) => a.score - b.score);"), suites=("e2e",), attendu=("e2e",)),
    Mutation("parangons_tri_inverse", "parangons triés du plus éloigné au plus proche de la moyenne", f"{WEB}/script.js",
             remplacer("Math.abs(a.score - cl.mean) - Math.abs(b.score - cl.mean)", "Math.abs(b.score - cl.mean) - Math.abs(a.score - cl.mean)"), suites=("e2e",), attendu=("e2e",)),
    Mutation("css_croix_bulle_masquee", "ancienne règle CSS : la croix ✕ de la bulle d'info est masquée", f"{WEB}/dashboard.css",
             remplacer(".indicateur-row button:not(.info-button):not(.info-close-button) {", ".indicateur-row button {"), suites=("e2e",), attendu=("e2e",)),
    Mutation("minuterie_invalidate_sans_garde", "invalidateSize différé sans protection (course avec la bascule p_k)", f"{WEB}/script.js",
             remplacer("try { carte.invalidateSize(); } catch (e) { /* carte détruite entre-temps : rien à redimensionner */ }", "carte.invalidateSize();"),
             suites=("e2e",), attendu=("e2e",)),
    Mutation("reliquat_numbered_reintroduit", "ligne visant l'onglet « Numbered » inexistant (erreur console au chargement)", f"{WEB}/script.js",
             lambda t: t + "\r\ndocument.querySelector('[data-tab=\"numberedtab\"]').addEventListener('click', function() {});\r\n",
             suites=("python", "e2e"), attendu=("python", "e2e")),
    Mutation("graphique_cah_sans_5_classes", "liste par défaut [3, 4] : plus de graphique à 5 classes", f"{PY}/graphique_ecarts_types_cah.py",
             remplacer("n_clusters_list = [3, 4, 5]", "n_clusters_list = [3, 4]")),
    Mutation("correlation_r_biaisee", "coefficient de corrélation faussé", f"{WEB}/script.js",
             remplacer("const r = ss_xy / Math.sqrt(ss_xx * ss_yy);", "const r = 0.97 * ss_xy / Math.sqrt(ss_xx * ss_yy);"), suites=("e2e",), attendu=("e2e",)),
]


def preparer_bac(dest):
    for chemin in A_COPIER:
        source = RACINE / chemin
        cible = dest / chemin
        if source.is_dir():
            shutil.copytree(source, cible, ignore=IGNORER)
        else:
            cible.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, cible)


def lancer_couche(bac, couche):
    option = {"python": [], "js": [], "e2e": ["--e2e"]}[couche]
    # python et js sont lancés ensemble (--rapide) ; on lit le bilan par ligne
    cmd = [sys.executable, "tests/run_tests.py"] + (["--rapide"] if couche != "e2e" else option)
    r = subprocess.run(cmd, cwd=bac, capture_output=True, text=True, encoding="utf-8", errors="replace")
    sortie = r.stdout
    detectees = set()
    for ligne in sortie.splitlines():
        m = re.match(r"\s+(Python|JavaScript|Navigateur)\b.*?(\d+) échec", ligne)
        if m and int(m.group(2)) > 0:
            detectees.add({"Python": "python", "JavaScript": "js", "Navigateur": "e2e"}[m.group(1)])
    if "TOTAL :" not in sortie:
        raise SortieIllisible(f"run_tests.py n'a pas produit de bilan (processus interrompu ?) : {sortie[-200:]!r} {r.stderr[-200:]!r}")
    return detectees, r.returncode


class SortieIllisible(RuntimeError):
    """La suite a été interrompue (arrêt du processus, machine suspendue…) : ce n'est PAS une absence de détection."""


def lancer_avec_reprise(bac, couche, essais=2):
    for essai in range(essais):
        try:
            return lancer_couche(bac, couche)
        except SortieIllisible as e:
            if essai == essais - 1:
                raise
            print(f"  (sortie illisible, nouvel essai : {str(e)[:100]})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--liste", action="store_true")
    ap.add_argument("--sans-e2e", action="store_true")
    ap.add_argument("--seulement", nargs="+")
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)   # résultats visibles au fil de l'eau, même redirigés

    choisies = [m for m in MUTATIONS if (not args.seulement or m.nom in args.seulement)]
    if args.sans_e2e:
        choisies = [m for m in choisies if "e2e" not in m.attendu]
    if args.liste:
        for m in MUTATIONS:
            print(f"{m.nom:<34} {','.join(m.suites):<14} {m.description}")
        return 0

    with tempfile.TemporaryDirectory() as tmp:
        bac = Path(tmp)
        print(f"Copie du projet dans {bac} ...")
        preparer_bac(bac)
        print("Contrôle préalable : la suite doit être verte sur la copie intacte")
        detectees, code = lancer_couche(bac, "python")
        if code != 0 or detectees:
            print("  ÉCHEC : la suite n'est pas verte avant mutation, abandon.")
            return 2
        print(f"\n{'mutation':<34} {'détectée par':<22} résultat")
        manques, inconcluantes = [], []
        for m in choisies:
            cible = bac / m.fichier
            original = cible.read_bytes()
            try:
                if m.transformer is None:
                    cible.unlink()
                else:
                    cible.write_bytes(m.transformer(original.decode("utf-8")).encode("utf-8"))
                trouvees = set()
                try:
                    for couche in (("python",) if "python" in m.suites or "js" in m.suites else ()) + (("e2e",) if "e2e" in m.suites else ()):
                        d, _ = lancer_avec_reprise(bac, couche)
                        trouvees |= d
                except SortieIllisible as e:
                    print(f"{m.nom:<34} {'?':<22} NON CONCLUANT (suite interrompue) — {m.description}")
                    inconcluantes.append(m.nom)
                    continue
            finally:
                cible.parent.mkdir(parents=True, exist_ok=True)
                cible.write_bytes(original)
            ok = bool(trouvees) and set(m.attendu) <= trouvees
            etiquette = ", ".join(sorted(trouvees)) or "AUCUNE"
            print(f"{m.nom:<34} {etiquette:<22} {'détectée' if ok else '*** NON DÉTECTÉE ***'}  — {m.description}")
            if not ok:
                manques.append(m.nom)
        print(f"\n{len(choisies) - len(manques) - len(inconcluantes)}/{len(choisies)} mutations détectées")
        if manques:
            print("Lacunes des tests (mutations non détectées) :", ", ".join(manques))
        if inconcluantes:
            print("Non concluantes (à relancer) :", ", ".join(inconcluantes))
        return 1 if (manques or inconcluantes) else 0


if __name__ == "__main__":
    sys.exit(main())
