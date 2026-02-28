"""
Contrôleur du pipeline OppChoVec.

Orchestre la séquence complète :
  1. Chargement des données
  2. Calcul des indicateurs bruts
  3. Normalisation [0, 1]
  4. Scores des dimensions
  5. Indice OppChoVec brut
  6. Renormalisation [1, 10] pour l'affichage
  7. Construction du DataFrame complet (schéma JSON frontend)
"""

import pandas as pd
from typing import Dict, List, Optional

from data.loader import charger_communes, charger_toutes_donnees
from model.normalization import apply_normalization_0_1, apply_normalization_1_10
from model.aggregation import calc_scores_dimensions, calc_index_final


def run_pipeline(communes: Optional[List[str]] = None) -> Dict[str, pd.DataFrame]:
    """
    Exécute le pipeline complet de calcul OppChoVec.

    Args:
        communes: Liste de codes INSEE à traiter (None = toutes les communes)

    Returns:
        Dictionnaire avec les DataFrames suivants :
          - 'indicateurs_bruts' : indicateurs non normalisés (index = communes)
          - 'indicateurs_norm'  : indicateurs normalisés [0, 1]
          - 'dimensions'        : scores Opp/Cho/Vec bruts [0, 1]
          - 'oppchovec'         : indice final brut + scores [0, 1]
          - 'complet'           : tout en [1, 10], prêt pour le JSON frontend
    """
    # --- Étape 1 : Chargement ---
    print("Chargement des données...")
    if communes is None:
        communes = charger_communes()

    df_brut = charger_toutes_donnees(communes)
    print(f"  {len(df_brut)} communes chargées")

    # --- Étape 2 : Normalisation des indicateurs [0, 1] ---
    print("Normalisation des indicateurs [0, 1]...")
    df_norm = apply_normalization_0_1(df_brut)

    # --- Étape 3 : Scores des dimensions ---
    print("Calcul des scores de dimensions...")
    df_dimensions = calc_scores_dimensions(df_norm)

    # --- Étape 4 : Indice OppChoVec brut ---
    print("Calcul de l'indice OppChoVec...")
    series_oppchovec = calc_index_final(df_dimensions)

    df_oppchovec = df_dimensions.copy()
    df_oppchovec['OppChoVec'] = series_oppchovec

    # --- Étape 5 : Renormalisation [1, 10] ---
    print("Renormalisation [1, 10]...")
    df_complet = df_brut.copy()
    df_complet.index.name = 'Zone'

    # Renommer l'index en colonne "Zone" pour le JSON
    df_complet = df_complet.reset_index()

    # Ajouter les scores et l'indice normalisés 1-10
    df_complet['Score_Opp_1_10'] = apply_normalization_1_10(df_dimensions['Score_Opp']).values
    df_complet['Score_Cho_1_10'] = apply_normalization_1_10(df_dimensions['Score_Cho']).values
    df_complet['Score_Vec_1_10'] = apply_normalization_1_10(df_dimensions['Score_Vec']).values
    df_complet['OppChoVec_1_10'] = apply_normalization_1_10(series_oppchovec).values

    df_complet = df_complet.set_index('Zone')

    print("Pipeline terminé.")

    return {
        'indicateurs_bruts': df_brut,
        'indicateurs_norm':  df_norm,
        'dimensions':        df_dimensions,
        'oppchovec':         df_oppchovec,
        'complet':           df_complet,
    }
