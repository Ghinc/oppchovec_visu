"""
Convertit un document Markdown simple (titres, paragraphes, listes à puces avec lignes de suite, tableaux, **gras**, *italique*, `code`, liens)
en une page HTML autonome (un seul fichier, thème clair / sombre selon le navigateur, sans dépendance).

Usage :
    python md_vers_html.py <fichier.md> [<fichier.html>]
"""

import html
import re
import sys
from pathlib import Path

CSS = """
:root { --fond:#ffffff; --texte:#1f2933; --discret:#52606d; --trait:#d9e2ec; --entete:#f0f4f8; --code:#f0f4f8; --lien:#0b5ea8; --accent:#0b5ea8; }
@media (prefers-color-scheme: dark) {
  :root { --fond:#12181f; --texte:#e4ebf1; --discret:#9fb0bf; --trait:#2d3a47; --entete:#1c2630; --code:#1c2630; --lien:#6cb4f0; --accent:#6cb4f0; }
}
* { box-sizing: border-box; }
body { margin:0; background:var(--fond); color:var(--texte); font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
main { max-width: 1060px; margin:0 auto; padding: 28px 20px 64px; }
h1 { font-size:1.7rem; line-height:1.25; margin:0 0 .6em; }
h2 { font-size:1.3rem; margin:2em 0 .5em; padding-bottom:.25em; border-bottom:2px solid var(--trait); }
h3 { font-size:1.08rem; margin:1.6em 0 .4em; color:var(--accent); }
p { margin:.7em 0; }
ul { padding-left:1.3em; margin:.6em 0; } li { margin:.35em 0; }
a { color:var(--lien); }
code { background:var(--code); padding:.1em .35em; border-radius:4px; font:.88em ui-monospace,Consolas,monospace; word-break:break-word; }
.tableau { overflow-x:auto; margin:1em 0; }
table { border-collapse:collapse; width:100%; font-size:.9rem; }
th, td { border:1px solid var(--trait); padding:.45em .65em; text-align:left; vertical-align:top; }
th { background:var(--entete); font-weight:600; }
@media (max-width: 640px) { main { padding:18px 14px 48px; } }
@media print { body { background:#fff; color:#000; } main { max-width:none; } }
"""


def inline(texte):
    t = html.escape(texte, quote=False)
    t = re.sub(r"`([^`]+)`", lambda m: f"<code>{m.group(1)}</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', t)
    return t


def convertir(md):
    md = re.sub(r"\A[^\n#]*(?=# )", "", md)          # texte parasite avant le titre de la première ligne
    lignes = md.replace("\r\n", "\n").split("\n")
    sortie, i, titre = [], 0, "Rapport"
    while i < len(lignes):
        l = lignes[i]
        if not l.strip():
            i += 1
        elif l.startswith("#"):
            niveau = len(l) - len(l.lstrip("#"))
            texte = l[niveau:].strip()
            if niveau == 1:
                titre = re.sub(r"[`*]", "", texte)
            sortie.append(f"<h{niveau}>{inline(texte)}</h{niveau}>")
            i += 1
        elif l.lstrip().startswith("|"):
            bloc = []
            while i < len(lignes) and lignes[i].lstrip().startswith("|"):
                bloc.append(lignes[i].strip())
                i += 1
            cellules = lambda s: [c.strip() for c in s.strip("|").split("|")]
            entete = cellules(bloc[0])
            corps = [cellules(b) for b in bloc[2:]]
            h = "<div class='tableau'><table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in entete) + "</tr></thead><tbody>"
            for r in corps:
                h += "<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>"
            sortie.append(h + "</tbody></table></div>")
        elif re.match(r"\s*[-*] ", l):
            items = []
            while i < len(lignes) and (re.match(r"\s*[-*] ", lignes[i]) or (lignes[i].startswith("  ") and lignes[i].strip() and items)):
                if re.match(r"\s*[-*] ", lignes[i]):
                    items.append(re.sub(r"^\s*[-*] ", "", lignes[i]))
                else:
                    items[-1] += " " + lignes[i].strip()
                i += 1
            sortie.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ul>")
        else:
            par = []
            while i < len(lignes) and lignes[i].strip() and not lignes[i].startswith("#") and not lignes[i].lstrip().startswith("|") and not re.match(r"\s*[-*] ", lignes[i]):
                par.append(lignes[i].strip())
                i += 1
            sortie.append(f"<p>{inline(' '.join(par))}</p>")
    corps = "\n".join(sortie)
    return (f"<!doctype html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
            f"<title>{html.escape(titre)}</title>\n<style>{CSS}</style>\n</head>\n<body>\n<main>\n{corps}\n</main>\n</body>\n</html>\n")


def main():
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    dest = Path(sys.argv[2]) if len(sys.argv) == 3 else src.with_suffix(".html")
    dest.write_text(convertir(src.read_text(encoding="utf-8")), encoding="utf-8")
    print(f"écrit : {dest}")


if __name__ == "__main__":
    main()
