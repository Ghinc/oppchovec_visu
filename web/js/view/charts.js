/**
 * Visualisation des données : histogrammes Jenks + exports PNG/CSV.
 */

// Registre des instances Chart.js actives (destruction avant recréation)
const _chartInstances = {};

/**
 * Retourne le dictionnaire {commune: valeur} pour un type donné.
 */
function _getValeurs(type) {
    if (type === 'oppchovec') return { ...AppState.indiceFinale };
    const key = { opp: 'Score_Opp', cho: 'Score_Cho', vec: 'Score_Vec' }[type];
    const out = {};
    for (const [c, s] of Object.entries(AppState.scoresParCommune)) out[c] = s[key];
    return out;
}

/**
 * Construit (ou recrée) l'histogramme Jenks sur le canvas donné.
 *
 * @param {string} type     - 'oppchovec' | 'opp' | 'cho' | 'vec'
 * @param {string} canvasId - ID du canvas
 */
function construireHistogrammeJenks(type, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const valeurs = _getValeurs(type);
    if (Object.keys(valeurs).length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.fillText('Chargez des données pour afficher le graphique.', canvas.width / 2, canvas.height / 2);
        return;
    }

    const seuils = AppState.seuilsJenks[type] || SEUILS_JENKS[type] || [];
    const labels  = seuils.length
        ? genererLabelsJenks([Math.min(...Object.values(valeurs)), ...seuils, Math.max(...Object.values(valeurs))])
        : (LABELS_JENKS[type] || seuils.map((_, i) => `Classe ${i + 1}`));

    // Compter communes par classe
    const counts = new Array(COLORS_JENKS.length).fill(0);
    for (const val of Object.values(valeurs)) {
        let idx = COLORS_JENKS.length - 1;
        for (let i = 0; i < seuils.length; i++) {
            if (val <= seuils[i]) { idx = i; break; }
        }
        counts[idx]++;
    }

    const titres = { oppchovec: 'OppChoVec', opp: 'Score Opportunités', cho: 'Score Choix', vec: 'Score Vécu' };

    // Détruire l'instance précédente si elle existe
    if (_chartInstances[canvasId]) {
        _chartInstances[canvasId].destroy();
        delete _chartInstances[canvasId];
    }

    _chartInstances[canvasId] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Communes',
                data: counts,
                backgroundColor: COLORS_JENKS,
                borderColor: '#333',
                borderWidth: 1,
                borderRadius: 4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `Distribution des communes par classe Jenks — ${titres[type]}`,
                    font: { size: 20, weight: 'bold', family: 'inherit' },
                    color: '#1a1a2e',
                    padding: { top: 10, bottom: 24 },
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y} commune${ctx.parsed.y > 1 ? 's' : ''}`,
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Nombre de communes',
                        font: { size: 14, weight: '600' },
                    },
                    ticks: { stepSize: 1 },
                },
                x: {
                    title: {
                        display: true,
                        text: 'Classe Jenks',
                        font: { size: 14, weight: '600' },
                    },
                    ticks: { font: { size: 12 } },
                },
            },
        },
    });
}

/**
 * Exporte le canvas Chart.js en PNG.
 *
 * @param {string} canvasId - ID du canvas
 * @param {string} nom      - Nom du fichier (sans extension)
 */
function exporterChartPNG(canvasId, nom) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = nom + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

/**
 * Exporte les données commune + classe Jenks en CSV.
 *
 * @param {string} type - 'oppchovec' | 'opp' | 'cho' | 'vec'
 */
function exporterCSV(type) {
    const valeurs = _getValeurs(type);
    if (Object.keys(valeurs).length === 0) {
        alert('Aucune donnée à exporter. Chargez un jeu de données d\'abord.');
        return;
    }

    const seuils = AppState.seuilsJenks[type] || SEUILS_JENKS[type] || [];
    const labels  = seuils.length
        ? genererLabelsJenks([Math.min(...Object.values(valeurs)), ...seuils, Math.max(...Object.values(valeurs))])
        : (LABELS_JENKS[type] || seuils.map((_, i) => `Classe ${i + 1}`));

    const titreCol = { oppchovec: 'OppChoVec_1_10', opp: 'Score_Opp', cho: 'Score_Cho', vec: 'Score_Vec' }[type];
    let csv = `Commune,${titreCol},Classe,Libellé\n`;

    for (const [commune, val] of Object.entries(valeurs)) {
        let idx = COLORS_JENKS.length - 1;
        for (let i = 0; i < seuils.length; i++) {
            if (val <= seuils[i]) { idx = i; break; }
        }
        csv += `"${commune}",${val.toFixed(4)},${idx + 1},"${labels[idx]}"\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `${type}_jenks_classes.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
}
