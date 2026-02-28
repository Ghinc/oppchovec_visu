"""
Fonctions de calcul des 10 indicateurs OppChoVec.

Chaque fonction est pure (sans effets de bord) et correspond à un indicateur
de la méthodologie Bourdeau-Lepage.
"""

import math
import numpy as np
from typing import Dict, List

from config import COLONNES, POND_VEC3, VILLES_RESEAU_BUS


# ==============================================================================
# DIMENSION OPP (Opportunités)
# ==============================================================================

def calc_opp1(e: float) -> float:
    """
    Opp1 : Niveau d'éducation moyen (échelle 1-7).

    Args:
        e: Niveau d'éducation moyen de la population

    Returns:
        Score d'éducation (valeur directe)
    """
    return e


def calc_opp2(d_jour: float, d_nuit: float) -> float:
    """
    Opp2 : Diversité sociale (indice de Theil).

    Args:
        d_jour: Indice de Theil de jour
        d_nuit: Indice de Theil de nuit

    Returns:
        Moyenne des deux indices de Theil
    """
    return (d_jour + d_nuit) / 2


def calc_opp3(v_p: float, g_j: float, zone: str = "") -> float:
    """
    Opp3 : Accès au transport (voiture ou transports en commun).

    Score = proportion de ménages avec voiture
            + 100 si la commune a des transports en commun
            + 100 si la commune a un vrai réseau de bus (Ajaccio, Bastia, Porto-Vecchio)

    Args:
        v_p: Proportion de ménages possédant au moins une voiture
        g_j: Accès aux réseaux de transport (0 ou 1)
        zone: Code INSEE ou nom de la commune

    Returns:
        Score de mobilité
    """
    score = v_p
    if g_j > 0:
        score += 100
    if zone in VILLES_RESEAU_BUS:
        score += 100
    return score


def calc_opp4(r: float, t: float) -> float:
    """
    Opp4 : Accès à Internet et à la 4G.

    Args:
        r: Proportion de population avec débit > 30 Mb/s
        t: Proportion de population couverte par la 4G

    Returns:
        Moyenne des deux taux de couverture numérique
    """
    return (r + t) / 2


# ==============================================================================
# DIMENSION CHO (Choix)
# ==============================================================================

def calc_cho1(nb_personnes: float) -> float:
    """
    Cho1 : Absence de quartiers prioritaires.

    Plus le nombre de personnes vivant en quartier prioritaire est faible,
    meilleur est le score. Score = -log(nb_personnes) si > 0, sinon 0.

    Args:
        nb_personnes: Nombre de personnes en quartiers prioritaires

    Returns:
        Score inversé (valeur élevée = peu de personnes en quartiers prioritaires)
    """
    if nb_personnes > 0:
        return -np.log(nb_personnes)
    return 0.0


def calc_cho2(d_v: float) -> float:
    """
    Cho2 : Participation électorale (droit de vote effectif).

    Args:
        d_v: Proportion d'inscrits sur les listes électorales

    Returns:
        Taux d'inscription électorale (valeur directe)
    """
    return d_v


# ==============================================================================
# DIMENSION VEC (Vécu)
# ==============================================================================

def calc_vec1(rf: float) -> float:
    """
    Vec1 : Revenu médian.

    Args:
        rf: Revenu fiscal médian de la commune

    Returns:
        Revenu médian (valeur directe)
    """
    return rf


def calc_vec2(v21: float, v22_sdb: float, v22_chauffage: float, v23: float) -> float:
    """
    Vec2 : Qualité du logement.

    Composantes :
      - v21 : densité d'occupation (personnes par pièce) → score = exp(-v21)
      - v22 : confort sanitaire (moyenne salle de bain + chauffage)
      - v23 : proportion de maisons individuelles

    Args:
        v21: Nombre moyen de personnes par pièce
        v22_sdb: Proportion de logements avec salle de bain
        v22_chauffage: Proportion de logements avec chauffage
        v23: Proportion de maisons individuelles

    Returns:
        Score de qualité du logement (moyenne de 3 composantes)
    """
    v22 = (v22_sdb + v22_chauffage) / 2
    return (math.exp(-v21) + v22 + v23) / 3


def calc_vec3(p_vec: List[float], valeur: List[float]) -> float:
    """
    Vec3 : Stabilité de l'emploi.

    Score pondéré des catégories d'emploi (du plus stable au moins stable).

    Args:
        p_vec: Proportions de chaque catégorie d'emploi
        valeur: Pondérations de stabilité (POND_VEC3 = [1, 0.75, 0.5, 0.25, 0])

    Returns:
        Score normalisé de stabilité d'emploi, ou 0 si aucune donnée
    """
    total = sum(p_vec)
    if total == 0:
        return 0.0
    return sum(p * v for p, v in zip(p_vec, valeur)) / total


def calc_vec4(n_services: float) -> float:
    """
    Vec4 : Accès aux services de vie courante.

    Nombre de services accessibles à moins de 20 minutes en voiture.

    Args:
        n_services: Nombre de services accessibles

    Returns:
        Nombre de services (valeur directe)
    """
    return n_services


# ==============================================================================
# ORCHESTRATION
# ==============================================================================

def calculer_indicateurs_commune(donnees: Dict) -> Dict[str, float]:
    """
    Calcule les 10 indicateurs pour une commune à partir de ses données brutes.

    Args:
        donnees: Données brutes chargées depuis les fichiers source
                 (clés issues de charger_donnees_commune)

    Returns:
        Dictionnaire des 10 indicateurs calculés {nom: valeur}
    """
    indicateurs = {}

    # Opp1 : niveau d'éducation
    if 'Opp1' in donnees:
        indicateurs['Opp1'] = calc_opp1(donnees['Opp1'])

    # Opp2 : diversité sociale (le fichier contient directement l'indice de Theil)
    if 'Opp2' in donnees:
        indicateurs['Opp2'] = donnees['Opp2']

    # Opp3 : accès au transport
    v_p_key = "Opp3_Part des ménages ayant au moins 1 voiture 2021"
    g_j_key = "Opp3_Accès aux réseaux de transport"
    if v_p_key in donnees and g_j_key in donnees:
        indicateurs['Opp3'] = calc_opp3(
            donnees[v_p_key], donnees[g_j_key], donnees.get('Zone', '')
        )

    # Opp4 : connectivité numérique
    r_key = "Opp4_Proportion de population avec débit > 30Mb/s"
    t_key = "Opp4_Proportion de population couverte par la 4G"
    if r_key in donnees and t_key in donnees:
        indicateurs['Opp4'] = calc_opp4(donnees[r_key], donnees[t_key])

    # Cho1 : quartiers prioritaires
    if 'Cho1' in donnees:
        indicateurs['Cho1'] = calc_cho1(donnees['Cho1'])

    # Cho2 : participation électorale
    if 'Cho2' in donnees:
        indicateurs['Cho2'] = calc_cho2(donnees['Cho2'])

    # Vec1 : revenu médian
    if 'Vec1' in donnees:
        indicateurs['Vec1'] = calc_vec1(donnees['Vec1'])

    # Vec2 : qualité du logement
    v21_key = 'Vec2_pers_par_piece_moy'
    v22_sdb_key = 'Vec2_pct_avec_sdb'
    v22_chauffage_key = 'Vec2_pct_chauffage'
    v23_key = 'Vec2_pct_maisons'
    if all(k in donnees for k in [v21_key, v22_sdb_key, v22_chauffage_key, v23_key]):
        indicateurs['Vec2'] = calc_vec2(
            donnees[v21_key],
            donnees[v22_sdb_key],
            donnees[v22_chauffage_key],
            donnees[v23_key]
        )

    # Vec3 : stabilité de l'emploi
    vec3_keys = [
        'Vec3_Emploi stable (5)',
        'Vec3_Contrat à durée déterminée (4)',
        'Vec3_Contrat ponctuel (3)',
        'Vec3_Chomeur (1)',
        'Vec3_Emploi aidé (2)'
    ]
    if all(k in donnees for k in vec3_keys):
        p_vec = [donnees[k] for k in vec3_keys]
        indicateurs['Vec3'] = calc_vec3(p_vec, POND_VEC3)

    # Vec4 : accès aux services
    if 'Vec4' in donnees:
        indicateurs['Vec4'] = calc_vec4(donnees['Vec4'])

    return indicateurs
