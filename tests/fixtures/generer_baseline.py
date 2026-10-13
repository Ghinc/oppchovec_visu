"""
Fige deux états de référence à partir de l'historique git :

  baseline_*          commit 4438162 : AVANT la correction des poids de Vec3
  avant_opp1_*        commit 9c8a310 : APRÈS la correction de Vec3 et AVANT le remplacement d'Opp1 (éducation)
                                       par le niveau de diplôme communal INSEE

Produit dans ce dossier, pour chacun :
  <préfixe>_data_scores_0_10.json   copie exacte de data_scores_0_10.json à ce commit
  <préfixe>_derives.json            version compacte des fichiers dérivés à ce commit
                                    (seuils Jenks, clusters LISA, clusters CAH)

Ces fichiers servent de référence aux tests de non-régression (tests/python/test_04_non_regression.py).
À ne régénérer que pour changer volontairement de référence (et le dire dans tests/README.md).
Usage : python tests/fixtures/generer_baseline.py
"""
import json
import re
import subprocess
from pathlib import Path

REFERENCES = {"baseline": "4438162", "avant_opp1": "9c8a310"}
WEB = "stage_ambroise/Code/WEB/"
ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[1]


def git_show(commit, chemin):
    return subprocess.run(["git", "show", f"{commit}:{WEB}{chemin}"], cwd=RACINE, check=True,
                          capture_output=True).stdout.decode("utf-8")


def const_js(texte):
    return json.loads(re.search(r"= (\{.*\});", texte, re.S).group(1))


def figer(prefixe, commit):
    brut = git_show(commit, "data_scores_0_10.json")
    (ICI / f"{prefixe}_data_scores_0_10.json").write_text(brut, encoding="utf-8")

    derives = {"source_commit": commit}
    derives["jenks_gvf"] = {k: v["breaks"] for k, v in json.loads(git_show(commit, "seuils_jenks_optimal_gvf.json")).items()
                            if k != "metadata"}
    derives["lisa"] = {}
    for cle, fichier in {"egal_5": "lisa_data.js", "egal_1": "lisa_data_1pct.js",
                         "betti_5": "lisa_data_betti.js", "betti_1": "lisa_data_betti_1pct.js"}.items():
        d = const_js(git_show(commit, fichier))
        derives["lisa"][cle] = {
            "moran_I": d["metadata"]["moran_global_I"],
            "nb_significatives": d["metadata"]["nb_significatives"],
            "clusters": {c: v["cluster"] for c, v in d["clusters"].items()},
        }
    derives["cah"] = {str(n): {c: v["cluster"] for c, v in json.loads(git_show(commit, f"cah_{n}_clusters.json"))["clusters"].items()}
                      for n in (3, 5)}
    (ICI / f"{prefixe}_derives.json").write_text(json.dumps(derives, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    for prefixe, commit in REFERENCES.items():
        figer(prefixe, commit)
    print("OK :", sorted(p.name for p in ICI.glob("*.json")))


if __name__ == "__main__":
    main()
