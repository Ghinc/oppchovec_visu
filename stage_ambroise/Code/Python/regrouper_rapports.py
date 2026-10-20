"""
Regroupe tous les rapports et documents du projet OppChoVec dans un dossier rangé par thème, avec une page d'accueil (index.html) et un LISEZ_MOI.md.

Les fichiers sont COPIÉS (rien n'est déplacé : le dépôt reste inchangé). Les documents Markdown reçoivent aussi une version HTML (md_vers_html.py).
Les rapports du dépôt sont pris dans leur version commitée (git show HEAD:...), pour ne pas copier une modification en cours.

Usage (depuis stage_ambroise/Code/Python/) :
    python regrouper_rapports.py                       # écrit dans C:/These/rapports/outil_oppchovec
    python regrouper_rapports.py "<autre dossier>"
Relancer le script met le dossier à jour après de nouveaux rapports (ajouter une ligne dans RAPPORTS).
"""

import html
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

DEPOT = Path(__file__).resolve().parents[3]
CODE = "stage_ambroise/Code"
HORS_DEPOT = Path("C:/These/Données2/visualisation_oppchovec_010_1111/Rapport")
DEST = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("C:/These/rapports/outil_oppchovec")

# (dossier, chemin dans le dépôt ou fichier hors dépôt, titre, description)
RAPPORTS = [
    ("01_indice_courant_et_sources", f"{CODE}/RAPPORT_AUDIT_SOURCES_INDICE_COURANT.md", "Audit des sources de l'indice courant",
     "Les 17 variables de l'indice courant : lesquelles sont sourcées, lesquelles ne le sont pas, hétérogénéité des millésimes (2020-2024) et plan de remplacement homogène 2023-2025."),
    ("01_indice_courant_et_sources", f"{CODE}/VERIFICATION_COHERENCE_DONNEES.md", "Vérification de la cohérence des données et des formules",
     "Formules Python et JavaScript, exemple d'Ajaccio, échelles utilisées, Opp1, Vec1, et le détail de la série temporelle."),
    ("01_indice_courant_et_sources", f"{CODE}/WEB/README_FICHIERS.md", "Fichiers de l'application et procédure de régénération",
     "Tous les fichiers que l'appli charge, comment ils dérivent les uns des autres et comment les régénérer."),
    ("01_indice_courant_et_sources", f"{CODE}/Python/guide_integration_web.md", "Guide d'intégration des données 0-10 dans l'application web",
     "Comment utiliser les données dans une page web."),
    ("01_indice_courant_et_sources", f"{CODE}/Python/README.md", "Calcul de l'indice à l'échelle communale (oppchovec.py)",
     "Description du programme de calcul historique de l'indice."),
    ("01_indice_courant_et_sources", f"{CODE}/RAPPORT_COMPARAISON_INDICE_V1_V2.md", "Ancien et nouvel indice courant : ce qui change sur la carte",
     "Comparaison des cartes de l'indice v1 (2020-2024) et v2 (2023-2025), avec l'image des deux cartes, les classes qui changent, les indicateurs responsables et les communes qui bougent le plus."),
    ("02_onglet_evolution_2016_2021", f"{CODE}/RAPPORT_SOURCES_2016_2021_PAR_INDICATEUR.html", "Sources 2016 et 2021, indicateur par indicateur",
     "Pour chaque variable des 10 indicateurs : donnée récupérée, source et année pour 2016 et 2021, et explication de ce qui diffère. Inclut la couverture 4G calculée."),
    ("02_onglet_evolution_2016_2021", f"{CODE}/RAPPORT_VARIATIONS_EVOLUTION.md", "Pourquoi l'indice varie entre 2016 et 2021",
     "Décomposition des variations par indicateur, par taille de commune et par EPCI ; contrôles de cohérence."),
    ("02_onglet_evolution_2016_2021", f"{CODE}/RAPPORT_AUDIT_EVOLUTION.md", "Audit des écarts aberrants de l'onglet Évolution",
     "Communes aux écarts les plus forts, drapeau « transports en commun » d'Opp3, petites communes, Cho2, Vec1, Opp4."),
    ("02_onglet_evolution_2016_2021", f"{CODE}/RAPPORT_DONNEES_SERIE_TEMPORELLE.md", "Données téléchargées pour la série temporelle",
     "Fichiers utilisés pour 2016 et 2021, et comparaison avec les données de l'indice courant."),
    ("03_sources_anciennes_et_connectivite", f"{CODE}/RAPPORT_SOURCES_2000_2005_2010.html", "Sources pour 1999, 2006 et 2010",
     "Où trouver les données anciennes, ce qui manque, revenu médian et moyen."),
    ("03_sources_anciennes_et_connectivite", f"{CODE}/RAPPORT_OPP4_CONNECTIVITE_2015_2017.html", "Opp4 : connectivité avant 2018",
     "Sources communales de débit fixe et de couverture mobile pour 2015-2017 et origine de l'indicateur dans la documentation d'OppChoVec."),
    ("04_technique_et_tests", "tests/README.md", "Suite de tests de l'application",
     "Les quatre couches de tests (Python, JavaScript, navigateur, campagne de mutations), comment les lancer, les dettes connues."),
    ("04_technique_et_tests", f"{CODE}/Python/README_OSRM_LOCAL.md", "Installation du serveur d'itinéraires OSRM local",
     "Docker, extrait OpenStreetMap de la Corse et calcul des temps de trajet (Vec4)."),
    ("04_technique_et_tests", "COULEURS_CARTES.md", "Guide des couleurs des cartes",
     "Où sont définies les couleurs des cartes pour les modifier."),
    ("04_technique_et_tests", "GITIGNORE_INFO.md", "Fichiers ignorés par Git",
     "Ce qui est exclu du dépôt et pourquoi."),
    ("04_technique_et_tests", f"{CODE}/FICHIERS_A_SUPPRIMER.md", "Fichiers à supprimer (analyse ancienne)",
     "Inventaire de nettoyage du projet : plus ancien que les autres documents, à relire avant de s'y fier."),
    ("05_documents_de_reference", HORS_DEPOT / "Rapport_Stage.pdf", "Rapport de stage (2025)",
     "Rapport du stage qui a construit la méthode et les premières données de l'appli. Document hérité, hors dépôt."),
    ("05_documents_de_reference", HORS_DEPOT / "Document explicatif des sources de données de la méthode OppChoVec.pdf", "Document explicatif des sources de données (2025)",
     "Les sources déclarées par le stage pour chaque indicateur. Document hérité, hors dépôt."),
]
# noms plus parlants pour les fichiers dont le nom d'origine est ambigu (plusieurs README)
NOMS = {f"{CODE}/Python/README.md": "README_calcul_indice_python.md", "tests/README.md": "README_suite_de_tests.md", f"{CODE}/Python/README_OSRM_LOCAL.md": "README_serveur_itineraires_OSRM.md"}
DOSSIERS = {
    "01_indice_courant_et_sources": ("L'indice courant et ses sources", "L'onglet principal : d'où viennent les données, comment elles sont calculées et vérifiées."),
    "02_onglet_evolution_2016_2021": ("L'onglet « Évolution » 2016 → 2021", "L'indice comparable dans le temps : sources, variations, audit."),
    "03_sources_anciennes_et_connectivite": ("Sources anciennes et connectivité", "Recherches sur les années 1999, 2006, 2010 et sur Opp4 avant 2018."),
    "04_technique_et_tests": ("Technique et tests", "Installation, tests, couleurs, fichiers ignorés."),
    "05_documents_de_reference": ("Documents de référence", "Documents hérités du stage de 2025."),
}

CSS = """:root{--bg:#fbfaf7;--fg:#1f2328;--mut:#5c6670;--line:#d9d6cc;--card:#fff;--acc:#1d5fa8}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#15181c;--fg:#e6e6e6;--mut:#a0a8b0;--line:#3a4048;--card:#1d2126;--acc:#7db4f0}}
:root[data-theme="dark"]{--bg:#15181c;--fg:#e6e6e6;--mut:#a0a8b0;--line:#3a4048;--card:#1d2126;--acc:#7db4f0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:920px;margin:0 auto;padding:28px 16px 60px}h1{font-size:27px;margin:0 0 4px}h2{font-size:19px;margin:30px 0 4px}
.sous{color:var(--mut);margin:0 0 12px}.dos{color:var(--mut);margin:0 0 10px;font-size:14.5px}
.rap{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:8px 0}
.rap a{color:var(--acc);font-weight:600;text-decoration:none}.rap a:hover{text-decoration:underline}
.rap p{margin:2px 0 0;color:var(--mut);font-size:14.5px}.fmt{font-size:13px;color:var(--mut)}
footer{color:var(--mut);margin-top:34px;font-size:13px}"""


def lire_depot(chemin):
    """Contenu du fichier tel que commité (octets) ; None si le fichier n'est pas suivi par git."""
    r = subprocess.run(["git", "show", f"HEAD:{chemin}"], cwd=DEPOT, capture_output=True)
    return r.stdout if r.returncode == 0 else None


def date_modif(chemin):
    r = subprocess.run(["git", "log", "-1", "--format=%cs", "--", chemin], cwd=DEPOT, capture_output=True, text=True)
    d = r.stdout.strip()
    return datetime.strptime(d, "%Y-%m-%d").strftime("%d/%m/%Y") if d else ""


def main():
    if DEST.exists():
        for sous in DEST.iterdir():
            if sous.is_dir():
                shutil.rmtree(sous)
    DEST.mkdir(parents=True, exist_ok=True)
    convertisseur = Path(__file__).with_name("md_vers_html.py")
    index = {d: [] for d in DOSSIERS}
    for dossier, source, titre, description in RAPPORTS:
        cible = DEST / dossier
        cible.mkdir(parents=True, exist_ok=True)
        hors = isinstance(source, Path)
        nom = source.name if hors else NOMS.get(source, Path(source).name)
        if hors:
            if not source.exists():
                print("ABSENT :", source)
                continue
            shutil.copy(source, cible / nom)
            date = datetime.fromtimestamp(source.stat().st_mtime).strftime("%d/%m/%Y")
        else:
            contenu = lire_depot(source)
            if contenu is None:
                print("NON SUIVI PAR GIT :", source)
                continue
            (cible / nom).write_bytes(contenu)
            date = date_modif(source)
        formats = [nom]
        if not hors:                                                        # images associées au rapport (<nom>_*.png), si elles sont dans le dépôt
            dossier_src = source.rsplit("/", 1)[0]
            prefixe = Path(source).stem + "_"
            liste = subprocess.run(["git", "ls-files", dossier_src], cwd=DEPOT, capture_output=True, text=True).stdout.splitlines()
            for f in liste:
                if Path(f).name.startswith(prefixe) and f.endswith(".png"):
                    (cible / Path(f).name).write_bytes(lire_depot(f))
        if nom.endswith(".md"):                                           # version HTML du Markdown
            sortie = cible / (Path(nom).stem + ".html")
            html_depot = None if hors else lire_depot(source.rsplit(".", 1)[0] + ".html")
            if html_depot is not None:                                      # le HTML commité fait foi (il peut contenir des images intégrées)
                sortie.write_bytes(html_depot)
            else:
                subprocess.run([sys.executable, str(convertisseur), str(cible / nom), str(sortie)], check=True, capture_output=True)
            formats = [sortie.name, nom]
        elif nom.endswith(".html") and not hors:                          # rapport HTML : joindre le Markdown s'il existe
            md = lire_depot(source[:-5] + ".md")
            if md is not None:
                (cible / (Path(nom).stem + ".md")).write_bytes(md)
                formats = [nom, Path(nom).stem + ".md"]
        index[dossier].append((titre, description, date, dossier, formats))

    # page d'accueil
    h = ['<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapports OppChoVec</title>',
         f"<style>{CSS}</style></head><body><main>", "<h1>Rapports de l'outil OppChoVec</h1>",
         f'<p class="sous">Dossier mis à jour le {datetime.now().strftime("%d/%m/%Y")} · {sum(len(v) for v in index.values())} documents, rangés par thème</p>']
    md = ["# Rapports de l'outil OppChoVec", "", f"Dossier mis à jour le {datetime.now().strftime('%d/%m/%Y')}. Ouvrez `index.html` pour la liste cliquable.", ""]
    for d, (titre_d, desc_d) in DOSSIERS.items():
        if not index[d]:
            continue
        h += [f"<h2>{html.escape(titre_d)}</h2>", f'<p class="dos">{html.escape(desc_d)} <em>(dossier <code>{d}</code>)</em></p>']
        md += [f"## {titre_d}", "", f"{desc_d} (dossier `{d}`)", ""]
        for titre, description, date, dossier, formats in index[d]:
            liens = " · ".join(f'<a href="{dossier}/{f}">{html.escape(f)}</a>' if i else f'<a href="{dossier}/{f}">{html.escape(titre)}</a>' for i, f in enumerate(formats))
            h.append(f'<div class="rap">{liens.split(" · ")[0]}<p>{html.escape(description)}</p>'
                     f'<p class="fmt">{date}' + (" · aussi : " + " · ".join(f'<a href="{dossier}/{f}">{f}</a>' for f in formats[1:]) if len(formats) > 1 else "") + "</p></div>")
            md.append(f"- **{titre}** ({date}) : {description} Fichiers : " + ", ".join(f"`{dossier}/{f}`" for f in formats))
        md.append("")
    h.append("<footer>Fichiers copiés depuis le dépôt (version commitée) par <code>regrouper_rapports.py</code> ; relancer ce programme pour mettre le dossier à jour.</footer></main></body></html>")
    (DEST / "index.html").write_text("\n".join(h), encoding="utf-8")
    (DEST / "LISEZ_MOI.md").write_text("\n".join(md), encoding="utf-8")
    print(f"{sum(len(v) for v in index.values())} documents dans {DEST}")


if __name__ == "__main__":
    main()
