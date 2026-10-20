"""
Archive des SOURCES BRUTES de l'indice courant « v1 » (millésimes hétérogènes 2020-2024), pour pouvoir le refaire après le remplacement des données.

Les fichiers sources (xlsx, csv) ne sont pas dans le dépôt (voir .gitignore). `archiver` les consigne dans UN seul JSON versionné
(Données/archive_indice_v1_2020_2024/sources_brutes_indice_v1.json : colonnes et lignes de chaque fichier + empreinte SHA-256 de l'original) ;
`restaurer` recrée les fichiers dans un dossier, avec les mêmes noms et les mêmes colonnes, ce qui permet de relancer l'ancien calcul
(exporter_sous_composantes.py, et la chaîne décrite dans WEB/README_FICHIERS.md).

L'état du code et des fichiers de l'appli à cette date est conservé par l'étiquette Git « indice-courant-v1-2020-2024 ».

Usage (depuis stage_ambroise/Code/Python/) :
    python archive_indice_v1.py archiver "<dossier du stage>"      # ex. C:/These/Données2/visualisation_oppchovec_1111/Stage Ambroise
    python archive_indice_v1.py restaurer "<dossier de sortie>"    # recrée Données/Corse_Commune/*.xlsx, *.csv dans ce dossier
"""

import hashlib
import json
import sys
from pathlib import Path

import pandas as pd

ARCHIVE = Path(__file__).resolve().parents[2] / "Données" / "archive_indice_v1_2020_2024" / "sources_brutes_indice_v1.json"
# fichier -> sous-dossier du dossier du stage
FICHIERS = {
    "Opp2.xlsx": "Données/Corse_Commune", "Opp3.xlsx": "Données/Corse_Commune", "Opp4.xlsx": "Données/Corse_Commune",
    "fibre_corse.csv": "Données/Corse_Commune", "Cho1_personnes.xlsx": "Données/Corse_Commune", "Cho2_francais_18plus.xlsx": "Données/Corse_Commune",
    "Vec1.xlsx": "Données/Corse_Commune", "vec2_lb.csv": "Données/Corse_Commune", "Vec3.xlsx": "Données/Corse_Commune", "Vec4.xlsx": "Données/Corse_Commune",
    "mapping_communes.csv": "Données/Corse_Commune", "population_corse.xlsx": "Données/Corse_Commune",
    "services_accessibles_20min_local.csv": "Code/Python",
}


def sha(chemin):
    return hashlib.sha256(Path(chemin).read_bytes()).hexdigest()


def archiver(dossier):
    dossier = Path(dossier)
    sortie = {"description": "Sources brutes de l'indice courant v1 (millésimes 2020-2024), consignées avant leur remplacement", "fichiers": {}}
    for nom, sous in FICHIERS.items():
        chemin = dossier / sous / nom
        if not chemin.exists():
            print("ABSENT :", chemin)
            continue
        df = pd.read_csv(chemin) if nom.endswith(".csv") else pd.read_excel(chemin)
        sortie["fichiers"][nom] = {"sha256_original": sha(chemin), "taille_octets": chemin.stat().st_size, "dossier_d_origine": sous,
                                   "donnees": json.loads(df.to_json(orient="split", force_ascii=False))}
        print(f"{nom} : {df.shape[0]} lignes, {df.shape[1]} colonnes")
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    ARCHIVE.write_text(json.dumps(sortie, ensure_ascii=False), encoding="utf-8")
    print("écrit :", ARCHIVE, f"({ARCHIVE.stat().st_size / 1e6:.2f} Mo)")


def restaurer(sortie):
    sortie = Path(sortie)
    archive = json.loads(ARCHIVE.read_text(encoding="utf-8"))
    for nom, f in archive["fichiers"].items():
        df = pd.DataFrame(**{k: f["donnees"][k] for k in ("columns", "data")}, index=f["donnees"]["index"])
        chemin = sortie / f["dossier_d_origine"] / nom
        chemin.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(chemin, index=False) if nom.endswith(".csv") else df.to_excel(chemin, index=False)
        print("restauré :", chemin)


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("archiver", "restaurer"):
        sys.exit(__doc__)
    (archiver if sys.argv[1] == "archiver" else restaurer)(sys.argv[2])
