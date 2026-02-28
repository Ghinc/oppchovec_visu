"""
Fonctions de normalisation pour l'indice OppChoVec.

Deux échelles sont utilisées :
  - [0, 1]  : normalisation des indicateurs bruts avant agrégation
  - [1, 10] : renormalisation des scores et de l'indice final pour l'affichage
"""

import pandas as pd
from typing import Tuple


def normaliser_0_1(x: float, min_x: float, max_x: float) -> float:
    """
    Normalise une valeur sur [0, 1] par min-max.

    Args:
        x: Valeur à normaliser
        min_x: Minimum de l'échantillon
        max_x: Maximum de l'échantillon

    Returns:
        Valeur normalisée entre 0 et 1 (0 si max == min)
    """
    if max_x == min_x:
        return 0.0
    return (x - min_x) / (max_x - min_x)


def normaliser_1_10(x: float, min_x: float, max_x: float) -> float:
    """
    Normalise une valeur sur [1, 10] par min-max.

    Args:
        x: Valeur à normaliser
        min_x: Minimum de l'échantillon
        max_x: Maximum de l'échantillon

    Returns:
        Valeur normalisée entre 1 et 10 (5.5 si max == min)
    """
    if max_x == min_x:
        return 5.5
    return ((x - min_x) / (max_x - min_x)) * 9 + 1


def apply_normalization_0_1(df: pd.DataFrame) -> pd.DataFrame:
    """
    Applique la normalisation [0, 1] à chaque colonne d'un DataFrame.

    Les min/max sont calculés sur l'ensemble des lignes (toutes communes).

    Args:
        df: DataFrame des indicateurs bruts (index = communes)

    Returns:
        Nouveau DataFrame avec toutes les valeurs normalisées sur [0, 1]
    """
    df_norm = df.copy()
    for col in df.columns:
        min_val = df[col].min()
        max_val = df[col].max()
        df_norm[col] = df[col].apply(lambda x: normaliser_0_1(x, min_val, max_val))
    return df_norm


def apply_normalization_1_10(series: pd.Series) -> pd.Series:
    """
    Applique la normalisation [1, 10] à une Series.

    Args:
        series: Série de valeurs à renormaliser (scores ou indice brut)

    Returns:
        Série normalisée sur [1, 10]
    """
    min_val = series.min()
    max_val = series.max()
    return series.apply(lambda x: normaliser_1_10(x, min_val, max_val))
