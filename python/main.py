"""
Point d'entrée principal du calcul OppChoVec.

Exécuter depuis le dossier python/ :
    python main.py

Les fichiers de sortie sont créés dans le dossier courant.
"""

from pipeline import run_pipeline
from data.exporter import (
    exporter_json,
    exporter_excel,
    exporter_stats,
    exporter_comparaison,
)
from config import OUTPUT_JSON

# Communes ciblées pour la fiche de comparaison
COMMUNES_CIBLEES = [
    "Ajaccio", "Corte", "Bastia", "Alata", "Appieto",
    "Ghisonaccia", "Propriano", "Bonifacio", "Aléria",
    "Lucciana", "Calvi", "Chisa", "Altiani", "Pietralba",
    "Santa-Maria-di-Lota"
]


def main() -> None:
    print("=" * 60)
    print("CALCUL DE L'INDICE OPPCHOVEC — COMMUNES DE CORSE")
    print("=" * 60)
    print()

    resultats = run_pipeline()

    print("\nExport des résultats...")
    exporter_json(resultats['complet'], OUTPUT_JSON)
    exporter_excel(
        resultats['indicateurs_bruts'],
        resultats['dimensions'],
        resultats['oppchovec'],
    )
    exporter_stats(resultats['complet'])
    exporter_comparaison(resultats['complet'], COMMUNES_CIBLEES)

    print("\n" + "=" * 60)
    print("TRAITEMENT TERMINÉ")
    print("=" * 60)


if __name__ == "__main__":
    main()
