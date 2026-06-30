from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from pyproj import Transformer

ROOT_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT_DIR / "python" / "data" / "sante" / "raw"
OUT_PY_DIR = ROOT_DIR / "python" / "data" / "sante" / "output"
OUT_WEB_DIR = ROOT_DIR / "web" / "data" / "sante"

PRO_PATH_MAJ2 = RAW_DIR / "professionels_santé_MAJ2_.xlsx"
ETAB_PATH = RAW_DIR / "etablissements-sanitaire-clean.xlsx"
POP_PATH = RAW_DIR / "population_corse_clean.xlsx"
CARREAUX_PATH = RAW_DIR / "carreaux_1km_corse.csv"
DEMOGRAPHY_PRO_PATH = RAW_DIR / "Démographie_professionnels_santé.xlsx"
PRO_PATH = PRO_PATH_MAJ2

OUT_JSON = OUT_WEB_DIR / "sante_indicateurs_professionnels.json"
OUT_XLSX = OUT_PY_DIR / "sante_indicateurs_professionnels.xlsx"
OUT_ETAB_JSON = OUT_WEB_DIR / "etablissements_indicateurs.json"
OUT_ETAB_XLSX = OUT_PY_DIR / "etablissements_indicateurs.xlsx"
OUT_TENSIONS_JSON = OUT_WEB_DIR / "sante_tensions_professionnels.json"
OUT_PROJECTION_JSON = OUT_WEB_DIR / "projection_offre_soins.json"

SCORE_WEIGHTS = {"densite": 0.6, "diversite": 0.4}
TENSION_SCENARIOS = (1, 2, 3)
TENSION_RANDOM_SEED = 42
PROJECTION_END_YEAR = 2036


def _strip_numeric_prefix(text: object) -> str:
    """Retire un prefixe numerique type '01-' pour l'affichage frontend."""
    value = str(text or "").strip()
    return re.sub(r"^\s*\d+[A-Z]?\s*[-–]\s*", "", value).strip() or value


def _normalize_text(value: object) -> str:
    """Normalise une chaine: lower, sans accents, espaces compacts."""
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", " ", text.lower()).strip()
    return text


def _parse_effectif(value: object) -> float:
    """
    Parse un effectif en float.
    - ND / vide / NaN -> np.nan
    - texte numerique -> float
    """
    if pd.isna(value):
        return np.nan
    txt = str(value).strip()
    if not txt:
        return np.nan
    if txt.upper() == "ND":
        return np.nan
    txt = txt.replace(" ", "").replace(",", ".")
    try:
        return float(txt)
    except ValueError:
        return np.nan


def _extract_effectif_year_cols(df: pd.DataFrame) -> list[tuple[int, str]]:
    """Retourne les colonnes effectif_YYYY triees par annee croissante."""
    year_cols: list[tuple[int, str]] = []
    for col in df.columns:
        m = re.fullmatch(r"effectif_(\d{4})", str(col).strip())
        if m:
            year_cols.append((int(m.group(1)), str(col)))
    return sorted(year_cols, key=lambda t: t[0])


def _age_group_flags(tranche_age: str) -> tuple[bool, bool]:
    """
    Retourne (is_55_plus, is_60_plus) avec gestion robuste des nomenclatures.
    """
    norm = _normalize_text(tranche_age)

    if "ensemble" in norm:
        return False, False

    # Cas explicites "entre X et Y"
    m_range = re.search(r"entre\s*(\d+)\s*et\s*(\d+)", norm)
    if m_range:
        lo = int(m_range.group(1))
        hi = int(m_range.group(2))
        return hi >= 55, hi >= 60

    # Cas "X ans et plus" (inclut '60 a 65 ans et plus' via min du set)
    if "plus" in norm:
        nums = [int(n) for n in re.findall(r"\d+", norm)]
        if nums:
            min_age = min(nums)
            return min_age >= 55, min_age >= 60

    # Fallback: detection directe des tranches citees dans le besoin.
    if any(tag in norm for tag in ["55", "56", "57", "58", "59"]):
        return True, False
    if any(tag in norm for tag in ["60", "61", "62", "63", "64", "65", "66", "67", "68", "69", "70", "71", "72", "73", "74", "75"]):
        return True, True

    return False, False


def export_projection_offre_soins_json(
    demography_path: Path = DEMOGRAPHY_PRO_PATH,
    output_path: Path = OUT_PROJECTION_JSON,
    projection_end_year: int = PROJECTION_END_YEAR,
) -> dict:
    """
    Produit un export dedie front pour l'onglet Projection Offre de Soins.
    Tous les calculs sont faits ici; le front ne fait que lire et afficher.
    """
    if not demography_path.exists():
        raise FileNotFoundError(f"Fichier demographie introuvable: {demography_path}")

    df = pd.read_excel(demography_path)
    required = {"specialites", "departement", "tranche_age"}
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Colonnes manquantes dans {demography_path.name}: {missing}")

    year_cols = _extract_effectif_year_cols(df)
    if not year_cols:
        raise ValueError("Aucune colonne effectif_YYYY detectee dans le fichier de demographie")

    # Normalisation de labels pour le front
    work = df.copy()
    work["specialite_label"] = work["specialites"].map(_strip_numeric_prefix)
    work["departement_label"] = work["departement"].map(_strip_numeric_prefix)

    records: list[dict] = []

    grouped = work.groupby(["specialites", "specialite_label", "departement", "departement_label"], dropna=False)
    for (specialite_raw, specialite_label, dep_raw, dep_label), grp in grouped:
        tranche_norm = grp["tranche_age"].map(_normalize_text)
        ensemble_rows = grp[tranche_norm.str.contains("ensemble", na=False)]
        if ensemble_rows.empty:
            continue

        ensemble_row = ensemble_rows.iloc[0]

        observed_years: list[int] = []
        observed_values: list[float] = []
        for year, col in year_cols:
            val = _parse_effectif(ensemble_row.get(col))
            if np.isfinite(val):
                observed_years.append(int(year))
                observed_values.append(float(val))

        if not observed_years:
            continue

        year_start = observed_years[0]
        year_end = observed_years[-1]
        effectif_initial = float(observed_values[0])
        effectif_final = float(observed_values[-1])
        evolution_abs = effectif_final - effectif_initial
        evolution_rel_pct = (evolution_abs / effectif_initial * 100.0) if effectif_initial > 0 else np.nan
        span_years = year_end - year_start
        tcam_pct = ((effectif_final / effectif_initial) ** (1.0 / span_years) - 1.0) * 100.0 if (effectif_initial > 0 and span_years > 0 and effectif_final >= 0) else np.nan

        x = np.array(observed_years, dtype=float)
        y = np.array(observed_values, dtype=float)
        if len(x) >= 2 and np.unique(x).size >= 2:
            slope, intercept = np.polyfit(x, y, deg=1)
        else:
            slope, intercept = 0.0, float(y[-1])

        # Qualité de l'ajustement : coefficient de détermination R²
        if len(x) >= 2 and np.unique(x).size >= 2:
            y_pred = slope * x + intercept
            ss_res = float(np.sum((y - y_pred) ** 2))
            ss_tot = float(np.sum((y - np.mean(y)) ** 2))
            r2 = round(1.0 - ss_res / ss_tot, 4) if ss_tot > 0 else None
        else:
            r2 = None

        proj_years = [yy for yy in range(year_end + 1, int(projection_end_year) + 1)]
        proj_values = [max(0.0, float(slope * yy + intercept)) for yy in proj_years]
        value_2036 = max(0.0, float(slope * int(projection_end_year) + intercept))

        # Analyse demographique par tranches d'age (sans ligne ensemble)
        age_rows = grp[~tranche_norm.str.contains("ensemble", na=False)].copy()
        latest_age_year = None
        for yy, col in reversed(year_cols):
            parsed = age_rows[col].map(_parse_effectif)
            if parsed.notna().any():
                latest_age_year = int(yy)
                break
        if latest_age_year is None:
            latest_age_year = int(year_end)

        latest_col = f"effectif_{latest_age_year}"

        # Série temporelle par tranche d'âge sur toutes les années observées
        age_ts: dict[str, dict[int, float]] = {}
        for year, col in year_cols:
            for _, r in age_rows.iterrows():
                label = _strip_numeric_prefix(r.get("tranche_age"))
                val = _parse_effectif(r.get(col))
                if not np.isfinite(val):
                    continue
                if label not in age_ts:
                    age_ts[label] = {}
                age_ts[label][year] = age_ts[label].get(year, 0.0) + float(val)

        age_map: dict[str, float] = {}
        for _, r in age_rows.iterrows():
            label = _strip_numeric_prefix(r.get("tranche_age"))
            val = _parse_effectif(r.get(latest_col))
            if not np.isfinite(val):
                continue
            age_map[label] = age_map.get(label, 0.0) + float(val)

        age_total = float(sum(age_map.values()))
        age_distribution: list[dict] = []
        sum_55 = 0.0
        for label, val in sorted(age_map.items(), key=lambda t: _normalize_text(t[0])):
            is_55, is_60 = _age_group_flags(label)
            if is_55:
                sum_55 += val
            age_distribution.append({
                "tranche_age": label,
                "effectif": round(val, 6),
                "effectifs_par_annee": {str(y): round(v, 6) for y, v in sorted(age_ts.get(label, {}).items())},
                "part_pct": round((val / age_total * 100.0), 4) if age_total > 0 else 0.0,
                "is_55_plus": bool(is_55),
            })

        share_55_plus_pct = (sum_55 / age_total * 100.0) if age_total > 0 else 0.0

        record_id = f"{_slugify(str(specialite_label))}__{_slugify(str(dep_label))}"
        records.append({
            "id": record_id,
            "specialite": str(specialite_label),
            "specialite_source": str(specialite_raw),
            "departement": str(dep_label),
            "departement_source": str(dep_raw),
            "historique": {
                "annees": observed_years,
                "effectifs": [round(v, 6) for v in observed_values],
                "derniere_annee_disponible": int(year_end),
            },
            "projection": {
                "modele": "regression_lineaire",
                "annee_cible": int(projection_end_year),
                "annees": proj_years,
                "effectifs": [round(v, 6) for v in proj_values],
                "effectif_projete_2036": round(value_2036, 6),
                "pente_par_an": round(float(slope), 8),
                "r2": r2,
            },
            "indicateurs": {
                "effectif_initial": round(effectif_initial, 6),
                "effectif_final_observe": round(effectif_final, 6),
                "evolution_absolue": round(evolution_abs, 6),
                "evolution_relative_pct": round(float(evolution_rel_pct), 6) if np.isfinite(evolution_rel_pct) else None,
                "taux_croissance_annuel_moyen_pct": round(float(tcam_pct), 6) if np.isfinite(tcam_pct) else None,
            },
            "demographie": {
                "annee_reference": int(latest_age_year),
                "repartition_tranches_age": age_distribution,
                "part_55_plus_pct": round(float(share_55_plus_pct), 6),
            },
        })

    # Comparatifs pre-calcules par departement
    comparatifs: dict[str, dict] = {}
    for dep in sorted({r["departement"] for r in records}):
        dep_records = [r for r in records if r["departement"] == dep]
        cmp55 = sorted([
            {
                "id": r["id"],
                "specialite": r["specialite"],
                "part_pct": r["demographie"]["part_55_plus_pct"],
            }
            for r in dep_records
        ], key=lambda x: x["part_pct"], reverse=True)
        comparatifs[dep] = {
            "part_55_plus": cmp55,
        }

    payload = {
        "meta": {
            "source_file": demography_path.name,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "projection_end_year": int(projection_end_year),
            "method_note": "Projections tendancielles exploratoires basees sur regression lineaire des effectifs observes.",
            "nd_note": "ND signifie donnee non disponible/non diffusee et est ignore dans les calculs.",
        },
        "series": records,
        "comparatifs": comparatifs,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    return payload


def _minmax_normalize(series: pd.Series) -> pd.Series:
    """Normalise une série en [0, 1] via min-max. NaN/infinis → 0."""
    s = pd.to_numeric(series, errors="coerce").fillna(0).clip(lower=0)
    mn, mx = s.min(), s.max()
    if mx <= mn:
        return pd.Series(0.0, index=s.index)
    return (s - mn) / (mx - mn)


def _compute_score_couverture(
    df: pd.DataFrame,
    density_col: str,
    diversity_col: str,
    zero_mask: "pd.Series[bool]",
    weights: dict = SCORE_WEIGHTS,
) -> pd.Series:
    """
    Calcule le score densité+diversité normalisé [0, 1].

    - Normalise density_col et diversity_col en [0, 1] via min-max
      pour les rendre comparables (unités différentes).
    - Combine : score = w_dens * norm_dens + w_div * norm_div
    - Force à 0 les communes sans offre (zero_mask).
    - Jenks et classification [0-100] sont calculés côté frontend.
    """
    norm_dens = _minmax_normalize(df[density_col])
    norm_div  = _minmax_normalize(df[diversity_col])
    score = (weights["densite"] * norm_dens + weights["diversite"] * norm_div).round(4)
    score[zero_mask] = 0.0
    return score


def _compute_densites(
    out: pd.DataFrame,
    nb_total_col: str,
    dens_total_col: str,
    nb_prefix: str,
    dens_prefix: str,
) -> None:
    """
    Calcule les densités pour 10 000 habitants (total + par catégorie) et les ajoute à `out`.

    Args:
        out           : DataFrame indexé par code_commune avec colonne 'population'.
        nb_total_col  : nom de la colonne d'effectif total  (ex. 'nb_professionnels_total').
        dens_total_col: nom de la colonne densité totale   (ex. 'densite_professionnels_total_10000').
        nb_prefix     : préfixe des colonnes d'effectifs    (ex. 'nb_').
        dens_prefix   : préfixe des colonnes de densité    (ex. 'densite_').
    """
    pop = out["population"].replace(0, pd.NA)
    out[dens_total_col] = (out[nb_total_col] / pop) * 10000
    sub_nb_cols = [c for c in out.columns if c.startswith(nb_prefix) and c != nb_total_col]
    for col in sub_nb_cols:
        dens_col = dens_prefix + col[len(nb_prefix):] + "_10000"
        out[dens_col] = (out[col] / pop) * 10000
    dens_cols = [c for c in out.columns if c.startswith(dens_prefix)]
    out[dens_cols] = out[dens_cols].fillna(0).round(4)


def _compute_diversite(
    out: pd.DataFrame,
    dens_prefix: str,
    dens_total_col: str,
    output_col: str,
) -> None:
    """
    Calcule le nombre de catégories/spécialités présentes (densité > 0) par commune.

    Args:
        out           : DataFrame avec les colonnes de densité.
        dens_prefix   : préfixe des colonnes de densité (ex. 'densite_').
        dens_total_col: colonne densité totale à exclure du comptage.
        output_col    : nom de la colonne de sortie (ex. 'diversite_specialites').
    """
    specialty_dens_cols = [
        c for c in out.columns
        if c.startswith(dens_prefix)
        and c.endswith("_10000")
        and c != dens_total_col
        and not c.endswith("_weighted")
    ]
    out[output_col] = (out[specialty_dens_cols] > 0).sum(axis=1).astype(int)


# Accessibilité gravitaire (distance en kilomètres)
GRAVITY_BETA_OPTIONS = {
    "b005": 0.05,
    "b010": 0.10,
    "b020": 0.20,
}

GRAVITY_RADIUS_OPTIONS_KM = {
    "no_limit": None,
    "r15km": 15.0,
    "r30km": 30.0,
}

DEFAULT_TRAVEL_SPEED_KMH = 50.0


def _minutes_to_km(minutes: float, speed_kmh: float = DEFAULT_TRAVEL_SPEED_KMH) -> float:
    return float(speed_kmh) * (float(minutes) / 60.0)


SFCA_RADIUS_OPTIONS_KM = {
    "d30min": _minutes_to_km(30),
    "d15min": _minutes_to_km(15),
    "d45min": _minutes_to_km(45),
}

# Nettoyage des noms des professions pour creer des nms de colonnes de sortie
# exploitable , forme d'harmonisation des formats
def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


# NETTOYAGE : normalisation des codes communes les mettre homogènes
def _clean_code_commune(series: pd.Series) -> pd.Series:
    return (
        series.astype(str)
        #  enlève les espaces au début/fin et met en majuscules
        .str.strip()
        .str.upper()
        # Suppression tous les espaces même au milieu
        .str.replace(r"\s+", "", regex=True)
    )



# NETTOYAGE et séparation des coordonnées en latitude, longitude
def _parse_coordonnees_to_lon_lat(value: object) -> tuple[float, float] | None:
    """Parse une coordonnée texte type '41.95, 8.78' -> (lon, lat)."""
    if pd.isna(value):
        return None

    text = str(value).strip()
    if not text:
        return None

    parts = [p.strip() for p in text.split(",")]
    if len(parts) != 2:
        return None

    try:
        lat = float(parts[0])
        lon = float(parts[1])
    except ValueError:
        return None

    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return lon, lat


#extract a centroid from carreau_id like FR_CRS3035RES1000mN2031000E4252000
def _parse_carreau_centroid_3035(carreau_id: object) -> tuple[float, float] | None:
    """
    Extrait un centroïde approximatif depuis un id type
    FR_CRS3035RES1000mN2031000E4252000.
    """
    if pd.isna(carreau_id):
        return None

    text = str(carreau_id)
    match_n = re.search(r"N(\d+)", text)
    match_e = re.search(r"E(\d+)", text)
    if not match_n or not match_e:
        return None

    n = float(match_n.group(1))
    e = float(match_e.group(1))

    # carreau 1 km -> centroïde = origine + 500 m
    return e + 500.0, n + 500.0


def _gravity_column_name(
    access_type: str,
    beta_key: str,
    radius_key: str,
    offer_variant: str = "raw",
) -> str:
    suffix = "" if offer_variant == "raw" else "_weighted"
    return f"acc_grav_{access_type}_beta_{beta_key}_{radius_key}{suffix}"


def _sfca_column_name(
    access_type: str,
    radius_key: str,
    offer_variant: str = "raw",
) -> str:
    suffix = "" if offer_variant == "raw" else "_weighted"
    return f"acc_2sfca_{access_type}_{radius_key}{suffix}"

def _reproject_to_3035(lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
    """Reprojette des coordonnées GPS (EPSG:4326) vers le système métrique européen (EPSG:3035).
    Retourne un tableau NumPy de forme (n, 2) avec les colonnes [x, y] en mètres.
    """
    to_3035 = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True)
    x, y = to_3035.transform(lon, lat)
    return np.column_stack([x, y]).astype(float)


# on  construit un identifiant unique par professionnel pour dédupliquer les lignes
# il va servir pour compter les pros uniques
def _build_professional_uid(df_pro: pd.DataFrame, profession_col: str) -> pd.Series:
    name_col = "Nom du professionnel"
    if name_col not in df_pro.columns:
        return df_pro.index.astype(str)

    # cree un nouveau df qui a le meme index que df_pro
    work = pd.DataFrame(index=df_pro.index)
    work["_name"] = df_pro[name_col].astype(str).str.strip().str.upper()
    work["_prof"] = df_pro[profession_col].astype(str).str.strip().str.upper()

    return (
        work["_name"].fillna("")
        + "|"
        + work["_prof"].fillna("")
        + "|"
        + ""
    )


def _build_professional_offer_weights(df_pro: pd.DataFrame, profession_col: str) -> tuple[pd.Series, pd.Series]:
    """
    Construit un poids d'offre par ligne de professionnel:
      - variante raw: S_j = 1 (implicite)
      - variante weighted: partage 1 entre les communes d'exercice d'un même pro
        puis partage intra-commune entre ses adresses distinctes (identifiées par coordonnées).

    Formule: S_j = 1 / (n_communes × n_adresses_distinctes_dans_cette_commune)
    
    Résultat: série alignée sur df_pro.index (float).
    """
    name_col = "Nom du professionnel"
    if name_col not in df_pro.columns:
        return pd.Series(1.0, index=df_pro.index, dtype=float)

    work = df_pro[["code_commune", profession_col, name_col, "Coordonnées"]].copy()
    work["code_commune"] = _clean_code_commune(work["code_commune"])
    work[profession_col] = work[profession_col].astype(str).str.strip().str.upper()
    work[name_col] = work[name_col].astype(str).str.strip().str.upper()

    work["_pro_uid"] = (
        work[name_col].fillna("")
        + "|"
        + work[profession_col].fillna("")
        + "|"
        + ""
    )

    # Construire un identifiant d'adresse basé sur la commune + coordonnées normalisées
    # Normalisation simple: supprimer espaces superflus
    work["_coord_norm"] = work["Coordonnées"].astype(str).str.replace(r"\s+", "", regex=True).str.strip()
    work["_addr_uid"] = (
        work["_pro_uid"].fillna("") + "|" + work["code_commune"].astype(str).fillna("") + "|" + work["_coord_norm"].fillna("")
    )

    # Étape 1 : Compter les communes distinctes pour chaque médecin
    communes_per_pro = (
        work[["_pro_uid", "code_commune"]]
        .drop_duplicates()
        .groupby("_pro_uid")["code_commune"]
        .nunique()
        .rename("_n_communes")
    )
    work = work.join(communes_per_pro, on="_pro_uid")
    work["_n_communes"] = pd.to_numeric(work["_n_communes"], errors="coerce").fillna(1).clip(lower=1)

    # Étape 2 : Compter les adresses distinctes (identifiées par coordonnées) 
    #           pour chaque (médecin, commune)
    addresses_per_pro_commune = (
        work.groupby(["_pro_uid", "code_commune"])["_coord_norm"]
        .nunique()
        .rename("_n_adresses_pc")
    )
    work = work.join(addresses_per_pro_commune, on=["_pro_uid", "code_commune"])
    work["_n_adresses_pc"] = pd.to_numeric(work["_n_adresses_pc"], errors="coerce").fillna(1).clip(lower=1)

    # Formule finale : S_j = 1 / (n_communes × n_adresses_distinctes_dans_cette_commune)
    weights = 1.0 / (work["_n_communes"] * work["_n_adresses_pc"])
    return weights.astype(float), work["_addr_uid"].astype(str)


def _prepare_spatial_inputs(
    df_pro: pd.DataFrame,
    carreaux_path: Path,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, dict[str, np.ndarray]] | None:
    """
    Prépare les entrées spatiales communes :
      - docs_xy : coordonnées médecins (m,2) en EPSG:3035
    - doc_offer_weighted : poids d'offre pondérée par médecin (m,)
    - cell_xy : coordonnées centroïdes carreaux (n,2) en EPSG:3035
      - pop     : population des carreaux (n,)
      - cell_indices_by_commune : mapping code_commune -> index carreaux

    Règle provisoire conservée : un carreau multi-communes est rattaché à toutes
    les communes listées pour l'agrégation communale.
    """
    if "Coordonnées" not in df_pro.columns:
        return None

    parsed = df_pro["Coordonnées"].apply(_parse_coordonnees_to_lon_lat)
    valid_mask = parsed.notna()
    if not valid_mask.any():
        return None

    #Conversion des coordonnées extraites en tableau numérique NumPy
    coords = np.array(parsed.loc[valid_mask].tolist(), dtype=float)
    # Séparation des longitudes (X GPS) et latitudes (Y GPS)
    lon = coords[:, 0]
    lat = coords[:, 1]
    # Reprojection des coordonnées GPS vers le système métrique EPSG:3035
    docs_xy = _reproject_to_3035(lon, lat)
    
    if "sj_weighted" in df_pro.columns:
        doc_offer_weighted = pd.to_numeric(df_pro.loc[valid_mask, "sj_weighted"], errors="coerce").fillna(1.0).to_numpy(dtype=float)
    else:
        doc_offer_weighted = np.ones(len(docs_xy), dtype=float)

    if not carreaux_path.exists():
        return None

    df_car = pd.read_csv(carreaux_path, sep=";")
    needed = {"id_carreau_1km", "code_commune", "pop"}
    if not needed.issubset(df_car.columns):
        return None

    centroids = df_car["id_carreau_1km"].apply(_parse_carreau_centroid_3035)
    valid_cells = centroids.notna()
    if not valid_cells.any():
        return None

    df_cells = df_car.loc[valid_cells, ["code_commune", "pop"]].copy()
    df_cells["population"] = pd.to_numeric(df_cells["pop"], errors="coerce").fillna(0.0)

    xy = np.array(centroids.loc[valid_cells].tolist(), dtype=float)
    cell_xy = np.column_stack([xy[:, 0], xy[:, 1]]).astype(float)
    pop = df_cells["population"].to_numpy(dtype=float)

    # mapping commune -> index des carreaux (duplication volontaire en multi-communes)
    mapper = pd.DataFrame({
        "cell_idx": np.arange(len(df_cells), dtype=int),
        "code_commune": df_cells["code_commune"].astype(str).str.split(","),
    }).explode("code_commune")
    mapper["code_commune"] = _clean_code_commune(mapper["code_commune"])
    mapper = mapper[mapper["code_commune"].ne("")]

    cell_indices_by_commune = {
        code: grp["cell_idx"].to_numpy(dtype=int)
        for code, grp in mapper.groupby("code_commune")
    }

    return docs_xy, doc_offer_weighted, cell_xy, pop, cell_indices_by_commune


def _compute_gravity_accessibility(
    df_pro: pd.DataFrame,
    carreaux_path: Path,
    commune_index: pd.Index,
) -> pd.DataFrame:
    """
    Calcule 12 indicateurs gravitaires communaux:
      - 2 versions d'agrégation (spatial_local, population_weighted)
      - 3 betas (b005, b010, b020)
      - 2 rayons (no_limit, r30km)

    Hypothèses validées:
      - S_j = 1 par praticien
      - Carreaux multi-communes : comptés dans chaque commune listée (duplication)
            - Offre J : tous les praticiens de Corse
    """
    out_cols = [
        _gravity_column_name(access_type, beta_key, radius_key, offer_variant)
        for offer_variant in ("raw", "weighted")
        for access_type in ("spatial_local", "population_weighted")
        for beta_key in GRAVITY_BETA_OPTIONS
        for radius_key in GRAVITY_RADIUS_OPTIONS_KM
    ]

    result = pd.DataFrame(0.0, index=commune_index, columns=out_cols)

    # ---- Médecins avec coordonnées (WGS84 -> EPSG:3035) ----
    if "Coordonnées" not in df_pro.columns:
        return result

    # préparation des professionnels de santé
    # on extrait les coordonées GPS et on les convertir en tuple de valeurs numériques
    parsed = df_pro["Coordonnées"].apply(_parse_coordonnees_to_lon_lat)
    # garder que les pros qui ont des coordonnées valides
    valid_mask = parsed.notna()
    if not valid_mask.any():
        return result

    df_docs = df_pro.loc[valid_mask, ["code_commune"]].copy()
    # transfrormer les coordonnées en vrai tableau numérique numpy
    coords = np.array(parsed.loc[valid_mask].tolist(), dtype=float)
    # séparer les longitudes (X GPS) et latitudes (Y GPS)
    lon = coords[:, 0]
    lat = coords[:, 1]
    
    # projection des coordonnées GPS en Coordonnées métriques  
    to_3035 = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True)
    # trasnformation des lon/lat en x/y en EPSG:3035, chaque médecin possède désormais 
    # une coordonnées x et coordonées y dans le système métrique EPSG:3035
    x_doc, y_doc = to_3035.transform(lon, lat)
    df_docs["x"] = x_doc
    df_docs["y"] = y_doc
    
    # verification si une pondération de l'offre existe
    if "sj_weighted" in df_pro.columns:
        # on récupère les poids de la pondération de l'offre et on stocke dans df_docs
        df_docs["sj_weighted"] = pd.to_numeric(df_pro.loc[valid_mask, "sj_weighted"], errors="coerce").fillna(1.0).to_numpy(dtype=float)
    else:
        df_docs["sj_weighted"] = 1.0

    # Préparation des carreaux INSEE
    if not carreaux_path.exists():
        return result

    df_car = pd.read_csv(carreaux_path, sep=";")
    needed = {"id_carreau_1km", "code_commune", "pop"}
    if not needed.issubset(df_car.columns):
        return result

    car_centroids = df_car["id_carreau_1km"].apply(_parse_carreau_centroid_3035)
    car_valid = car_centroids.notna()
    if not car_valid.any():
        return result

    df_car = df_car.loc[car_valid, ["code_commune", "pop"]].copy()
    df_car["population"] = pd.to_numeric(df_car["pop"], errors="coerce").fillna(0.0)

    xy = np.array(car_centroids.loc[car_valid].tolist(), dtype=float)
    df_car["x"] = xy[:, 0]
    df_car["y"] = xy[:, 1]

    # code_commune peut contenir plusieurs codes séparés par ',' 
    # ( représentant deux communes pour un même carreau )
    df_car["code_commune"] = (
        df_car["code_commune"]
        .astype(str)
        .str.split(",")
    )
    #transforme chaque élément de la liste en une ligne séparée
    df_car = df_car.explode("code_commune")
    df_car["code_commune"] = _clean_code_commune(df_car["code_commune"])
    #supprime les lignes ou le code commune est vide
    df_car = df_car[df_car["code_commune"].ne("")]

    # extraction des coordonnées des professionnels en tableau numpy
    docs_all = df_docs[["x", "y"]].to_numpy(dtype=float)
    # récupération des poids pondérés des pros 
    sj_weighted = df_docs["sj_weighted"].to_numpy(dtype=float)
    # Préparation des modes de calcul de l'offre
    offer_vectors = {
        # cas non pondéré, Sj = 1
        "raw": np.ones(len(df_docs), dtype=float),
        # cas pondéré, Sj = poids calculé sj_weighted
        "weighted": sj_weighted,
    }
    # fallback sécurité
    if docs_all.size == 0:
        return result

    # Organisation des carreaux par commune
    # on crée un dictionnaire qui regroupe les carreaux de population par commune
    # pour chaque commune , on stocke X du carreau , Y et la population du carreau
    cells_by_commune = {
        code: grp[["x", "y", "population"]].to_numpy(dtype=float)
        for code, grp in df_car.groupby("code_commune")
    }

    # on boucle sur les communes pour calculer l'accessibilité comumne par comune
    for code in commune_index:
        # On récupère les carreaux associés à la commune en cours
        cells = cells_by_commune.get(code)
        # si la commune na pas de carreaux on passe à la commune suivante
        if cells is None or cells.size == 0:
            continue

        # recupère les coordonées du carreaux
        cell_xy = cells[:, :2]
        # récupère la population du carreaux
        pop = cells[:, 2]

        
        # on calcule les écarts en X et en Y entre chaque carreau de la commune 
        # et tous les professionnels de santé.
        dx = cell_xy[:, None, 0] - docs_all[None, :, 0]
        dy = cell_xy[:, None, 1] - docs_all[None, :, 1]
        # on calcule la distance euclidienne entre chaque carreau et chaque médecin en km
        dist_km = np.sqrt(dx * dx + dy * dy) / 1000.0
        # prépartion de l'aggregation communale
        # ces valeurs vont servir à calculer l'accessbiité locale et celle pondérée population
        n_cells = len(cell_xy)       # contient les carreux de la commune ne cours
        pop_sum = float(pop.sum())   # contient la population totale estimée de la commune à partir des carreaux
        
        # boucle sur les valeurs de beta
        for beta_key, beta in GRAVITY_BETA_OPTIONS.items():
            # calcule la fonction de décroissance exponentielle
            decay = np.exp(-beta * dist_km)
            # boucle sur plusieurs scénarios de rayons de desserte (pas de limite, 15 km, 30 km)
            for radius_key, radius_km in GRAVITY_RADIUS_OPTIONS_KM.items():
                if radius_km is None:
                    # Si aucun rayon maximal n’est défini, tous les pros contribuent au calcul
                    radius_component = decay
                else:
                    # Si un rayon est défini, on crée un masque : True si distance <= rayon et False sinon
                    mask = dist_km <= radius_km
                    # on multiplie ce masque par la décroissance, et les pros dnas le rayon contriubent 
                    # et hors rayon ont une contribution nulle
                    radius_component = decay * mask

                # boucle sur l'offre brut et pondéré, le calcul est efefctué une fois sur raw et sur weighted
                for offer_variant, sj in offer_vectors.items():
                    # calcule l’accessibilité gravitaire pour chaque carreau
                    ai = (radius_component * sj[None, :]).sum(axis=1)
                    # sum(axis=1) additionne les contributions de tous les pros pour chaque carreau

                    # les noms des colonnes dans lesquelles les résultats seront stockés
                    col_spatial = _gravity_column_name("spatial_local", beta_key, radius_key, offer_variant)
                    col_pop = _gravity_column_name("population_weighted", beta_key, radius_key, offer_variant)

                    # Agrégation communale locale (moyenne des ai des carreaux de la commune)
                    result.at[code, col_spatial] = float(ai.mean()) if n_cells else 0.0

                    # Agrégation communale : moyenne pondérée par population
                    if pop_sum > 0:
                        result.at[code, col_pop] = float((ai * pop).sum() / pop_sum)
                    else:
                        # fallback si population absente on utilise la moyenne locale comme solution de secours.
                        result.at[code, col_pop] = float(ai.mean()) if n_cells else 0.0

    # La fonction retourne un dataframe contenant, pour chaque commune, toutes les variantes gravitaires :
    # selon le type d’agrégation ;
    # selon le paramètre β ;
    # selon le rayon ;
    # selon l’offre brute ou pondérée.
    return result


def _compute_2sfca_accessibility(
    df_pro: pd.DataFrame,
    carreaux_path: Path,
    commune_index: pd.Index,
) -> pd.DataFrame:
    """
    Calcule les indicateurs 2SFCA classiques
      - 2 versions d'agrégation communale (spatial_local, population_weighted)
      - 2 rayons de desserte (15 km, 30 km)
    """
    out_cols = [
        _sfca_column_name(access_type, radius_key, offer_variant)
        for offer_variant in ("raw", "weighted")
        for access_type in ("spatial_local", "population_weighted")
        for radius_key in SFCA_RADIUS_OPTIONS_KM
    ]
    #on crée un datafrae final avec une ligne par comune, une colonne par scénarios 2SFCA
    result = pd.DataFrame(0.0, index=commune_index, columns=out_cols)

    # fonction qui prépare les entrées spatiales et retourne les coordonnées des médecins, les poids ...
    prepared = _prepare_spatial_inputs(df_pro=df_pro, carreaux_path=carreaux_path)
    if prepared is None:
        return result

    docs_xy, sj_weighted, cell_xy, pop, cell_indices_by_commune = prepared
    if docs_xy.size == 0 or cell_xy.size == 0:
        return result

    n_cells = cell_xy.shape[0]
    pop = pop.astype(float)

    # la distance entre chaque carreau de population et chaque professionnel en km
    dx = cell_xy[:, None, 0] - docs_xy[None, :, 0]
    dy = cell_xy[:, None, 1] - docs_xy[None, :, 1]
    dist_km = np.sqrt(dx * dx + dy * dy) / 1000.0
    # préparation de l'offre brute et pondérée
    offer_vectors = {
        "raw": np.ones(docs_xy.shape[0], dtype=float),
        "weighted": sj_weighted.astype(float),
    }

    # boucle sur les rayons de desserte
    for radius_key, radius_km in SFCA_RADIUS_OPTIONS_KM.items():
        # Etape 1 : R_j = S_j / sum(P_i) sur la zone de desserte du médecin j
        # on crée une matrice booléenne, True le centroïde du carreau est dans le rayon False hors rayon
        # une opération vectorisé numpy
        mask_doc = dist_km <= radius_km
        # pour chaque pros, la population totale située dans son rayon de desserte.
        demand_per_doc = (pop[:, None] * mask_doc).sum(axis=0)
        for offer_variant, sj in offer_vectors.items():
            # on calcule le ratio offre-demande du professionnel pour version de pondération de l'offre
            rj = np.divide(sj, demand_per_doc, out=np.zeros_like(demand_per_doc, dtype=float), where=demand_per_doc > 0)
            # Etape 2 : A_i = sum_j R_j calcule l’accessibilité de chaque carreau i en sommant 
            #les R_j de tous les médecins j accessibles depuis ce carreau (dans le rayon)
            ai = (mask_doc * rj[None, :]).sum(axis=1)
            #Aggregation communale
            for code in commune_index:
                # on récupère les indices des carreaux appartenant à la commune
                idx = cell_indices_by_commune.get(code)
                if idx is None or len(idx) == 0:
                    continue
                # on extrait les accessibilités des carreaux de la commune et leurs populations
                ai_c = ai[idx]
                pop_c = pop[idx]
                col_spatial = _sfca_column_name("spatial_local", radius_key, offer_variant)
                col_pop = _sfca_column_name("population_weighted", radius_key, offer_variant)
                # aggregation locale : moyenne des ai des carreaux de la commune
                result.at[code, col_spatial] = float(ai_c.mean()) if len(ai_c) else 0.0
                pop_sum = float(pop_c.sum())
                if pop_sum > 0:
                    # aggregation pondérée population : moyenne des ai des carreaux de la commune, pondérée par la population de chaque carreau    
                    result.at[code, col_pop] = float((ai_c * pop_c).sum() / pop_sum)
                else:
                    result.at[code, col_pop] = float(ai_c.mean()) if len(ai_c) else 0.0

    return result


def build_indicateurs_offre_soins(
    professionnels_path: Path = PRO_PATH,
    population_path: Path = POP_PATH,
    carreaux_path: Path = CARREAUX_PATH,
    df_pro_input: pd.DataFrame | None = None,
    df_pop_input: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """
    Construit les indicateurs par commune.

    Retourne un DataFrame indexé sur code_commune avec colonnes :
    - commune
    - population
    - nb_professionnels_total
    - densite_professionnels_total_10000
    - nb_<profession>
    - densite_<profession>_10000
    - diversite_specialites
    - note_densite
    - note_diversite
    - score_couverture
    - classe_score_couverture
    - acc_grav_<version>_beta_<option>_<rayon>
    - acc_2sfca_<version>_<rayon>
    """
    if df_pro_input is None:
        df_pro = pd.read_excel(professionnels_path)
    else:
        df_pro = df_pro_input.copy()

    if df_pop_input is None:
        df_pop = pd.read_excel(population_path)
    else:
        df_pop = df_pop_input.copy()

    required_pro_base = {"code_commune", "commune"}
    required_pop = {"code_commune", "commune", "population"}

    if not required_pro_base.issubset(set(df_pro.columns)):
        missing = required_pro_base - set(df_pro.columns)
        raise ValueError(f"Colonnes manquantes dans professionnels: {sorted(missing)}")
    if not required_pop.issubset(set(df_pop.columns)):
        missing = required_pop - set(df_pop.columns)
        raise ValueError(f"Colonnes manquantes dans population: {sorted(missing)}")

    profession_col = "Profession"
    if profession_col not in df_pro.columns:
        raise ValueError("Colonne Profession manquante dans professionnels")

    df_pro = df_pro.copy()
    df_pop = df_pop.copy()

    df_pro["code_commune"] = _clean_code_commune(df_pro["code_commune"])
    df_pop["code_commune"] = _clean_code_commune(df_pop["code_commune"])

    df_pro[profession_col] = df_pro[profession_col].astype(str).str.strip()
    df_pro = df_pro[df_pro[profession_col].ne("")]
    df_pro["_pro_uid"] = _build_professional_uid(df_pro=df_pro, profession_col=profession_col)
    # Build weighted offer and address UID per row
    sj_w, addr_uids = _build_professional_offer_weights(df_pro=df_pro, profession_col=profession_col)
    df_pro["sj_weighted"] = sj_w
    df_pro["_addr_uid"] = addr_uids

    # Comptage unique des professionnels par spécialité (toute la Corse)
    df_pro_unique_global = df_pro.drop_duplicates(subset=["_pro_uid"])
    unique_counts = (
        df_pro_unique_global.groupby(profession_col).size().rename("_unique_count")
    )
    unique_counts_map = {f"nb_{_slugify(k)}": int(v) for k, v in unique_counts.items()}
    unique_counts_map["nb_professionnels_total"] = int(df_pro_unique_global.shape[0])

    df_pop["population"] = pd.to_numeric(df_pop["population"], errors="coerce").fillna(0)

    # Base communale exhaustive = population
    base = (
        df_pop[["code_commune", "commune", "population"]]
        .drop_duplicates(subset=["code_commune"])  # sécurité
        .set_index("code_commune")
        .sort_index()
    )

    # Effectif total de praticiens par commune (déduplication par professionnel)
    df_pro_unique = df_pro.drop_duplicates(subset=["code_commune", "_pro_uid"])
    total_counts = df_pro_unique.groupby("code_commune").size().rename("nb_professionnels_total")

    # Effectif par profession (catégorie) avec déduplication
    prof_counts = (
        df_pro_unique.groupby(["code_commune", profession_col]).size().unstack(fill_value=0)
    )

    # Nommage des colonnes par profession
    rename_map = {col: f"nb_{_slugify(col)}" for col in prof_counts.columns}
    prof_counts = prof_counts.rename(columns=rename_map)

    out = base.join(total_counts, how="left").join(prof_counts, how="left")
    out = out.fillna(0)

    # Colonnes d'effectifs en entiers
    nb_cols = [c for c in out.columns if c.startswith("nb_")]
    out[nb_cols] = out[nb_cols].astype(int)

    # Densités pour 10 000 habitants (total + par spécialité)
    _compute_densites(
        out,
        nb_total_col="nb_professionnels_total",
        dens_total_col="densite_professionnels_total_10000",
        nb_prefix="nb_",
        dens_prefix="densite_",
    )

    # --- Densités pondérées par S_j (si disponibles) ---
    pop = out["population"].replace(0, pd.NA)  # nécessaire pour les densités pondérées
    if "sj_weighted" in df_pro.columns:
        # somme des S_j par commune
        total_weights = df_pro.groupby("code_commune")["sj_weighted"].sum().rename("sum_sj")
        # somme des S_j par profession par commune
        prof_weights = (
            df_pro.groupby(["code_commune", profession_col])["sj_weighted"].sum().unstack(fill_value=0)
        )
        # joindre les sommes pondérées
        out = out.join(total_weights, how="left")

        # colonnes densité pondérée par spécialité
        for col in prof_weights.columns:
            slug = _slugify(col)
            dens_col_w = f"densite_{slug}_10000_weighted"
            out[dens_col_w] = (prof_weights[col].reindex(out.index) / pop) * 10000

        # densité totale pondérée
        out["densite_professionnels_total_10000_weighted"] = (out["sum_sj"].reindex(out.index) / pop) * 10000
        # arrondir et remplir
        w_dens_cols = [c for c in out.columns if c.endswith("_10000_weighted")]
        out[w_dens_cols] = out[w_dens_cols].fillna(0).round(4)
    else:
        out["sum_sj"] = 0.0

    # Indicateur de couverture (pipeline-first)
    # Diversité des spécialités (nombre de spécialités présentes par commune)
    _compute_diversite(
        out,
        dens_prefix="densite_",
        dens_total_col="densite_professionnels_total_10000",
        output_col="diversite_specialites",
    )

    # Score couverture : valeur brute [0,1] — Jenks calculé côté frontend
    zero_offer_mask = out["nb_professionnels_total"] <= 0
    out["score_couverture"] = _compute_score_couverture(
        out, "densite_professionnels_total_10000", "diversite_specialites", zero_offer_mask
    )

    # Score pondéré : même logique avec densité pondérée
    weighted_specialty_cols = [c for c in out.columns if c.startswith("densite_") and c.endswith("_10000_weighted") and c != "densite_professionnels_total_10000_weighted"]
    if weighted_specialty_cols:
        zero_offer_mask_w = out["sum_sj"].fillna(0) <= 0
        out["score_couverture_weighted"] = _compute_score_couverture(
            out, "densite_professionnels_total_10000_weighted", "diversite_specialites", zero_offer_mask_w
        )

    # Accessibilité gravitaire communale (pipeline-only)
    gravity_df = _compute_gravity_accessibility(df_pro=df_pro, carreaux_path=carreaux_path, commune_index=out.index)
    for col in gravity_df.columns:
        out[col] = gravity_df[col].astype(float).round(6)

    # Accessibilité 2SFCA communale (pipeline-only)
    sfca_df = _compute_2sfca_accessibility(df_pro=df_pro, carreaux_path=carreaux_path, commune_index=out.index)
    for col in sfca_df.columns:
        out[col] = sfca_df[col].astype(float).round(6)

    out.attrs["score_coverage_weights"] = SCORE_WEIGHTS
    out.attrs["gravity_beta_options"] = GRAVITY_BETA_OPTIONS
    out.attrs["gravity_radius_options_km"] = GRAVITY_RADIUS_OPTIONS_KM
    out.attrs["sfca_radius_options_km"] = SFCA_RADIUS_OPTIONS_KM
    out.attrs["offer_variants"] = {
        "raw": "S_j = 1 (non pondéré)",
        "weighted": "S_j pondéré multi-communes",
    }
    out.attrs["specialty_unique_counts"] = unique_counts_map

    return out


def _df_to_serializable_records(df: pd.DataFrame) -> dict[str, dict]:
    """Convertit un DataFrame en dictionnaire indexe numeriquement, compatible JSON frontend."""
    reset = df.reset_index()
    data: dict[str, dict] = {}
    for i, (_, row) in enumerate(reset.iterrows()):
        row_dict = row.to_dict()
        row_dict = {k: (None if (isinstance(v, float) and pd.isna(v)) else v) for k, v in row_dict.items()}
        data[str(i)] = row_dict
    return data

#Nettoie la base des pros
def _prepare_professionnels_for_tension_sampling(
    df_pro: pd.DataFrame,
    profession_col: str = "Profession",
) -> pd.DataFrame:
    """Prepare un DataFrame pro nettoye pour les tirages aleatoires par commune."""
    required = {"code_commune", profession_col}
    if not required.issubset(set(df_pro.columns)):
        missing = sorted(required - set(df_pro.columns))
        raise ValueError(f"Colonnes manquantes pour le tirage tensions: {missing}")

    work = df_pro.copy()
    work["code_commune"] = _clean_code_commune(work["code_commune"])
    work[profession_col] = work[profession_col].astype(str).str.strip()
    work = work[work["code_commune"].ne("")]
    work = work[work[profession_col].ne("")]
    work["_pro_uid"] = _build_professional_uid(work, profession_col=profession_col)
    return work

# Prépare l'ordre de retrait des pros
def _build_cumulative_random_removal_plan(
    df_pro_prepared: pd.DataFrame,
    scenario_levels: tuple[int, ...] = TENSION_SCENARIOS,
    random_seed: int = TENSION_RANDOM_SEED,
) -> dict[str, list[str]]:
    """
    Construit un plan de suppression cumulatif par commune.

    Exemple: pour une commune, la liste [A,B,C] implique:
      - N=1 retire A
      - N=2 retire A,B
      - N=3 retire A,B,C
    """
    levels = sorted({int(n) for n in scenario_levels if int(n) > 0})
    if not levels:
        return {}

    max_remove = levels[-1]
    if max_remove <= 0:
        return {}

    pool = (
        df_pro_prepared[["code_commune", "_pro_uid"]]
        .dropna()
        .drop_duplicates()
    )
    if pool.empty:
        return {}

    rng = np.random.default_rng(seed=random_seed)
    plan: dict[str, list[str]] = {}
    commune_codes = sorted(pool["code_commune"].astype(str).unique())
    for code in commune_codes:
        uids = pool.loc[pool["code_commune"].astype(str) == code, "_pro_uid"].astype(str).to_numpy()
        if uids.size == 0:
            continue
        order = rng.permutation(uids)
        plan[code] = order[: min(max_remove, len(order))].tolist()

    return plan

# Produit un dataframe réduit (N pros retirés par commune)
def _apply_cumulative_removal_plan(
    df_pro_prepared: pd.DataFrame,
    removal_plan: dict[str, list[str]],
    n_remove: int,
) -> pd.DataFrame:
    """Applique la suppression de n professionnels par commune selon un plan cumulatif pre-etabli."""
    n = int(n_remove)
    if n <= 0 or not removal_plan:
        return df_pro_prepared.copy()

    pairs: list[tuple[str, str]] = []
    for code, ordered_uids in removal_plan.items():
        if not ordered_uids:
            continue
        take = ordered_uids[: min(n, len(ordered_uids))]
        pairs.extend((str(code), str(uid)) for uid in take)

    if not pairs:
        return df_pro_prepared.copy()

    remove_df = pd.DataFrame(pairs, columns=["code_commune", "_pro_uid"]).drop_duplicates()
    remove_index = pd.MultiIndex.from_frame(remove_df)
    current_index = pd.MultiIndex.from_frame(
        pd.DataFrame(
            {
                "code_commune": df_pro_prepared["code_commune"].astype(str),
                "_pro_uid": df_pro_prepared["_pro_uid"].astype(str),
            }
        )
    )
    drop_mask = current_index.isin(remove_index)
    return df_pro_prepared.loc[~drop_mask].copy()


def build_tensions_offre_soins(
    professionnels_path: Path = PRO_PATH,
    population_path: Path = POP_PATH,
    carreaux_path: Path = CARREAUX_PATH,
    scenario_levels: tuple[int, ...] = TENSION_SCENARIOS,
    random_seed: int = TENSION_RANDOM_SEED,
) -> dict[int, pd.DataFrame]:
    """
    Construit les scenarios de tensions (N=1,2,3 retraits aleatoires par commune, cumulatifs).

    Le tirage est reproductible via random_seed et garantit l'inclusion:
    N=1 subset N=2 subset N=3 pour chaque commune.
    """
    levels = tuple(sorted({int(n) for n in scenario_levels if int(n) > 0}))
    if not levels:
        raise ValueError("scenario_levels doit contenir au moins un entier positif")

    df_pro_raw = pd.read_excel(professionnels_path)
    df_pop_raw = pd.read_excel(population_path)

    df_pro_sampling = _prepare_professionnels_for_tension_sampling(df_pro_raw)
    plan = _build_cumulative_random_removal_plan(
        df_pro_prepared=df_pro_sampling,
        scenario_levels=levels,
        random_seed=random_seed,
    )

    scenarios: dict[int, pd.DataFrame] = {}
    for n in levels:
        reduced = _apply_cumulative_removal_plan(df_pro_sampling, plan, n_remove=n)
        # racalcule tous les indicateurs sur la base réduite
        # retourne un dataframe complet pour ce scénario
        df_n = build_indicateurs_offre_soins(
            professionnels_path=professionnels_path,
            population_path=population_path,
            carreaux_path=carreaux_path,
            df_pro_input=reduced,
            df_pop_input=df_pop_raw,
        )
        df_n.attrs["tension_removed_per_commune"] = int(n)
        df_n.attrs["tension_random_seed"] = int(random_seed)
        scenarios[int(n)] = df_n

    return scenarios


def export_tensions_json_front(
    scenarios: dict[int, pd.DataFrame],
    output_path: Path = OUT_TENSIONS_JSON,
    random_seed: int = TENSION_RANDOM_SEED,
) -> None:
    """Exporte les scenarios de tensions dans un JSON dedie (N=1/2/3)."""
    if not scenarios:
        raise ValueError("Aucun scenario a exporter")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    levels = sorted(int(k) for k in scenarios.keys())

    payload = {
        "meta": {
            "random_seed": int(random_seed),
            "scenario_levels": levels,
            "sampling": "cumulative_random_removal_per_commune_without_replacement",
        },
        "scenarios": {},
    }

    for n in levels:
        df_n = scenarios[n]
        payload["scenarios"][f"remove_{n}"] = {
            "meta": {
                "removed_per_commune": n,
                "specialty_unique_counts": df_n.attrs.get("specialty_unique_counts", {}),
            },
            "data": _df_to_serializable_records(df_n),
        }

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def export_json_front(df: pd.DataFrame, output_path: Path = OUT_JSON) -> None:
    """
    Exporte un JSON indexé numériquement, proche du format déjà utilisé côté frontend.
    Remplace les NaN par null pour la validité JSON.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = _df_to_serializable_records(df)

    meta = {}
    if "specialty_unique_counts" in df.attrs:
        meta["specialty_unique_counts"] = df.attrs.get("specialty_unique_counts")

    with output_path.open("w", encoding="utf-8") as f:
        # None (qui devient null en JSON)
        payload = {"meta": meta, "data": data}
        json.dump(payload, f, ensure_ascii=False, indent=2)


def build_indicateurs_etablissements(
    etablissements_path: Path = ETAB_PATH,
    population_path: Path = POP_PATH,
    carreaux_path: Path = CARREAUX_PATH,
) -> pd.DataFrame:
    """
    Construit les indicateurs d'établissements sanitaires par commune.

    Retourne un DataFrame indexé sur code_commune avec colonnes :
    - commune
    - population
    - nb_etab_total
    - nb_etab_<categorie>
    - densite_etab_total_10000
    - densite_etab_<categorie>_10000
    - acc_grav_<version>_beta_<option>_<rayon>
    - acc_2sfca_<version>_<rayon>
    """
    df_etab = pd.read_excel(etablissements_path)
    df_pop = pd.read_excel(population_path)

    col_code = "code_commune"
    col_commune = "commune"
    col_finess = "Numéro FINESS ET"
    col_categorie = "libelle_categorie_etablissement"
    coord_col = "coord"

    missing = [
        name
        for name, col in {
            "code_commune": col_code,
            "commune": col_commune,
            "finess_et": col_finess,
            "libelle_categorie_etablissement": col_categorie,
            "coord": coord_col,
        }.items()
        if col not in df_etab.columns
    ]
    if missing:
        raise ValueError(f"Colonnes manquantes dans etablissements: {missing}")

    df_etab = df_etab.copy()
    df_pop = df_pop.copy()

    df_etab[col_code] = _clean_code_commune(df_etab[col_code])
    df_etab[col_finess] = df_etab[col_finess].astype(str).str.strip()
    df_etab[col_categorie] = df_etab[col_categorie].astype(str).str.strip()

    df_etab = df_etab[df_etab[col_code].ne("")]
    df_etab = df_etab[df_etab[col_finess].ne("")]
    df_etab = df_etab[df_etab[col_categorie].ne("")]

    df_etab = df_etab.drop_duplicates(subset=[col_finess])

    df_etab["Coordonnées"] = df_etab[coord_col]

    df_pop["code_commune"] = _clean_code_commune(df_pop["code_commune"])
    df_pop["population"] = pd.to_numeric(df_pop["population"], errors="coerce").fillna(0)

    base = (
        df_pop[["code_commune", "commune", "population"]]
        .drop_duplicates(subset=["code_commune"])
        .set_index("code_commune")
        .sort_index()
    )

    total_counts = df_etab.groupby(col_code).size().rename("nb_etab_total")
    cat_counts = (
        df_etab.groupby([col_code, col_categorie]).size().unstack(fill_value=0)
    )

    rename_map = {col: f"nb_etab_{_slugify(col)}" for col in cat_counts.columns}
    cat_counts = cat_counts.rename(columns=rename_map)

    out = base.join(total_counts, how="left").join(cat_counts, how="left").fillna(0)

    nb_cols = [c for c in out.columns if c.startswith("nb_etab_")]
    out[nb_cols] = out[nb_cols].astype(int)

    # Densités pour 10 000 habitants (total + par catégorie)
    _compute_densites(
        out,
        nb_total_col="nb_etab_total",
        dens_total_col="densite_etab_total_10000",
        nb_prefix="nb_etab_",
        dens_prefix="densite_etab_",
    )

    # Accessibilité gravitaire / 2SFCA pour les établissements (S_j = 1)
    # Score couverture établissements : valeur brute [0,1] — Jenks calculé côté frontend
    etab_cat_nb_cols = [c for c in out.columns if c.startswith("nb_etab_") and c != "nb_etab_total"]
    _compute_diversite(
        out,
        dens_prefix="densite_etab_",
        dens_total_col="densite_etab_total_10000",
        output_col="diversite_etab",
    )
    zero_etab_mask = out["nb_etab_total"] <= 0
    out["score_couverture"] = _compute_score_couverture(
        out, "densite_etab_total_10000", "diversite_etab", zero_etab_mask
    )

    if "Coordonnées" in df_etab.columns:
        gravity_df = _compute_gravity_accessibility(df_pro=df_etab, carreaux_path=carreaux_path, commune_index=out.index)
        gravity_cols = [c for c in gravity_df.columns if not c.endswith("_weighted")]
        for col in gravity_cols:
            out[col] = gravity_df[col].astype(float).round(6)

        sfca_df = _compute_2sfca_accessibility(df_pro=df_etab, carreaux_path=carreaux_path, commune_index=out.index)
        sfca_cols = [c for c in sfca_df.columns if not c.endswith("_weighted")]
        for col in sfca_cols:
            out[col] = sfca_df[col].astype(float).round(6)

    return out


def run() -> pd.DataFrame:
    OUT_PY_DIR.mkdir(parents=True, exist_ok=True)
    OUT_WEB_DIR.mkdir(parents=True, exist_ok=True)

    df = build_indicateurs_offre_soins()
    xlsx_path = OUT_XLSX
    json_path = OUT_JSON
    try:
        df.to_excel(xlsx_path)
    except PermissionError:
        xlsx_path = OUT_PY_DIR / "sante_indicateurs_professionnels_latest.xlsx"
        df.to_excel(xlsx_path)

    try:
        export_json_front(df, json_path)
    except PermissionError:
        json_path = OUT_WEB_DIR / "sante_indicateurs_professionnels_latest.json"
        export_json_front(df, json_path)

    tensions_json_path = OUT_TENSIONS_JSON
    tensions_scenarios = build_tensions_offre_soins(
        professionnels_path=PRO_PATH,
        population_path=POP_PATH,
        carreaux_path=CARREAUX_PATH,
        scenario_levels=TENSION_SCENARIOS,
        random_seed=TENSION_RANDOM_SEED,
    )
    try:
        export_tensions_json_front(
            scenarios=tensions_scenarios,
            output_path=tensions_json_path,
            random_seed=TENSION_RANDOM_SEED,
        )
    except PermissionError:
        tensions_json_path = OUT_WEB_DIR / "sante_tensions_professionnels_latest.json"
        export_tensions_json_front(
            scenarios=tensions_scenarios,
            output_path=tensions_json_path,
            random_seed=TENSION_RANDOM_SEED,
        )

    df_etab = build_indicateurs_etablissements()
    etab_xlsx_path = OUT_ETAB_XLSX
    etab_json_path = OUT_ETAB_JSON

    try:
        df_etab.to_excel(etab_xlsx_path)
    except PermissionError:
        etab_xlsx_path = OUT_PY_DIR / "etablissements_indicateurs_latest.xlsx"
        df_etab.to_excel(etab_xlsx_path)

    try:
        export_json_front(df_etab, etab_json_path)
    except PermissionError:
        
        etab_json_path = OUT_WEB_DIR / "etablissements_indicateurs_latest.json"
        export_json_front(df_etab, etab_json_path)

    projection_json_path = OUT_PROJECTION_JSON
    try:
        export_projection_offre_soins_json(
            demography_path=DEMOGRAPHY_PRO_PATH,
            output_path=projection_json_path,
            projection_end_year=PROJECTION_END_YEAR,
        )
    except PermissionError:
        projection_json_path = OUT_WEB_DIR / "projection_offre_soins_latest.json"
        export_projection_offre_soins_json(
            demography_path=DEMOGRAPHY_PRO_PATH,
            output_path=projection_json_path,
            projection_end_year=PROJECTION_END_YEAR,
        )

    print("Indicateurs Santé générés:")
    print(f"- {xlsx_path}")
    print(f"- {json_path}")
    print(f"- {tensions_json_path}")
    print(f"- {etab_xlsx_path}")
    print(f"- {etab_json_path}")
    print(f"- {projection_json_path}")

    # ── Export automatique des tableaux d'analyse ────────────────────────────
    try:
        from export_projection_tables import run_export
        run_export(json_path=projection_json_path)
        print("- Tableaux d'analyse exportés (4 fichiers)")
    except Exception as exc:
        print(f"[AVERTISSEMENT] Export tableaux échoué : {exc}")

    print(f"- communes: {len(df)}")
    print(f"- moyenne densité totale: {df['densite_professionnels_total_10000'].mean():.2f}")
    print("\n=== Audit des valeurs manquantes ===")
    nan_counts = df.isna().sum()
    nan_counts = nan_counts[nan_counts > 0]

    if nan_counts.empty:
        print("Aucun NaN détecté dans le DataFrame.")
    else:
        print(nan_counts)
        print("\nNombre total de NaN :", nan_counts.sum())

    return df


if __name__ == "__main__":
    run()
