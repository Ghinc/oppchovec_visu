"""
Export des résultats OppChoVec vers JSON et Excel.

Le JSON produit respecte le schéma attendu par le frontend web :
{
  "0": {
    "Zone": "Ajaccio",
    "Opp1": ..., ..., "Vec4": ...,
    "Score_Opp_1_10": ...,
    "Score_Cho_1_10": ...,
    "Score_Vec_1_10": ...,
    "OppChoVec_1_10": ...
  }, ...
}
"""

import json
import math
import pandas as pd
from pathlib import Path
from typing import List

from config import (
    OUTPUT_JSON, OUTPUT_INDICATEURS_XLSX, OUTPUT_DIMENSIONS_XLSX,
    OUTPUT_OPPCHOVEC_XLSX, OUTPUT_STATS_XLSX
)


def exporter_json(df_complet: pd.DataFrame, output_path: Path = OUTPUT_JSON) -> None:
    """
    Exporte le DataFrame complet (indicateurs + scores + indice) au format JSON.

    Le JSON est indexé numériquement et chaque entrée contient le nom
    de la commune sous la clé "Zone".

    Args:
        df_complet: DataFrame avec toutes les colonnes (Zone en index ou colonne)
        output_path: Chemin du fichier de sortie
    """
    data_dict = {}
    df = df_complet.reset_index()

    for i, (_, row) in enumerate(df.iterrows()):
        entry = {}
        for col in df.columns:
            val = row[col]
            # Convertir NaN et Inf en None pour JSON valide
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                entry[col] = None
            else:
                entry[col] = val
        data_dict[str(i)] = entry

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data_dict, f, indent=2, ensure_ascii=False)

    print(f"  → {output_path}")


def exporter_excel(
    df_indicateurs: pd.DataFrame,
    df_dimensions: pd.DataFrame,
    df_oppchovec: pd.DataFrame,
    suffixe: str = "V"
) -> None:
    """
    Exporte les résultats intermédiaires et finaux vers des fichiers Excel.

    Args:
        df_indicateurs: Indicateurs bruts par commune
        df_dimensions:  Scores des 3 dimensions par commune
        df_oppchovec:   Indice OppChoVec final par commune
        suffixe:        Suffixe ajouté aux noms de fichiers
    """
    chemins = {
        'indicateurs': OUTPUT_INDICATEURS_XLSX,
        'dimensions':  OUTPUT_DIMENSIONS_XLSX.parent / f"dimensions_{suffixe}.xlsx",
        'oppchovec':   OUTPUT_OPPCHOVEC_XLSX.parent / f"oppchovec_resultats_{suffixe}.xlsx",
    }

    df_indicateurs.to_excel(chemins['indicateurs'])
    print(f"  → {chemins['indicateurs']}")

    df_dimensions.to_excel(chemins['dimensions'])
    print(f"  → {chemins['dimensions']}")

    df_oppchovec.to_excel(chemins['oppchovec'])
    print(f"  → {chemins['oppchovec']}")


def exporter_stats(df_oppchovec: pd.DataFrame, suffixe: str = "V") -> None:
    """
    Exporte les statistiques descriptives et affiche le top 10.

    Args:
        df_oppchovec: DataFrame avec colonnes OppChoVec, Score_Opp, Score_Cho, Score_Vec
                      + OppChoVec_1_10 (normalisé 1-10)
        suffixe:      Suffixe pour le nom du fichier Excel
    """
    col = 'OppChoVec_1_10' if 'OppChoVec_1_10' in df_oppchovec.columns else 'OppChoVec'

    stats_path = OUTPUT_STATS_XLSX.parent / f"stats_descriptives_{suffixe}.xlsx"
    df_oppchovec[[col]].describe().to_excel(stats_path)
    print(f"  → {stats_path}")

    print(f"\nRésumé OppChoVec ({col}) :")
    print(f"  Communes   : {len(df_oppchovec)}")
    print(f"  Moyenne    : {df_oppchovec[col].mean():.4f}")
    print(f"  Minimum    : {df_oppchovec[col].min():.4f} ({df_oppchovec[col].idxmin()})")
    print(f"  Maximum    : {df_oppchovec[col].max():.4f} ({df_oppchovec[col].idxmax()})")

    print("\nTop 10 communes :")
    for i, (zone, row) in enumerate(df_oppchovec.nlargest(10, col).iterrows(), 1):
        print(f"  {i:2d}. {zone:<30} {row[col]:.4f}")


def exporter_comparaison(
    df_oppchovec: pd.DataFrame,
    communes_ciblees: List[str],
    suffixe: str = "V"
) -> None:
    """
    Exporte une fiche de comparaison pour une liste de communes ciblées.

    Args:
        df_oppchovec:     DataFrame des résultats
        communes_ciblees: Communes à inclure dans la comparaison
        suffixe:          Suffixe pour le nom de fichier
    """
    existantes = [c for c in communes_ciblees if c in df_oppchovec.index]
    if not existantes:
        print("Aucune commune ciblée trouvée dans les résultats")
        return

    chemin = OUTPUT_OPPCHOVEC_XLSX.parent / f"Comparaison_{suffixe}.xlsx"
    df_oppchovec.loc[existantes].to_excel(chemin)
    print(f"  → {chemin}")
