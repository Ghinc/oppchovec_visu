"""Exporte les éléments bruts du calcul de chaque indicateur de chaque commune (effectifs par niveau de diplôme, revenus et foyers fiscaux, etc.)
dans WEB/details_calcul.json, pour le menu déroulant « Voir le calcul » du panneau commune.

Lit Données/indice_v2/sources_indice_v2.json (produit par construire_indice_v2.py). Aucun argument.
Le fichier garde, pour chaque commune et chaque indicateur, `valeur` (celle de l'indicateur) et ses composantes ; le code INSEE est conservé.
"""
import json
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
SOURCE = RACINE / "Données" / "indice_v2" / "sources_indice_v2.json"
SORTIE = RACINE / "Code" / "WEB" / "details_calcul.json"


def arrondi(x):
    return round(x, 4) if isinstance(x, float) else x


def main():
    d = json.loads(SOURCE.read_text(encoding="utf-8"))["communes"]
    sortie = {nom: {k: ({a: arrondi(b) for a, b in v.items()} if isinstance(v, dict) else v) for k, v in c.items()} for nom, c in d.items()}
    SORTIE.write_text(json.dumps(sortie, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(sortie)} communes écrites dans {SORTIE}")


if __name__ == "__main__":
    main()
