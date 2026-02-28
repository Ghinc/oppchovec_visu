"""
Chargement des données source pour l'indice OppChoVec.

Lit les fichiers Excel et CSV depuis DATA_DIR et retourne les données
sous forme de structures Python exploitables par le module model.
"""

import pandas as pd
from typing import Dict, List

from config import INPUT_FILES, MAPPING_FILE, COLONNES
from model.indicators import calculer_indicateurs_commune


def charger_communes() -> List[str]:
    """
    Retourne la liste des codes INSEE de toutes les communes de Corse.

    Utilise vec2_lb.csv comme référentiel (source des codes commune).

    Returns:
        Liste de codes INSEE (ex: ["2A001", "2A004", ...])
    """
    try:
        df = pd.read_csv(INPUT_FILES['Vec2'])
        return df['code_commune'].tolist()
    except Exception as e:
        print(f"Erreur lors du chargement de la liste des communes : {e}")
        return []


def charger_mapping_communes() -> Dict[str, str]:
    """
    Charge le mapping code INSEE → nom de commune.

    Returns:
        Dictionnaire {code_insee: nom_commune}
    """
    try:
        df = pd.read_csv(MAPPING_FILE)
        return dict(zip(df['code_commune'], df['nom_commune']))
    except Exception as e:
        print(f"Erreur lors du chargement du mapping communes : {e}")
        return {}


def charger_donnees_commune(zone: str) -> Dict:
    """
    Charge toutes les données brutes d'une commune depuis les fichiers source.

    Args:
        zone: Code INSEE de la commune (ex: "2A004")

    Returns:
        Dictionnaire {clé_indicateur: valeur} pour la commune
    """
    donnees = {'Zone': zone}

    for indicateur, fichier in INPUT_FILES.items():
        try:
            is_csv = str(fichier).endswith('.csv')

            if is_csv:
                df = pd.read_csv(fichier)
                cle_id = 'code_commune' if 'code_commune' in df.columns else 'Zone'
            else:
                df = pd.read_excel(fichier)
                cle_id = 'Code commune' if 'Code commune' in df.columns else 'Zone'

            ligne = df[df[cle_id] == zone]

            if ligne.empty:
                print(f"  Attention : {zone} introuvable dans {fichier.name}")
                continue

            col_names = COLONNES[indicateur]

            if isinstance(col_names, list):
                for col in col_names:
                    if col in ligne.columns:
                        donnees[f"{indicateur}_{col}"] = ligne[col].values[0]
            else:
                if col_names in ligne.columns:
                    donnees[indicateur] = ligne[col_names].values[0]

        except Exception as e:
            print(f"  Erreur lors du chargement de {fichier.name} pour {zone} : {e}")

    return donnees


def charger_toutes_donnees(communes: List[str] = None) -> pd.DataFrame:
    """
    Charge et calcule les indicateurs pour toutes les communes.

    Enchaîne charger_donnees_commune + calculer_indicateurs_commune pour
    chaque commune, puis applique le mapping code INSEE → nom commune.

    Args:
        communes: Liste de codes INSEE à traiter (None = toutes les communes)

    Returns:
        DataFrame des indicateurs bruts (index = noms de communes)
    """
    if communes is None:
        communes = charger_communes()

    print(f"Traitement de {len(communes)} communes...")
    mapping = charger_mapping_communes()

    data = {}
    for zone in communes:
        donnees_brutes = charger_donnees_commune(zone)
        indicateurs = calculer_indicateurs_commune(donnees_brutes)
        nom = mapping.get(zone, zone)
        data[nom] = indicateurs

    df = pd.DataFrame.from_dict(data, orient='index')
    df.index.name = 'Zone'
    return df
