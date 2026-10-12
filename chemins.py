"""Chemins communs aux scripts de la racine (gen_*.py) : tout est relatif à l'emplacement du dépôt, rien n'est codé en dur.

Les scripts lisent les fichiers de stage_ambroise/Code/WEB/ de CE dépôt et écrivent dans le dépôt :
  - SORTIE    stage_ambroise/Code/OUTPUT/  tableaux de l'article (non versionnés : *.xlsx est ignoré par git)
  - DOWNLOADS downloads/                   fichiers proposés au téléchargement par le site (versionnés)

Pour rejouer un script sur une copie (tests), définir OPPCHOVEC_RACINE = racine de la copie.
"""
import os
from pathlib import Path

RACINE = Path(os.environ.get("OPPCHOVEC_RACINE") or Path(__file__).resolve().parent)
STAGE = RACINE / "stage_ambroise"
WEB = STAGE / "Code" / "WEB"
GEOJSON = STAGE / "Données" / "Commune_Corse.geojson"
SORTIE = STAGE / "Code" / "OUTPUT"
DOWNLOADS = RACINE / "downloads"


def dossier(chemin):
    """Crée le dossier s'il n'existe pas et le renvoie."""
    chemin.mkdir(parents=True, exist_ok=True)
    return chemin
