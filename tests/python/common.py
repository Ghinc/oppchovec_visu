"""Utilitaires communs aux tests Python (stdlib uniquement ; les libs scientifiques sont importées à la demande)."""
import importlib
import json
import math
import os
import re
import sys
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
STAGE = RACINE / "stage_ambroise"
WEB = STAGE / "Code" / "WEB"
PYDIR = STAGE / "Code" / "Python"
GEOJSON = STAGE / "Données" / "Commune_Corse.geojson"
FIXTURES = RACINE / "tests" / "fixtures"

INDICATEURS = ["Opp1", "Opp2", "Opp3", "Opp4", "Cho1", "Cho2", "Vec1", "Vec2", "Vec3", "Vec4"]
DIMENSIONS = {"Opp": ["Opp1", "Opp2", "Opp3", "Opp4"], "Cho": ["Cho1", "Cho2"], "Vec": ["Vec1", "Vec2", "Vec3", "Vec4"]}
CHAMPS_SCORES = ["OppChoVec", "Score_Opp", "Score_Cho", "Score_Vec",
                 "OppChoVec_0_10", "Score_Opp_0_10", "Score_Cho_0_10", "Score_Vec_0_10"]
ALPHA, BETA = 2.5, 1.5

# Les archives anciennes utilisent d'autres noms pour deux communes
ALIAS_NOMS_ANCIENS = {"La Porta": "Porta", "L'Île-Rousse": "Île-Rousse"}

SLOW = os.environ.get("OPPCHOVEC_SLOW") == "1"
SOURCES_CANDIDATES = [
    os.environ.get("OPPCHOVEC_SOURCES", ""),
    r"C:\These\Données2\visualisation_oppchovec_1111\Stage Ambroise",
    r"C:\These\outil_visu_lebon\Stage Ambroise",
]


def charger_json(chemin):
    return json.loads(Path(chemin).read_text(encoding="utf-8"))


def charger_const_js(chemin, nom=None):
    """Lit un fichier `const NOM = {...};` (plusieurs constantes possibles) et renvoie {nom: objet}."""
    texte = Path(chemin).read_text(encoding="utf-8")
    blocs = {m.group(1): json.loads(m.group(2)) for m in re.finditer(r"const (\w+) = (\{.*?\n\});", texte, re.S)}
    return blocs[nom] if nom else blocs


def donnees_actuelles():
    return charger_json(WEB / "data_scores_0_10.json")


def dossier_sources():
    for c in SOURCES_CANDIDATES:
        if c and (Path(c) / "Données" / "Corse_Commune" / "fibre_corse.csv").exists():
            return Path(c)
    return None


def libs_disponibles(*modules):
    for m in modules:
        try:
            importlib.import_module(m)
        except Exception:
            return False
    return True


def exige_libs(*modules):
    return unittest.skipUnless(libs_disponibles(*modules), f"modules manquants : {', '.join(modules)}")


def exige_sources():
    return unittest.skipUnless(dossier_sources() is not None and libs_disponibles("pandas", "openpyxl"),
                               "données sources brutes introuvables (définir OPPCHOVEC_SOURCES) ou pandas/openpyxl absents")


def lent():
    return unittest.skipUnless(SLOW, "test lent : définir OPPCHOVEC_SLOW=1")


# --------------------------------------------------------------------------------------------------
# Implémentation de référence, indépendante du code de l'appli (stdlib pure)
# --------------------------------------------------------------------------------------------------
def min_max(valeurs):
    """{commune: x} -> {commune: (x-min)/(max-min)} ; colonne constante -> 0."""
    mn, mx = min(valeurs.values()), max(valeurs.values())
    return {c: ((v - mn) / (mx - mn) if mx != mn else 0.0) for c, v in valeurs.items()}


def bornes_indicateurs(data):
    return {k: (min(d[k] for d in data.values()), max(d[k] for d in data.values())) for k in INDICATEURS}


def scores_01(indicateurs, bornes):
    """indicateurs {commune: {ind: x}}, bornes figées {ind: (min, max)} -> {commune: {Opp, Cho, Vec}} dans [0, 1]."""
    sortie = {}
    for c, ind in indicateurs.items():
        norm = {k: ((ind[k] - bornes[k][0]) / (bornes[k][1] - bornes[k][0]) if bornes[k][1] != bornes[k][0] else 0.0)
                for k in INDICATEURS}
        sortie[c] = {dim: sum(norm[k] for k in ks) / len(ks) for dim, ks in DIMENSIONS.items()}
    return sortie


def indice_brut(s01, pk=(1, 1, 1)):
    return {c: (1 / 3) * sum(p * s[dim] ** BETA for p, dim in zip(pk, ("Opp", "Cho", "Vec"))) ** (ALPHA / BETA)
            for c, s in s01.items()}


def pk_betti(s01):
    """p_k = cv_k x 1/mean|rho_k,k'|, normalisé pour sommer à 1 (Betti et al., 2008), sur les scores 0-1."""
    communes = list(s01)
    cols = [[s01[c][d] for c in communes] for d in ("Opp", "Cho", "Vec")]
    n = len(communes)
    moy = [sum(c) / n for c in cols]
    cv = [math.sqrt(sum((x - m) ** 2 for x in c) / n) / m for c, m in zip(cols, moy)]

    def pearson(a, b):
        ma, mb = sum(a) / n, sum(b) / n
        num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
        return num / math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))

    p2 = [1 / (sum(abs(pearson(a, b)) for b in cols) / 3) for a in cols]
    brut = [c * p for c, p in zip(cv, p2)]
    return [v / sum(brut) for v in brut]


def vers_0_10(valeurs):
    return {c: v * 10 for c, v in min_max(valeurs).items()}


def recalcul_complet(indicateurs):
    """Reproduit data_scores_0_10.json depuis les 10 indicateurs : min-max, scores de dimension, indice."""
    bornes = bornes_indicateurs(indicateurs)
    s01 = scores_01(indicateurs, bornes)
    sortie = {c: {} for c in indicateurs}
    for dim in ("Opp", "Cho", "Vec"):
        s010 = vers_0_10({c: s[dim] for c, s in s01.items()})
        for c in indicateurs:
            sortie[c][f"Score_{dim}"] = s01[c][dim]
            sortie[c][f"Score_{dim}_0_10"] = s010[c]
    brut = indice_brut(s01)
    occ010 = vers_0_10(brut)
    for c in indicateurs:
        sortie[c]["OppChoVec"] = brut[c]
        sortie[c]["OppChoVec_0_10"] = occ010[c]
    return sortie


def spearman(a, b):
    def rangs(v):
        ordre = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        for pos, i in enumerate(ordre):
            r[i] = pos
        return r
    ra, rb = rangs(a), rangs(b)
    n = len(a)
    ma = sum(ra) / n
    num = sum((x - ma) * (y - ma) for x, y in zip(ra, rb))
    return num / math.sqrt(sum((x - ma) ** 2 for x in ra) * sum((y - ma) ** 2 for y in rb))


def classe_jenks(valeur, seuils_internes):
    """Convention de l'appli et de jenkspy : une valeur égale à un seuil appartient à la classe inférieure."""
    return sum(1 for b in seuils_internes if valeur > b)


# --------------------------------------------------------------------------------------------------
# Comparaison structurelle de deux objets JSON (avec tolérance numérique) et miroir d'exécution des scripts
# --------------------------------------------------------------------------------------------------
def differences(a, b, tol=1e-9, chemin="", max_diff=10):
    """Liste (tronquée) des différences entre deux structures JSON ; nombres comparés à `tol` (relative)."""
    sortie = []

    def rec(x, y, p):
        if len(sortie) >= max_diff:
            return
        if isinstance(x, dict) and isinstance(y, dict):
            for k in sorted(set(x) | set(y), key=str):
                if k not in x or k not in y:
                    sortie.append(f"{p}/{k} : {'absent du second' if k not in y else 'absent du premier'}")
                else:
                    rec(x[k], y[k], f"{p}/{k}")
        elif isinstance(x, list) and isinstance(y, list):
            if len(x) != len(y):
                sortie.append(f"{p} : longueurs {len(x)} / {len(y)}")
            for i, (u, v) in enumerate(zip(x, y)):
                rec(u, v, f"{p}[{i}]")
        elif isinstance(x, (int, float)) and isinstance(y, (int, float)) and not isinstance(x, bool):
            if abs(x - y) > tol * max(1.0, abs(x)):
                sortie.append(f"{p} : {x} / {y}")
        elif x != y:
            sortie.append(f"{p} : {str(x)[:50]!r} / {str(y)[:50]!r}")

    rec(a, b, chemin)
    return sortie


# --------------------------------------------------------------------------------------------------
# Rejeu des scripts de la racine (gen_*.py) sur une copie : chemins.py honore OPPCHOVEC_RACINE
# --------------------------------------------------------------------------------------------------
SCRIPTS_RACINE = ("gen_excel_010.py", "gen_comparaison.py", "gen_top5_betti.py", "gen_appendix2.py", "gen_lisa_knn5.py", "gen_lisa_betti.py")


def copie_du_projet(destination):
    """Copie minimale (scripts de la racine + données qu'ils lisent) ; avec OPPCHOVEC_RACINE, ils écrivent DANS cette copie."""
    import shutil
    destination = Path(destination)
    for nom in ("chemins.py", *SCRIPTS_RACINE):
        shutil.copy(RACINE / nom, destination / nom)
    web = destination / "stage_ambroise" / "Code" / "WEB"
    web.mkdir(parents=True)
    for nom in ("data_scores_0_10.json", "cah_5_clusters.json"):
        shutil.copy(WEB / nom, web / nom)
    (destination / "stage_ambroise" / "Données").mkdir()
    shutil.copy(GEOJSON, destination / "stage_ambroise" / "Données" / "Commune_Corse.geojson")


def lancer_script_racine(copie, script, *args, timeout=900):
    import subprocess
    env = {**os.environ, "OPPCHOVEC_RACINE": str(copie), "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "MPLBACKEND": "Agg"}
    return subprocess.run([sys.executable, "-X", "utf8", str(Path(copie) / script), *args], cwd=copie, env=env,
                          capture_output=True, text=True, encoding="utf-8", timeout=timeout)
