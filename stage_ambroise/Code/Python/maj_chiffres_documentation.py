"""
Reporte dans la documentation les chiffres qui dépendent des données (après une régénération de l'indice) :

  * WEB/README_FICHIERS.md : tableaux des seuils de Jenks, tableau des clusters LISA significatifs, valeur de l'exemple « test rapide » ;
  * VERIFICATION_COHERENCE_DONNEES.md : exemple d'Ajaccio (scores) et échelles observées des indicateurs ;
  * WEB/script.js : seuils de Jenks de repli (`let seuilsJenks`).

Les tests de cohérence avec la documentation (tests/python/test_06_documentation.py) échouent tant que ces chiffres ne sont pas à jour.

Usage (depuis stage_ambroise/Code/Python/) :
    python maj_chiffres_documentation.py
"""

import json
import re
from pathlib import Path

CODE = Path(__file__).resolve().parents[1]
WEB = CODE / "WEB"
VARIABLES = {"OppChoVec": "OppChoVec_0_10", "Score_Opp": "Score_Opp_0_10", "Score_Cho": "Score_Cho_0_10", "Score_Vec": "Score_Vec_0_10"}


def const_js(chemin, nom):
    texte = chemin.read_text(encoding="utf-8")
    return json.loads(re.search(rf"{nom}\s*=\s*(\{{.*\}});", texte, re.S).group(1))


def fr1(x):
    return f"{x:.1f}".replace(".", ",")


def readme_fichiers(data):
    p = CODE / "WEB" / "README_FICHIERS.md"
    s = p.read_text(encoding="utf-8")
    seuils = json.loads((WEB / "seuils_jenks_optimal_gvf.json").read_text(encoding="utf-8"))
    for nom, cle in VARIABLES.items():
        b = [0.0] + list(seuils[cle]["breaks"]) + [10.0]
        lignes = "\n".join(f"Classe {i + 1} : {b[i]:.2f} - {b[i + 1]:.2f}" for i in range(5))
        s = re.sub(rf"(\*\*{nom} :\*\*\n```\n)(.*?)(\n```)", lambda m: m.group(1) + lignes + m.group(3), s, count=1, flags=re.S)
    for fichier, constante in (("lisa_data.js", "LISA_DATA"), ("lisa_data_1pct.js", "LISA_DATA_1PCT"),
                               ("lisa_data_betti.js", "LISA_DATA_BETTI"), ("lisa_data_betti_1pct.js", "LISA_DATA_BETTI_1PCT")):
        meta = const_js(WEB / fichier, constante)["metadata"]
        s = re.sub(rf"(`{fichier}`\s*\|\s*`{constante}`\s*\|[^|]*\|[^|]*\|\s*)\d+ communes \([\d,]+ %\)",
                   lambda m: f"{m.group(1)}{meta['nb_significatives']} communes ({fr1(meta['pourcent_significatives'])} %)", s, count=1)
    meilleure = max(data, key=lambda c: data[c]["OppChoVec_0_10"])                    # la commune qui vaut 10 : exemple de « test rapide »
    valeur = data[meilleure]["OppChoVec_0_10"]
    s = re.sub(r"console\.log\(data_indicateursOriginaux\['[^']+'\]\.OppChoVec_0_10\)` devrait afficher `[\d.]+`",
               lambda m: f"console.log(data_indicateursOriginaux['{meilleure}'].OppChoVec_0_10)` devrait afficher `{valeur:g}`", s, count=1)
    p.write_text(s, encoding="utf-8")


def verification(data):
    p = CODE / "VERIFICATION_COHERENCE_DONNEES.md"
    s = p.read_text(encoding="utf-8")
    for champ in ("OppChoVec", "Score_Opp", "Score_Cho", "Score_Vec"):
        v = f"{data['Ajaccio'][champ]:.6f}"
        s = re.sub(rf"(\| \*\*{champ}\*\* \| )[\d.]+( \| )[\d.]+( \| \*\*0\.000000\*\* \|)", lambda m: f"{m.group(1)}{v}{m.group(2)}{v}{m.group(3)}", s, count=1)
    vals = {k: [d[k] for d in data.values()] for k in data["Afa"] if re.fullmatch(r"(Opp|Cho|Vec)\d", k)}
    fmt = lambda x, n=2: f"{x:,.{n}f}".replace(",", " ").replace(".", ",")
    s = re.sub(r"(- \*\*Opp1\*\* : 1 à 7 \(niveau de diplôme moyen des 18 ans ou plus non scolarisés, recensement INSEE )\d{4}(; observé )[\d,]+ à [\d,]+",
               lambda m: f"{m.group(1)}2023{m.group(2)}{fmt(min(vals['Opp1']))} à {fmt(max(vals['Opp1']))}", s, count=1)
    s = re.sub(r"(- \*\*Opp2\*\* : 0 à )[\d.]+( \(indice de Theil ; maximum observé )[\d,]+\)", lambda m: f"{m.group(1)}1.5{m.group(2)}{fmt(max(vals['Opp2']), 3)})", s, count=1)
    s = re.sub(r"- \*\*Vec1\*\* : [\d ]+ à [\d ]+ \([^)]*\)",
               f"- **Vec1** : 10000 à 60000 (revenu fiscal moyen par foyer fiscal, en € ; observé {fmt(min(vals['Vec1']), 0)} à {fmt(max(vals['Vec1']), 0)})", s, count=1)
    s = re.sub(r"(- \*\*Opp4\*\* : 0 à 100 \()[^)]*\)", r"\1connectivité : moyenne de la 4G, du débit de 30 Mbit/s et de la fibre, en %)", s, count=1)
    p.write_text(s, encoding="utf-8")


def script_js():
    seuils = json.loads((WEB / "seuils_jenks_optimal_gvf.json").read_text(encoding="utf-8"))
    liste = lambda cle: "[0, " + ", ".join(f"{x:.2f}" for x in seuils[cle]["breaks"]) + ", 10]"
    bloc = ("let seuilsJenks = {\n    oppchovec: " + liste("OppChoVec_0_10") + ",  // 5 classes - valeurs par défaut basées sur Jenks\n    opp: " + liste("Score_Opp_0_10")
            + ",\n    cho: " + liste("Score_Cho_0_10") + ",\n    vec: " + liste("Score_Vec_0_10") + "\n};")
    p = WEB / "script.js"
    s = re.sub(r"let seuilsJenks = \{.*?\};", lambda m: bloc, p.read_text(encoding="utf-8"), count=1, flags=re.S)
    p.write_text(s, encoding="utf-8")


def main():
    data = json.loads((WEB / "data_scores_0_10.json").read_text(encoding="utf-8"))
    script_js()
    readme_fichiers(data)
    verification(data)
    print("mis à jour : README_FICHIERS.md, VERIFICATION_COHERENCE_DONNEES.md, script.js (seuils de repli)")


if __name__ == "__main__":
    main()
