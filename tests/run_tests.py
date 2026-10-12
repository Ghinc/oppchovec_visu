"""Lance toute la suite de tests et affiche un bilan. Usage (depuis la racine du dépôt) :

    python tests/run_tests.py            # Python + JavaScript + navigateur (si disponible)
    python tests/run_tests.py --rapide   # sans les tests de navigateur
    python tests/run_tests.py --lent     # ajoute le rejeu complet de LISA (9999 permutations, plusieurs minutes)
    python tests/run_tests.py --e2e      # uniquement les tests de navigateur

Code de sortie : 0 si aucun test n'échoue (les tests ignorés et les « dettes connues » n'échouent pas), 1 sinon.
Voir tests/README.md pour le détail de ce qui est vérifié.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
TESTS = RACINE / "tests"


def lancer(commande, env=None, cwd=RACINE):
    debut = time.time()
    r = subprocess.run(commande, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
    return r, time.time() - debut


def bilan_unittest(r):
    sortie = r.stdout + r.stderr
    m = re.search(r"Ran (\d+) tests? in", sortie)
    total = int(m.group(1)) if m else 0
    # dernière ligne : « OK (skipped=2, expected failures=4) » ou « FAILED (failures=1, errors=2, ...) »
    finale = re.search(r"^(?:OK|FAILED)\s*(?:\((.*)\))?\s*$", sortie, re.M)
    comptes = {k.strip(): int(v) for k, v in re.findall(r"([a-z ]+)=(\d+)", finale.group(1) or "")} if finale else {}
    echecs = comptes.get("failures", 0) + comptes.get("errors", 0) + comptes.get("unexpected successes", 0)
    if not finale or (r.returncode != 0 and not echecs):
        echecs = max(echecs, 1)            # sortie illisible ou code de retour non nul : on ne masque rien
    raisons = sorted(set(re.findall(r"skipped '([^']+)'", sortie)))
    return {"total": total, "ignores": comptes.get("skipped", 0), "dettes": comptes.get("expected failures", 0),
            "echecs": echecs, "raisons": raisons, "sortie": sortie}


def bilan_node(r):
    sortie = r.stdout + r.stderr
    def n(nom):
        m = re.search(rf"^# {nom} (\d+)", sortie, re.M)
        return int(m.group(1)) if m else 0
    raisons = sorted(set(re.findall(r"# SKIP (.+)", sortie)))
    echecs = n("fail")
    if not re.search(r"^# tests \d+", sortie, re.M) or (r.returncode != 0 and not echecs):
        echecs = max(echecs, 1)            # sortie illisible ou code de retour non nul : on ne masque rien
    return {"total": n("tests"), "ignores": n("skipped"), "dettes": n("todo"), "echecs": echecs, "raisons": raisons, "sortie": sortie}


def afficher(nom, b, duree):
    etat = "ÉCHEC" if b["echecs"] else "ok"
    print(f"  {nom:<30} {b['total']:>4} tests  {b['echecs']:>2} échec(s)  {b['ignores']:>2} ignoré(s)  {b['dettes']:>2} dette(s) connue(s)  {duree:5.1f}s  [{etat}]")
    for raison in b["raisons"][:3]:
        print(f"      ignoré : {raison[:150]}")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rapide", action="store_true", help="sans les tests de navigateur")
    ap.add_argument("--lent", action="store_true", help="inclut les tests lents (rejeu LISA)")
    ap.add_argument("--e2e", action="store_true", help="uniquement les tests de navigateur")
    ap.add_argument("-v", "--verbeux", action="store_true", help="affiche la sortie complète des tests en échec")
    args = ap.parse_args()

    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    if args.lent:
        env["OPPCHOVEC_SLOW"] = "1"
    node = shutil.which("node")
    resultats = []

    print("Suite de tests OppChoVec" + ("  (mode lent)" if args.lent else ""))
    if not args.e2e:
        r, d = lancer([sys.executable, "-X", "utf8", "-m", "unittest", "discover", "-s", str(TESTS / "python"), "-t", str(TESTS / "python"), "-p", "test_*.py"], env=env)
        resultats.append(("Python (données, formules…)", bilan_unittest(r), d))
        if node:
            r, d = lancer([node, "--test", "tests/js/*.test.js"], env=env)
            resultats.append(("JavaScript (script.js réel)", bilan_node(r), d))
        else:
            print("  node introuvable : tests JavaScript et e2e ignorés")
    if node and not args.rapide:
        r, d = lancer([node, "--test", "tests/e2e/*.e2e.test.js"], env=env)
        resultats.append(("Navigateur (e2e)", bilan_node(r), d))

    print()
    for nom, b, d in resultats:
        afficher(nom, b, d)
    total = sum(b["total"] for _, b, _ in resultats)
    echecs = sum(b["echecs"] for _, b, _ in resultats)
    print(f"\n  TOTAL : {total} tests, {echecs} échec(s)")
    if echecs:
        for nom, b, _ in resultats:
            if b["echecs"] and args.verbeux:
                print(f"\n----- {nom} -----\n{b['sortie'][-6000:]}")
        if not args.verbeux:
            print("  (relancer avec -v pour voir le détail des échecs)")
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
