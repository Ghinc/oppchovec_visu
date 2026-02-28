"""
Fonctions d'agrégation de l'indice OppChoVec.

Implémente la formule CES (Constant Elasticity of Substitution) de
Bourdeau-Lepage pour agréger les scores de dimensions en un indice composite.
"""

import numpy as np
import pandas as pd
from typing import Dict

from config import ALPHA, BETA, PONDERATIONS, POND_FINALE


def calc_dik(v_ijk_dict: Dict[str, float], p_jk_dict: Dict[str, float]) -> float:
    """
    Score d'une dimension : moyenne pondérée des indicateurs normalisés.

    Args:
        v_ijk_dict: {nom_indicateur: valeur_normalisée}
        p_jk_dict:  {nom_indicateur: pondération}

    Returns:
        Score de la dimension (entre 0 et 1)
    """
    valeurs = np.array([v_ijk_dict[k] for k in p_jk_dict.keys() if k in v_ijk_dict])
    poids = np.array([p_jk_dict[k] for k in p_jk_dict.keys() if k in v_ijk_dict])

    if poids.sum() == 0:
        return 0.0
    return float((valeurs * poids).sum() / poids.sum())


def calc_oppchovec(dik: np.ndarray, pk_values: np.ndarray) -> float:
    """
    Indice OppChoVec final (formule CES).

    Formule : (1/3) × [Σ(pk × dik^β)]^(α/β)
      α = 2.5  (aversion à la pauvreté : pénalise les inégalités entre dimensions)
      β = 1.5  (complémentarité : les dimensions se complètent)

    Args:
        dik: Scores des 3 dimensions [Score_Opp, Score_Cho, Score_Vec]
        pk_values: Pondérations finales [1, 1, 1]

    Returns:
        Indice OppChoVec brut (non normalisé)
    """
    somme_ponderee = (pk_values * (dik ** BETA)).sum()
    return float((1 / 3) * (somme_ponderee ** (ALPHA / BETA)))


def calc_scores_dimensions(df_normalise: pd.DataFrame) -> pd.DataFrame:
    """
    Calcule les scores des 3 dimensions pour toutes les communes.

    Args:
        df_normalise: DataFrame des indicateurs normalisés [0, 1]
                      (index = communes, colonnes = Opp1..Vec4)

    Returns:
        DataFrame avec colonnes Score_Opp, Score_Cho, Score_Vec (index = communes)
    """
    scores = {}
    for zone in df_normalise.index:
        row = df_normalise.loc[zone]
        scores[zone] = {
            'Score_Opp': calc_dik(row.to_dict(), PONDERATIONS['Opp']),
            'Score_Cho': calc_dik(row.to_dict(), PONDERATIONS['Cho']),
            'Score_Vec': calc_dik(row.to_dict(), PONDERATIONS['Vec']),
        }
    df = pd.DataFrame.from_dict(scores, orient='index')
    df.index.name = 'Zone'
    return df


def calc_index_final(df_dimensions: pd.DataFrame) -> pd.Series:
    """
    Calcule l'indice OppChoVec brut pour toutes les communes.

    Args:
        df_dimensions: DataFrame avec Score_Opp, Score_Cho, Score_Vec
                       (index = communes)

    Returns:
        Series de l'indice OppChoVec brut (index = communes, name = 'OppChoVec')
    """
    pk = np.array(POND_FINALE)

    def _calc_row(row: pd.Series) -> float:
        dik = np.array([row['Score_Opp'], row['Score_Cho'], row['Score_Vec']])
        return calc_oppchovec(dik, pk)

    series = df_dimensions.apply(_calc_row, axis=1)
    series.name = 'OppChoVec'
    return series
