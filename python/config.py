"""
Configuration centralisée de l'indice OppChoVec.

Toutes les constantes (paramètres algorithmiques, chemins, noms de colonnes)
sont définies ici pour éviter toute duplication entre modules.
"""

import os
from pathlib import Path

# ==============================================================================
# PARAMÈTRES DE L'ALGORITHME
# ==============================================================================

ALPHA: float = 2.5  # Paramètre d'aversion à la pauvreté
BETA: float = 1.5   # Paramètre de complémentarité entre dimensions

# Pondérations des indicateurs au sein de chaque dimension
PONDERATIONS: dict = {
    'Opp': {'Opp1': 0.25, 'Opp2': 0.25, 'Opp3': 0.25, 'Opp4': 0.25},
    'Cho': {'Cho1': 0.50, 'Cho2': 0.50},
    'Vec': {'Vec1': 0.25, 'Vec2': 0.25, 'Vec3': 0.25, 'Vec4': 0.25}
}

# Pondérations finales des dimensions [Opp, Cho, Vec]
POND_FINALE: list = [1, 1, 1]

# Pondérations pour Vec3 (catégories d'emploi, du plus stable au moins stable)
POND_VEC3: list = [1, 0.75, 0.5, 0.25, 0]

# ==============================================================================
# CHEMINS DES DONNÉES
# ==============================================================================

# Chemin absolu vers les données source (configurable via variable d'environnement)
_default_data_dir = Path(r"C:\These\outil_visu_lebon\Stage Ambroise\Données\Corse_Commune")
DATA_DIR: Path = Path(os.environ.get("OPPCHOVEC_DATA_DIR", str(_default_data_dir)))

# Fichiers d'entrée
INPUT_FILES: dict = {
    'Opp1': DATA_DIR / "Opp1.xlsx",
    'Opp2': DATA_DIR / "Opp2.xlsx",
    'Opp3': DATA_DIR / "Opp3.xlsx",
    'Opp4': DATA_DIR / "Opp4.xlsx",
    'Cho1': DATA_DIR / "Cho1_personnes.xlsx",
    'Cho2': DATA_DIR / "Cho2.xlsx",
    'Vec1': DATA_DIR / "Vec1.xlsx",
    'Vec2': DATA_DIR / "vec2_lb.csv",
    'Vec3': DATA_DIR / "Vec3.xlsx",
    'Vec4': DATA_DIR / "services_accessibles_20min_local.csv",
}

# Fichier de mapping code INSEE → nom de commune
MAPPING_FILE: Path = DATA_DIR / "mapping_communes.csv"

# Colonnes à lire dans chaque fichier source
COLONNES: dict = {
    'Opp1': "Niveau d'education moyen",
    'Opp2': "Indice de Theil",
    'Opp3': [
        "Part des ménages ayant au moins 1 voiture 2021",
        "Accès aux réseaux de transport"
    ],
    'Opp4': [
        "Proportion de population avec débit > 30Mb/s",
        "Proportion de population couverte par la 4G"
    ],
    'Cho1': "Nb_Personnes_Quartiers_Prioritaires",
    'Cho2': "Proportion",
    'Vec1': "Médiane du niveau de vie 2021",
    'Vec2': ["pers_par_piece_moy", "pct_avec_sdb", "pct_chauffage", "pct_maisons"],
    'Vec3': [
        "Emploi stable (5)",
        "Contrat à durée déterminée (4)",
        "Contrat ponctuel (3)",
        "Chomeur (1)",
        "Emploi aidé (2)"
    ],
    'Vec4': "nb_services_20min",
}

# Communes disposant d'un vrai réseau de bus (bonus +100 pour Opp3)
VILLES_RESEAU_BUS: list = ['2A004', '2B033', '2A247', 'Ajaccio', 'Bastia', 'Porto-Vecchio']

# ==============================================================================
# CHEMINS DE SORTIE
# ==============================================================================

# Les fichiers de sortie sont créés dans le dossier courant d'exécution
OUTPUT_DIR: Path = Path(".")
OUTPUT_JSON: Path = OUTPUT_DIR / "data_indicateurs.json"
OUTPUT_INDICATEURS_XLSX: Path = OUTPUT_DIR / "df_indicateur.xlsx"
OUTPUT_DIMENSIONS_XLSX: Path = OUTPUT_DIR / "dimensions_V.xlsx"
OUTPUT_OPPCHOVEC_XLSX: Path = OUTPUT_DIR / "oppchovec_resultats_V.xlsx"
OUTPUT_STATS_XLSX: Path = OUTPUT_DIR / "stats_descriptives_V.xlsx"
