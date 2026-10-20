"""
Construit les 10 indicateurs de l'indice courant « v2 » à partir de sources officielles de millésimes homogènes (2023 à 2025), commune par commune, et les écrit dans
Données/indice_v2/sources_indice_v2.json (fichier versionné : composantes brutes de chaque indicateur, avec la provenance de chaque source).

Remplace l'indice « v1 » (millésimes 2020-2024, dont plusieurs sources inconnues : voir RAPPORT_AUDIT_SOURCES_INDICE_COURANT) ; l'ancien reste reconstructible (archive_indice_v1.py).

Indicateurs (mêmes définitions que la v1 sauf mention) :
  Opp1  niveau de diplôme moyen (7 niveaux) des 18 ans et plus non scolarisés ; recensement 2023, base communale « Diplômes - Formation » ; 15-17 ans non scolarisés retirés du niveau 1.
  Opp2  indice de Theil sur les 8 catégories socioprofessionnelles des 15 ans et plus ; recensement 2023, base « Évolution et structure de la population ».
  Opp3  % de ménages avec au moins une voiture (base « Logement 2023 ») + 100 si des actifs occupés vont travailler en transports en commun (base « Caractéristiques de l'emploi 2023 »,
        au moins une personne) + 100 pour Ajaccio, Bastia, Porto-Vecchio et L'Île-Rousse (réseaux de bus urbains réguliers, transport.data.gouv.fr).
  Opp4  (4G + débit >= 30 Mbit/s + fibre) / 3, en % : 4G = population couverte par au moins un opérateur (ARCEP T4 2024 x grille INSEE de 200 m) ; débit et fibre = locaux éligibles
        (ARCEP « Ma connexion internet » T4 2024, offres filaires).
  Cho1  -log(nombre de personnes vivant en quartier prioritaire), 0 sans quartier ; INSEE, population communale en QPV 2024 (référence 1er janvier 2020, publiée en 2025).
  Cho2  % de Français parmi les 18 ans et plus (proxy du droit de vote), méthode de proportion_etrangers_18plus_final.py ; recensement 2023, tables NAT1 et POP1.
  Vec1  revenu fiscal moyen par foyer fiscal (DGFiP, IRCOM revenus 2024) ; communes sous secret statistique : moyenne du département.
  Vec2  (exp(-personnes par pièce) + part de maisons) / 2 ; recensement 2023, base « Logement ». Personnes par pièce = personnes des ménages / pièces des résidences principales ;
        maisons = part des résidences principales de type maison. La v1 avait un terme de confort (salle de bain + chauffage)/2 (poids 1/3) qui ne reposait sur aucune donnée mesurée :
        le chauffage valait 1 pour toutes les communes, et la salle de bain (baignoire ou douche et WC) n'est plus publiée par commune dans le recensement 2023 (cellules « nd »). Ce terme
        étant (quasi) constant, le retirer ne change pas les scores normalisés (transformation affine) mais retire une donnée sans source.
  Vec3  stabilité de l'emploi : chômeurs 0, autres contrats 0,5, CDI-fonctionnaires et non-salariés 1. Le recensement 2023 ne distingue plus CDD, intérim, emplois aidés et apprentis (une seule
        catégorie « autre contrat ») : elles sont regroupées au poids moyen 0,5 (0,25 ; 0,5 ; 0,75 en v1). Simulé sur 2021, ce regroupement donne une corrélation de 0,98 avec l'ancien calcul.
  Vec4  nombre d'équipements de la BPE 2024 accessibles en 20 minutes en voiture (OSRM) : inchangé, déjà de 2024.

Usage (depuis stage_ambroise/Code/Python/) :
    python construire_indice_v2.py "C:/These/Données2/indice_v2_sources"
Contenu attendu du dossier : voir son LISEZ_MOI.md.
"""

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from construire_serie_temporelle import indicateur_revenu_fiscal, theil

RACINE = Path(__file__).resolve().parents[2]
GEOJSON = RACINE / "Données" / "Commune_Corse.geojson"
SORTIE = RACINE / "Données" / "indice_v2" / "sources_indice_v2.json"
VILLES_RESEAU_BUS = {"2A004", "2B033", "2A247", "2B134"}
NIVEAUX = {"DIPLMIN": 1, "BEPC": 2, "CAPBEP": 3, "BAC": 4, "SUP2": 5, "SUP34": 6, "SUP5": 7}


def lire(chemin, **kw):
    d = pd.read_csv(chemin, sep=";", dtype={"CODGEO": str}, **kw).set_index("CODGEO")
    for col in d.columns:
        if col != "LIBGEO":
            d[col] = pd.to_numeric(d[col], errors="coerce")       # cellules non diffusées (« s », « ns ») -> NaN
    return d


def indicateurs(dossier):
    dossier = Path(dossier)
    noms = {f["properties"]["code"]: f["properties"]["nom"] for f in json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]}
    codes = list(noms)
    rp = dossier / "rp2023"
    sortie = {c: {"code": c} for c in codes}

    def ajouter(nom, serie_ou_df):
        for c in codes:
            v = serie_ou_df.loc[c]
            sortie[c][nom] = {k: float(x) for k, x in v.items()} if isinstance(v, pd.Series) else float(v)

    # --- Opp1 : diplôme (base communale 2023, mêmes colonnes qu'avant)
    d = lire(rp / "base_cc_diplomes_formation_2023.csv").reindex(codes)
    eff = pd.DataFrame({n: d[f"P23_NSCOL15P_{k}"] for k, n in NIVEAUX.items()})
    if (eff.sum(axis=1) - d["P23_NSCOL15P"]).abs().max() > 1e-3:
        sys.exit("Opp1 : la somme des 7 niveaux n'est pas le total des 15 ans et plus non scolarisés")
    retire = (d["P23_POP1517"] - d["P23_SCOL1517"]).clip(lower=0).clip(upper=eff[1])
    eff[1] = eff[1] - retire
    opp1 = (eff * eff.columns.to_numpy()).sum(axis=1) / eff.sum(axis=1)
    for c in codes:
        sortie[c]["Opp1"] = {"valeur": float(opp1[c]), "retire_15_17": float(retire[c]), **{f"niveau{n}": float(eff.loc[c, n]) for n in eff.columns}}

    # --- Opp2 : Theil sur les 8 catégories socioprofessionnelles
    d = lire(rp / "base_cc_evol_struct_pop_2023.csv").reindex(codes)
    cs = [c for c in d.columns if c.startswith("C23_POP15P_STAT_GSEC")]
    if len(cs) != 8:
        sys.exit(f"Opp2 : 8 catégories attendues, trouvé {cs}")
    x = d[cs].astype(float)
    t = theil(x)
    for c in codes:
        sortie[c]["Opp2"] = {"valeur": float(t[c]), **{f"cs{i + 1}": float(x.loc[c].iloc[i]) for i in range(8)}}

    # --- Opp3 (voiture, transports en commun) et Vec2 (logement) : base Logement 2023 et base emploi 2023
    lg = lire(rp / "base_cc_logement_2023.csv").reindex(codes)
    ce = lire(rp / "base_cc_caract_emp_2023.csv").reindex(codes)
    voiture = 100 * lg["P23_RP_VOIT1P"] / lg["P23_RP"]
    tc = ce["P23_ACTOCC15P_COMMUN"]
    for c in codes:
        sortie[c]["Opp3"] = {"valeur": float(voiture[c] + 100 * (tc[c] > 0) + 100 * (c in VILLES_RESEAU_BUS)), "voiture": float(voiture[c]), "tc_actifs": float(tc[c]),
                             "tc": 100.0 * float(tc[c] > 0), "bus": 100.0 * float(c in VILLES_RESEAU_BUS)}
    ppp = lg["P23_PMEN"] / lg["P23_NBPI_RP"]
    maisons = lg["P23_RPMAISON"] / lg["P23_RP"]
    for c in codes:
        sortie[c]["Vec2"] = {"valeur": float((math.exp(-ppp[c]) + maisons[c]) / 2), "pers_piece": float(ppp[c]), "maisons": float(maisons[c]),
                             "residences_principales": float(lg.loc[c, "P23_RP"])}

    # --- Vec3 : stabilité de l'emploi (3 catégories en 2023)
    ac = lire(rp / "base_cc_emploi_pop_active_2023.csv").reindex(codes)
    autre_h = next(k for k in ce.columns if k.startswith("(P23_HSAL15P_CDD)"))
    autre_f = next(k for k in ce.columns if k.startswith("(P23_FSAL15P_CDD)"))
    chom = ac["P23_CHOM1564"]
    stable = ce["P23_HSAL15P_CDI"] + ce["P23_FSAL15P_CDI"] + ce["P23_NSAL15P"]
    autres = ce[autre_h] + ce[autre_f]
    tot = chom + stable + autres
    for c in codes:
        sortie[c]["Vec3"] = {"valeur": float((0.5 * autres[c] + stable[c]) / tot[c]), "chomeur": float(chom[c]), "autres": float(autres[c]), "stable": float(stable[c])}

    # --- Cho2 : part de Français parmi les 18 ans et plus
    pop = lire(rp / "TD_POP1_2023.csv").reindex(codes)
    total = pop.drop(columns=["LIBGEO"]).astype(float).sum(axis=1)
    p1824 = pop[[col for col in pop.columns if any(col.split("\n")[-1].strip() == f"{a} ans" and col.startswith(("Homme", "Femme")) for a in range(18, 25))]].astype(float).sum(axis=1)
    nat = lire(rp / "TD_NAT1_2023.csv").reindex(codes)
    fr1524 = nat[[col for col in nat.columns if col.startswith("De 15") and "Fran" in col]].astype(float).sum(axis=1)
    etr25 = nat[[col for col in nat.columns if col.startswith(("De 25", "55")) and "Etranger" in col]].astype(float).sum(axis=1)
    etr18 = (p1824 - 0.7 * fr1524) + etr25
    cho2 = (100 - 100 * etr18 / total).clip(upper=100)
    for c in codes:
        sortie[c]["Cho2"] = {"valeur": float(cho2[c]), "population": float(total[c]), "pop_18_24": float(p1824[c]), "francais_15_24": float(fr1524[c]),
                             "etrangers_25_plus": float(etr25[c]), "etrangers_18_plus": float(etr18[c])}

    # --- Opp4 : 4G, débit, fibre
    deb = pd.read_csv(dossier / "arcep_2024_T4" / "commune_debit_filaire.csv", sep=";", dtype={"code_insee": str}).set_index("code_insee")
    tec = pd.read_csv(dossier / "arcep_2024_T4" / "commune_techno.csv", sep=";", dtype={"code_insee": str}).set_index("code_insee")
    g4 = json.loads((dossier / "couverture_4g" / "couverture4g_2024_T4.json").read_text(encoding="utf-8"))["communes"]
    for c in codes:
        a = float(g4[noms[c]]["part_population_couverte_4g_pct"]["au_moins_un"])
        b = 100 * float(deb.loc[c, "elig_thd30"]) / float(deb.loc[c, "nbr"])
        f = 100 * float(tec.loc[c, "elig_ftth"]) / float(tec.loc[c, "nbr"])
        sortie[c]["Opp4"] = {"valeur": (a + b + f) / 3, "g4": a, "debit": b, "fibre": f}

    # --- Cho1 : quartiers prioritaires
    q = pd.read_excel(dossier / "qpv_2024" / "pop_reference_communales_QPV24.xlsx", sheet_name=0, header=None)
    q = q[q[0].astype(str).isin(["2A", "2B"])].set_index(1)[3]
    for c in codes:
        p = float(q.get(c, 0))
        sortie[c]["Cho1"] = {"valeur": -math.log(p) if p > 0 else 0.0, "personnes_qpv": p}

    # --- Vec1 : revenu fiscal moyen par foyer fiscal (IRCOM)
    moy, moy_dep, comp = indicateur_revenu_fiscal(dossier / "ircom_2024")
    for c in codes:
        propre = not pd.isna(moy.get(c))
        sortie[c]["Vec1"] = {"valeur": float(moy[c]) if propre else float(moy_dep[c[:2]]), "foyers": float(comp.loc[c, "nb_foyers"]),
                             "revenu_fiscal": float(comp.loc[c, "revenu_fiscal"]), "departemental": not propre}

    # --- Vec4 : services à 20 minutes (BPE 2024, inchangé)
    v4 = pd.read_csv(dossier / "vec4_bpe2024" / "services_accessibles_20min_local.csv").set_index("code_commune")["nb_services_20min"]
    for c in codes:
        sortie[c]["Vec4"] = {"valeur": float(v4[c])}
    return noms, sortie


SOURCES = {
    "Opp1": "INSEE, recensement 2023, base communale Diplômes - Formation (base_cc_diplomes_formation_2023), mise en ligne le 25/06/2026",
    "Opp2": "INSEE, recensement 2023, base communale Évolution et structure de la population (base_cc_evol_struct_pop_2023)",
    "Opp3": "INSEE, recensement 2023, bases communales Logement (ménages avec voiture) et Caractéristiques de l'emploi (actifs occupés en transports en commun) ; réseaux de bus urbains réguliers : Muvistrada, Via Bastia, A Citadina, A Balanina (transport.data.gouv.fr), sélection faite par la doctorante",
    "Opp4": "ARCEP, couvertures théoriques 4G T4 2024 (4 opérateurs) x grille de population INSEE Filosofi 200 m (2021) ; ARCEP « Ma connexion internet » T4 2024, offres filaires (commune_debit_filaire, commune_techno)",
    "Cho1": "INSEE, population communale en QPV 2024 (pop_reference_communales_QPV24, référence 1er janvier 2020, publiée le 10/07/2025)",
    "Cho2": "INSEE, recensement 2023, tables détaillées NAT1 (nationalité) et POP1 (population par sexe et âge)",
    "Vec1": "DGFiP, IRCOM revenus 2024 (ircom-2025-revenus-2024) : revenu fiscal de référence total / nombre de foyers fiscaux, ligne « Total » de la commune",
    "Vec2": "INSEE, recensement 2023, base communale Logement (base_cc_logement_2023)",
    "Vec3": "INSEE, recensement 2023, bases communales Caractéristiques de l'emploi et Emploi - population active",
    "Vec4": "INSEE, base permanente des équipements 2024 ; temps de trajet OSRM sur OpenStreetMap (Geofabrik, 06/11/2025)",
}
MILLESIMES = {"Opp1": "2023", "Opp2": "2023", "Opp3": "2023", "Opp4": "T4 2024", "Cho1": "QPV 2024 (population au 1er janvier 2020)", "Cho2": "2023", "Vec1": "revenus 2024",
              "Vec2": "2023", "Vec3": "2023", "Vec4": "2024"}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    noms, sortie = indicateurs(sys.argv[1])
    donnees = {"version": "v2", "description": "Composantes brutes des 10 indicateurs de l'indice courant v2 (sources 2023-2025)", "sources": SOURCES, "millesimes": MILLESIMES,
               "communes": {noms[c]: v for c, v in sortie.items()}}
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(json.dumps(donnees, indent=1, ensure_ascii=False), encoding="utf-8")
    for k in MILLESIMES:
        v = np.array([c[k]["valeur"] for c in donnees["communes"].values()])
        print(f"{k}  moyenne {v.mean():10.3f}  min {v.min():10.3f}  max {v.max():10.3f}  NaN {int(np.isnan(v).sum())}")
    print("écrit :", SORTIE)


if __name__ == "__main__":
    main()
