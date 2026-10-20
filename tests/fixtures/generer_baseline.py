"""
Fige deux états de référence de data_scores_0_10.json à partir de l'historique git :

  baseline_data_scores_0_10.json   commit 4438162 : AVANT la correction des poids de Vec3 (état d'origine du pipeline Python)
  v1_data_scores_0_10.json         étiquette `indice-courant-v1-2020-2024` : indice courant v1 (millésimes 2020-2024), AVANT le remplacement des sources par la v2 (2023-2025)

Ces fichiers servent de référence aux tests de non-régression (tests/python/test_04_non_regression.py).
À ne régénérer que pour changer volontairement de référence (et le dire dans tests/README.md).
Usage : python tests/fixtures/generer_baseline.py
"""
import subprocess
from pathlib import Path

REFERENCES = {"baseline": "4438162", "v1": "indice-courant-v1-2020-2024"}
WEB = "stage_ambroise/Code/WEB/"
ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[1]


def git_show(reference, chemin):
    return subprocess.run(["git", "show", f"{reference}:{WEB}{chemin}"], cwd=RACINE, check=True, capture_output=True).stdout.decode("utf-8")


def main():
    for prefixe, reference in REFERENCES.items():
        (ICI / f"{prefixe}_data_scores_0_10.json").write_text(git_show(reference, "data_scores_0_10.json"), encoding="utf-8")
    print("OK :", sorted(p.name for p in ICI.glob("*.json")))


if __name__ == "__main__":
    main()
