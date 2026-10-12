"""
Fige l'état de référence « avant correction des poids Vec3 » à partir du commit 4438162 (git).

Produit dans ce dossier :
  baseline_data_scores_0_10.json   copie exacte de data_scores_0_10.json à ce commit
  baseline_derives.json            version compacte des fichiers dérivés à ce commit
                                   (seuils Jenks, clusters LISA, clusters CAH)

Ces fichiers servent de référence aux tests de non-régression. À ne régénérer que pour changer
volontairement de référence (et le dire dans tests/README.md).
Usage : python tests/fixtures/generer_baseline.py
"""
import json
import re
import subprocess
from pathlib import Path

COMMIT = "4438162"
WEB = "stage_ambroise/Code/WEB/"
ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[1]


def git_show(chemin):
    return subprocess.run(["git", "show", f"{COMMIT}:{WEB}{chemin}"], cwd=RACINE, check=True,
                          capture_output=True).stdout.decode("utf-8")


def const_js(texte):
    return json.loads(re.search(r"= (\{.*\});", texte, re.S).group(1))


def main():
    brut = git_show("data_scores_0_10.json")
    (ICI / "baseline_data_scores_0_10.json").write_text(brut, encoding="utf-8")

    derives = {"source_commit": COMMIT}
    derives["jenks_gvf"] = {k: v["breaks"] for k, v in json.loads(git_show("seuils_jenks_optimal_gvf.json")).items()
                            if k != "metadata"}
    derives["lisa"] = {}
    for cle, fichier in {"egal_5": "lisa_data.js", "egal_1": "lisa_data_1pct.js",
                         "betti_5": "lisa_data_betti.js", "betti_1": "lisa_data_betti_1pct.js"}.items():
        d = const_js(git_show(fichier))
        derives["lisa"][cle] = {
            "moran_I": d["metadata"]["moran_global_I"],
            "nb_significatives": d["metadata"]["nb_significatives"],
            "clusters": {c: v["cluster"] for c, v in d["clusters"].items()},
        }
    derives["cah"] = {str(n): {c: v["cluster"] for c, v in json.loads(git_show(f"cah_{n}_clusters.json"))["clusters"].items()}
                      for n in (3, 5)}
    (ICI / "baseline_derives.json").write_text(json.dumps(derives, ensure_ascii=False, indent=1), encoding="utf-8")
    print("OK :", [p.name for p in ICI.glob("baseline_*.json")])


if __name__ == "__main__":
    main()
