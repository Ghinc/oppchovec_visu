"""Serveur local pour l'appli (racine du dépôt), sans cache navigateur : les modifications de HTML/CSS/JS sont visibles au simple rechargement.

Usage (depuis la racine du dépôt) :  python serveur_local.py [port]      puis ouvrir http://localhost:8000/
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class SansCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    racine = Path(__file__).resolve().parent
    print(f"http://localhost:{port}/  (dossier {racine}, sans cache)")
    ThreadingHTTPServer(("", port), partial(SansCache, directory=str(racine))).serve_forever()
