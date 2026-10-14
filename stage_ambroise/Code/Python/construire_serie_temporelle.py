"""
Construit une version COMPARABLE dans le temps de l'indice OppChoVec pour deux années (2016 et 2021), pour les 360 communes corses.
Écrit Code/WEB/serie_temporelle.json (lu par l'onglet « Évolution » de l'appli).

Principe : mêmes sources, mêmes définitions, mêmes bornes de normalisation pour les deux années. On ne garde que les indicateurs pour lesquels une
source homogène existe aux deux dates (7 sur 10) ; Opp4 (4G, haut débit, fibre), Cho1 (quartiers prioritaires) et Vec4 (services à 20 minutes)
sont EXCLUS de cet indice : pas de source communale homogène trouvée pour 2016. Ce n'est donc pas l'indice OppChoVec complet de l'appli.

Indicateurs (identiques aux deux dates ; recensement INSEE, bases « principaux indicateurs » communales, sauf mention)
  Opp1  niveau de diplôme moyen des 18 ans et plus non scolarisés, sur 4 niveaux comparables (1 aucun diplôme ou brevet, 2 CAP-BEP, 3 bac,
        4 enseignement supérieur) : le détail à 7 niveaux n'existe pas dans le millésime 2016. Les 15-17 ans non scolarisés sont retirés du niveau 1.
  Opp2  indice de Theil sur les 8 catégories socioprofessionnelles des 15 ans et plus (formule de oppchovec.py : Σ (x/μ) ln(x/μ) / 8)
  Opp3  part des ménages ayant au moins une voiture (%) + 100 si des actifs occupés vont travailler en transports en commun
        + 100 pour les 3 villes ayant un réseau de bus (Ajaccio, Bastia, Porto-Vecchio ; inchangé)
  Cho2  part des Français parmi la population de 15 ans et plus (%), tables NAT1 (population par âge, sexe, nationalité). Approximation : l'indicateur
        actuel est calculé sur les 18 ans et plus avec une règle de proportionnalité sur la tranche 15-24 ans.
  Vec1  revenu fiscal de référence moyen par foyer fiscal (DGFiP, IRCOM, revenus de l'année) ; communes non communiquées : moyenne de leur département
  Vec2  (exp(-personnes par pièce) + (salle de bain + chauffage)/2 + part de maisons) / 3, avec chauffage = 1 (constant, comme dans les données actuelles)
  Vec3  stabilité de l'emploi : chômeurs 0, emplois aidés 0,25, intérim et apprentis 0,5, CDD 0,75, CDI et non-salariés 1, pondérés par leurs effectifs

Normalisation : min-max de chaque indicateur sur les deux années ensemble (échelle commune) ; dimension = moyenne des indicateurs disponibles ;
OppChoVec = (1/3) (Σ p_k d_k^1,5)^(2,5/1,5), p_k de Betti et al. calculés sur les deux années ensemble ; mise à l'échelle 0-10 sur les deux années ensemble.
Seuils de couleur : Jenks à 5 classes sur les valeurs des deux années ensemble (mêmes seuils pour les deux cartes).

Usage (depuis stage_ambroise/Code/Python/) :
    python construire_serie_temporelle.py "<dossier>"
où <dossier> contient deux sous-dossiers « 2016 » et « 2021 » avec, sous leurs noms d'origine, les fichiers INSEE / DGFiP décrits dans
WEB/README_FICHIERS.md (section « Série temporelle »).
"""

import glob
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

RACINE = Path(__file__).resolve().parents[2]
GEOJSON = RACINE / "Données" / "Commune_Corse.geojson"
SORTIE = Path(__file__).resolve().parent.parent / "WEB" / "serie_temporelle.json"
ANNEES = (2016, 2021)
INDICATEURS = ["Opp1", "Opp2", "Opp3", "Cho2", "Vec1", "Vec2", "Vec3"]
DIMENSIONS = {"Opp": ["Opp1", "Opp2", "Opp3"], "Cho": ["Cho2"], "Vec": ["Vec1", "Vec2", "Vec3"]}
VILLES_RESEAU_BUS = {"2A004", "2B033", "2A247"}
ALPHA, BETA = 2.5, 1.5


def trouver(dossier, *motifs):
    fichiers = [f for f in glob.glob(str(Path(dossier) / "*")) if all(m.lower() in Path(f).name.lower() for m in motifs)
                and not Path(f).name.lower().startswith("meta")]
    if len(fichiers) != 1:
        sys.exit(f"{dossier} : attendu un fichier contenant {motifs}, trouvé {fichiers}")
    return fichiers[0]


def lire_base_cc(chemin, colonnes):
    d = pd.read_csv(chemin, sep=";", dtype=str, usecols=lambda c: c == "CODGEO" or c in colonnes, low_memory=False, encoding="latin1")
    d = d[d["CODGEO"].str.startswith(("2A", "2B"))].set_index("CODGEO")
    manquantes = set(colonnes) - set(d.columns)
    if manquantes:
        sys.exit(f"{chemin} : colonnes absentes {sorted(manquantes)}")
    return d[list(colonnes)].astype(float)


def theil(x):
    """x : DataFrame (communes x catégories). Σ (x/μ) ln(x/μ) / n, avec 0 ln 0 = 0 (formule des données actuelles)."""
    mu = x.mean(axis=1)
    r = x.div(mu, axis=0)
    return (r * np.log(r.where(r > 0))).fillna(0).sum(axis=1) / x.shape[1]


def indicateurs_recensement(dossier, an):
    a = str(an)[2:]
    P = lambda s: f"P{a}_{s}"
    # --- Opp1 : diplômes
    f = trouver(dossier, "dipl")
    niveaux2021 = [P("NSCOL15P_DIPLMIN"), P("NSCOL15P_BEPC"), P("NSCOL15P_CAPBEP"), P("NSCOL15P_BAC"), P("NSCOL15P_SUP2"), P("NSCOL15P_SUP34"), P("NSCOL15P_SUP5")]
    niveaux2016 = [P("NSCOL15P_DIPLMIN"), P("NSCOL15P_CAPBEP"), P("NSCOL15P_BAC"), P("NSCOL15P_SUP")]
    colonnes = niveaux2016 if an < 2017 else niveaux2021
    d = lire_base_cc(f, colonnes + [P("POP1517"), P("SCOL1517")])
    n1 = d[P("NSCOL15P_DIPLMIN")] + (0 if an < 2017 else d[P("NSCOL15P_BEPC")])
    n4 = d[P("NSCOL15P_SUP")] if an < 2017 else d[P("NSCOL15P_SUP2")] + d[P("NSCOL15P_SUP34")] + d[P("NSCOL15P_SUP5")]
    n1 = n1 - (d[P("POP1517")] - d[P("SCOL1517")]).clip(lower=0).clip(upper=n1)         # 15-17 ans non scolarisés retirés du niveau 1
    effectifs = pd.concat([n1, d[P("NSCOL15P_CAPBEP")], d[P("NSCOL15P_BAC")], n4], axis=1)
    out = pd.DataFrame(index=d.index)
    out["Opp1"] = (effectifs * [1, 2, 3, 4]).sum(axis=1) / effectifs.sum(axis=1)
    # --- Opp2 : Theil sur les CSP
    d = lire_base_cc(trouver(dossier, "evol-struct"), [f"C{a}_POP15P_CS{i}" for i in range(1, 9)])
    out["Opp2"] = theil(d)
    # --- Opp3 : voiture + transports en commun + réseau de bus
    d = lire_base_cc(trouver(dossier, "log"), [P("RP"), P("NPER_RP"), P("NBPI_RP"), P("RP_SDB"), P("RPMAISON"), P("RP_VOIT1P")])
    ce = lire_base_cc(trouver(dossier, "carac"), [P("ACTOCC15P_COMMUN"), P("NSAL15P")] + [f"P{a}_{s}SAL15P_{k}" for s in "HF" for k in ("CDI", "CDD", "INTERIM", "EMPAID", "APPR")])
    out["Opp3"] = 100 * d[P("RP_VOIT1P")] / d[P("RP")] + 100 * (ce[P("ACTOCC15P_COMMUN")] > 0) + 100 * out.index.isin(VILLES_RESEAU_BUS)
    # --- Vec2
    ppp = d[P("NPER_RP")] / d[P("NBPI_RP")]
    out["Vec2"] = (np.exp(-ppp) + (d[P("RP_SDB")] / d[P("RP")] + 1.0) / 2 + d[P("RPMAISON")] / d[P("RP")]) / 3
    # --- Vec3
    act = lire_base_cc(trouver(dossier, "emploi-pop"), [P("CHOM1564"), P("ACT1564")])
    H = lambda k: ce[f"P{a}_HSAL15P_{k}"] + ce[f"P{a}_FSAL15P_{k}"]
    comptes = pd.DataFrame({"chom": act[P("CHOM1564")], "aide": H("EMPAID"), "ponctuel": H("INTERIM") + H("APPR"), "cdd": H("CDD"),
                            "stable": H("CDI") + ce[P("NSAL15P")]})
    out["Vec3"] = (comptes * [0, 0.25, 0.5, 0.75, 1]).sum(axis=1) / comptes.sum(axis=1)
    return out


def indicateur_nationalite(dossier):
    f = trouver(dossier, "NAT1")
    d = pd.read_csv(f, sep=";", dtype=str, encoding="latin1")
    d = d[d["CODGEO"].str.startswith(("2A", "2B")) & (d["AGE4"] != "00")]                  # 15 ans et plus
    d["NB"] = d["NB"].astype(float)
    t = d.groupby("CODGEO")["NB"].sum()
    fr = d[d["INATC"] == "1"].groupby("CODGEO")["NB"].sum()
    return (100 * fr / t).rename("Cho2")


def indicateur_revenu(dossier):
    """Revenu fiscal de référence moyen par foyer, ligne « Total » de la commune (le fichier 2016 et le fichier 2021 n'ont pas la même mise en page)."""
    f = trouver(dossier, "ircom_communes")
    brut = pd.read_excel(f, sheet_name=0, header=None)
    entete = next(i for i in range(15) if "Libell" in " ".join(brut.iloc[i].astype(str)))
    d = brut.iloc[entete + 1:, 1:9].copy()
    d.columns = ["dep", "com", "lib", "tranche", "nb_foyers", "rfr", "impot", "nb_imposes"]
    d = d.dropna(subset=["dep"])
    d["dep"] = d["dep"].astype(str).str.strip()
    d = d[d["dep"].isin(["2A0", "2B0"]) & (d["tranche"].astype(str).str.strip().str.upper() == "TOTAL")].copy()
    d["code"] = d["dep"].str[:2] + d["com"].astype(str).str.strip().str.replace(r"\.0$", "", regex=True).str.zfill(3)
    d["nb_foyers"] = pd.to_numeric(d["nb_foyers"], errors="coerce")
    d["rfr_k"] = pd.to_numeric(d["rfr"], errors="coerce")
    t = d.set_index("code")
    ok = t["nb_foyers"].gt(0) & t["rfr_k"].notna()
    moy_dep = {}
    for dep in ("2A", "2B"):
        sel = t[ok & t.index.str.startswith(dep)]
        moy_dep[dep] = sel["rfr_k"].sum() * 1000 / sel["nb_foyers"].sum()
    val = pd.Series({c: (r["rfr_k"] * 1000 / r["nb_foyers"] if ok[c] else moy_dep[c[:2]]) for c, r in t.iterrows()}, name="Vec1")
    return val, ~ok.rename("estime")


def minmax(s, lo, hi):
    return (s - lo) / (hi - lo) if hi != lo else s * 0.0


def pk_betti(scores):
    """scores : DataFrame (observations x [Opp, Cho, Vec]) en [0, 1]. p_k = cv_k / moyenne(|corrélations|), normalisé à 1 (Betti et al., 2008)."""
    cv = scores.std(ddof=0) / scores.mean()
    corr = scores.corr().abs().mean()
    brut = cv / corr
    return (brut / brut.sum()).tolist()


def calculer(source):
    source = Path(source)
    noms = {f["properties"]["code"]: f["properties"]["nom"] for f in json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]}
    brut, estimees = {}, {}
    for an in ANNEES:
        dossier = source / str(an)
        t = indicateurs_recensement(dossier, an)
        t["Cho2"] = indicateur_nationalite(dossier)
        t["Vec1"], estimees[an] = indicateur_revenu(dossier)
        t = t[INDICATEURS]
        if set(t.index) != set(noms) or t.isna().any().any():
            sys.exit(f"{an} : communes ou valeurs manquantes (écart communes {sorted(set(noms) ^ set(t.index))[:5]}, NaN {t.isna().sum().to_dict()})")
        brut[an] = t.loc[list(noms)]
    # normalisation commune aux deux années
    tout = pd.concat(brut.values())
    lo, hi = tout.min(), tout.max()
    norm = {an: pd.DataFrame({k: minmax(brut[an][k], lo[k], hi[k]) for k in INDICATEURS}) for an in ANNEES}
    dims = {an: pd.DataFrame({d: norm[an][ks].mean(axis=1) for d, ks in DIMENSIONS.items()}) for an in ANNEES}
    pk = pk_betti(pd.concat(dims.values()))
    brut_idx = {an: (1 / 3) * sum(p * dims[an][d] ** BETA for p, d in zip(pk, DIMENSIONS)) ** (ALPHA / BETA) for an in ANNEES}
    idx_all = pd.concat(brut_idx.values())
    i_lo, i_hi = idx_all.min(), idx_all.max()
    d_lo = pd.concat(dims.values()).min()
    d_hi = pd.concat(dims.values()).max()
    resultat = {an: pd.DataFrame({"OppChoVec": minmax(brut_idx[an], i_lo, i_hi) * 10,
                                  **{d: minmax(dims[an][d], d_lo[d], d_hi[d]) * 10 for d in DIMENSIONS}}) for an in ANNEES}
    import jenkspy
    seuils = {v: [float(x) for x in jenkspy.jenks_breaks(pd.concat([resultat[an][v] for an in ANNEES]).tolist(), 5)[1:-1]] for v in ("OppChoVec", "Opp", "Cho", "Vec")}
    communes = {}
    for code, nom in noms.items():
        communes[nom] = {"code": code}
        for an in ANNEES:
            communes[nom][str(an)] = {"indicateurs": {k: float(brut[an].loc[code, k]) for k in INDICATEURS},
                                      "scores_0_10": {v: float(resultat[an].loc[code, v]) for v in ("OppChoVec", "Opp", "Cho", "Vec")},
                                      "revenu_estime_departement": bool(estimees[an][code])}
    return {"annees": list(ANNEES), "indicateurs": INDICATEURS, "dimensions": DIMENSIONS,
            "p_k_betti": dict(zip(DIMENSIONS, pk)), "seuils_jenks": seuils,
            "echelle": {k: [float(lo[k]), float(hi[k])] for k in INDICATEURS},
            "exclus": {"Opp4": "4G, haut débit, fibre : pas de source communale homogène pour 2016", "Cho1": "quartiers prioritaires : géographie 2015 puis 2024, pas de série",
                       "Vec4": "services à 20 minutes : accessibilité calculée avec le réseau routier actuel (OSRM local), BPE 2016 non géolocalisée de la même façon"},
            "communes": communes}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    donnees = calculer(sys.argv[1])
    SORTIE.write_text(json.dumps(donnees, indent=1, ensure_ascii=False), encoding="utf-8")
    c = donnees["communes"]
    for an in ANNEES:
        v = [x[str(an)]["scores_0_10"]["OppChoVec"] for x in c.values()]
        print(f"{an} : OppChoVec 0-10 min {min(v):.2f}, moyenne {sum(v) / len(v):.2f}, max {max(v):.2f}")
    print("p_k :", {k: round(v, 3) for k, v in donnees["p_k_betti"].items()})
    print("seuils de Jenks :", {k: [round(x, 2) for x in v] for k, v in donnees["seuils_jenks"].items()})
    print(f"écrit : {SORTIE}")


if __name__ == "__main__":
    main()
