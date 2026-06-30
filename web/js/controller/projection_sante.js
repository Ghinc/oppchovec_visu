const ProjectionSanteController = {
    uiInitialized: false,
    payload: null,
    selectedDepartement: null,
    selectedSeriesId: null,
    activeSubTab: 'proj-historique',
    charts: {
        history: null,
        compare: null,
        age: null,
        ageStacked: null,
        scatter: null,
    },

    initUI() {
        if (this.uiInitialized) return;

        const depSelect = document.getElementById('projection-departement');
        const specSelect = document.getElementById('projection-specialite');

        if (depSelect) {
            depSelect.addEventListener('change', () => {
                this.selectedDepartement = depSelect.value || null;
                this.selectedSeriesId = null;
                this.populateSpecialites();
                this.render();
            });
        }

        if (specSelect) {
            specSelect.addEventListener('change', () => {
                this.selectedSeriesId = specSelect.value || null;
                this.render();
            });
        }

        // Sélecteur de département pour le scatter de synthèse
        const scatterDepSelect = document.getElementById('synthese-scatter-dep');
        if (scatterDepSelect) {
            scatterDepSelect.addEventListener('change', () => {
                this.renderScatterChart();
            });
        }

        document.querySelectorAll('.projection-subtab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.projectionTab;
                this.activeSubTab = tabId;
                document.querySelectorAll('.projection-subtab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.projection-subtab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const panel = document.getElementById(tabId);
                if (panel) panel.classList.add('active');
                // Masquer les contrôles profession/département dans l'onglet Synthèse
                const mainControls = document.getElementById('projection-main-controls');
                if (mainControls) mainControls.style.display = tabId === 'proj-synthese' ? 'none' : '';
                this.render();
            });
        });

        this.uiInitialized = true;
    },

    reset() {
        this.payload = null;
        this.selectedDepartement = null;
        this.selectedSeriesId = null;
        this.destroyAllCharts();
        this.renderNoData('Données de projection indisponibles.');
    },

    chargerDonnees(payload) {
        this.initUI();
        this.payload = payload && Array.isArray(payload.series) ? payload : null;
        this.selectedDepartement = null;
        this.selectedSeriesId = null;
        // Ne PAS appeler render() ici : l'onglet est caché → Canvas à taille 0
        // → Chart.js créerait des graphes vides. Le rendu sera déclenché par ouvrirOngletProjection().
        this.populateDepartements();
        this.populateSpecialites();
    },

    ouvrirOngletProjection() {
        this.initUI();
        // Masquer les contrôles si l'onglet Synthèse est actif
        const mainControls = document.getElementById('projection-main-controls');
        if (mainControls) mainControls.style.display = this.activeSubTab === 'proj-synthese' ? 'none' : '';
        // Toujours détruire et recréer les graphes car l'onglet vient de devenir visible.
        this.destroyAllCharts();
        this.render();
    },

    getSeries() {
        return this.payload?.series || [];
    },

    getComparatifs() {
        return this.payload?.comparatifs || {};
    },

    populateDepartements() {
        const depSelect = document.getElementById('projection-departement');
        if (!depSelect) return;

        const deps = [...new Set(this.getSeries().map(s => s.departement).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
        depSelect.innerHTML = '';

        deps.forEach(dep => {
            const opt = document.createElement('option');
            opt.value = dep;
            opt.textContent = dep;
            depSelect.appendChild(opt);
        });

        if (!this.selectedDepartement || !deps.includes(this.selectedDepartement)) {
            this.selectedDepartement = deps[0] || null;
        }
        depSelect.value = this.selectedDepartement || '';
    },

    populateSpecialites() {
        const specSelect = document.getElementById('projection-specialite');
        if (!specSelect) return;

        const rows = this.getSeries()
            .filter(s => !this.selectedDepartement || s.departement === this.selectedDepartement)
            .sort((a, b) => String(a.specialite || '').localeCompare(String(b.specialite || ''), 'fr'));

        specSelect.innerHTML = '';
        rows.forEach(row => {
            const opt = document.createElement('option');
            opt.value = row.id;
            opt.textContent = row.specialite;
            specSelect.appendChild(opt);
        });

        const ids = rows.map(r => r.id);
        if (!this.selectedSeriesId || !ids.includes(this.selectedSeriesId)) {
            this.selectedSeriesId = ids[0] || null;
        }
        specSelect.value = this.selectedSeriesId || '';
    },

    getSelectedRecord() {
        const rows = this.getSeries().filter(s => !this.selectedDepartement || s.departement === this.selectedDepartement);
        if (!rows.length) return null;
        return rows.find(r => r.id === this.selectedSeriesId) || rows[0];
    },

    getRecordsBySpecialite(specialiteLabel) {
        return this.getSeries().filter(s => s.specialite === specialiteLabel);
    },

    destroyChart(name) {
        if (this.charts[name]) {
            this.charts[name].destroy();
            this.charts[name] = null;
        }
    },

    destroyAllCharts() {
        Object.keys(this.charts).forEach(k => this.destroyChart(k));
    },

    renderNoData(message) {
        ['projection-historique-kpis', 'projection-future-kpis'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<p style="color:#999;padding:8px;">${message}</p>`;
        });
        this.destroyAllCharts();
    },

    renderHistoriqueKPIs(record) {
        const el = document.getElementById('projection-historique-kpis');
        if (!el || !record) return;

        const ind = record.indicateurs || {};
        const hist = record.historique || {};
        const safePct = (v) => (Number.isFinite(Number(v)) ? `${Number(v).toFixed(2)}%` : 'N/A');
        const safeVal = (v, dec = 2) => (Number.isFinite(Number(v)) ? Number(v).toFixed(dec) : 'N/A');
        const sign = (v) => (Number(v) >= 0 ? '+' : '');
        const lastYear = hist.derniere_annee_disponible || '—';
        const evoPct = Number(ind.evolution_relative_pct);
        const evoStyle = evoPct > 0 ? 'color:#1a7a3c;font-weight:700' : evoPct < 0 ? 'color:#c0392b;font-weight:700' : '';

        el.innerHTML =
            `<div class="projection-kpis">` +
                `<div class="projection-kpi"><strong>Effectif initial (2012)</strong><br>${safeVal(ind.effectif_initial, 0)}</div>` +
                `<div class="projection-kpi"><strong>Effectif final observé (${lastYear})</strong><br>${safeVal(ind.effectif_final_observe, 0)}</div>` +
                `<div class="projection-kpi"><strong>Évolution absolue</strong><br><span style="${evoStyle}">${sign(ind.evolution_absolue)}${safeVal(ind.evolution_absolue, 0)}</span></div>` +
                `<div class="projection-kpi"><strong>Évolution relative</strong><br><span style="${evoStyle}">${sign(ind.evolution_relative_pct)}${safePct(ind.evolution_relative_pct)}</span></div>` +
                `<div class="projection-kpi"><strong>TCAM (taux croiss. annuel moyen)</strong><br>${sign(ind.taux_croissance_annuel_moyen_pct)}${safePct(ind.taux_croissance_annuel_moyen_pct)}</div>` +
            `</div>`;
    },

    renderProjectionKPIs(record) {
        const el = document.getElementById('projection-future-kpis');
        if (!el || !record) return;

        const ind = record.indicateurs || {};
        const proj = record.projection || {};
        const hist = record.historique || {};
        const safePct = (v) => (Number.isFinite(Number(v)) ? `${Number(v).toFixed(2)}%` : 'N/A');
        const safeVal = (v, dec = 2) => (Number.isFinite(Number(v)) ? Number(v).toFixed(dec) : 'N/A');
        const sign = (v) => (Number(v) >= 0 ? '+' : '');
        const lastYear = hist.derniere_annee_disponible || '—';
        const lastVal = Number(ind.effectif_final_observe);
        const proj2036 = Number(proj.effectif_projete_2036);
        const deltaFutAbs = Number.isFinite(proj2036) && Number.isFinite(lastVal) ? proj2036 - lastVal : NaN;
        const deltaFutPct = Number.isFinite(deltaFutAbs) && lastVal > 0 ? (deltaFutAbs / lastVal) * 100 : NaN;
        const pente = Number(proj.pente_par_an);
        const penteStyle = pente >= 0 ? 'color:#1a7a3c;font-weight:700' : 'color:#c0392b;font-weight:700';

        // KPI Tendance
        const tendance = !Number.isFinite(deltaFutPct) ? { label: 'N/A', color: '#888' }
            : deltaFutPct > 5  ? { label: ' Croissance',   color: '#1a7a3c' }
            : deltaFutPct < -5 ? { label: ' Décroissance', color: '#c0392b' }
            :                    { label: ' Stabilité',     color: '#c07a00' };

        el.innerHTML =
            `<div class="projection-kpis">` +
                `<div class="projection-kpi"><strong>Dernière valeur observée (${lastYear})</strong><br>${safeVal(lastVal, 0)}</div>` +
                `<div class="projection-kpi"><strong>Effectif projeté 2036</strong><br><strong style="font-size:15px">${safeVal(proj2036, 1)}</strong></div>` +
                `<div class="projection-kpi"><strong>Variation projetée (${lastYear}→2036)</strong><br>${sign(deltaFutAbs)}${safeVal(deltaFutAbs, 1)} <em>(${sign(deltaFutPct)}${Number.isFinite(deltaFutPct) ? deltaFutPct.toFixed(1) + '%' : 'N/A'})</em></div>` +
                `<div class="projection-kpi"><strong>Tendance</strong><br><span style="color:${tendance.color};font-weight:700;font-size:14px">${tendance.label}</span></div>` +
                `<div class="projection-kpi"><strong>Pente annuelle (régression)</strong><br><span style="${penteStyle}">${sign(pente)}${safeVal(pente, 2)} / an</span></div>` +
                `<div class="projection-kpi"><strong>TCAM historique</strong><br>${sign(ind.taux_croissance_annuel_moyen_pct)}${safePct(ind.taux_croissance_annuel_moyen_pct)}</div>` +
                `<div class="projection-kpi"><strong>Qualité du modèle (R²)</strong><br>${(() => { const r2 = proj.r2; if (r2 === null || r2 === undefined) return 'N/A'; const v = Number(r2); const color = v >= 0.8 ? '#1a7a3c' : v >= 0.5 ? '#c07a00' : '#c0392b'; const label = v >= 0.8 ? 'Bon ajustement' : v >= 0.5 ? 'Ajustement moyen' : 'Ajustement faible'; return `<span style="color:${color};font-weight:700">${v.toFixed(2)}</span> <em style="font-size:11px;color:${color}">(${label})</em>`; })()}</div>` +
                `<div class="projection-kpi"><strong>Modèle</strong><br>Régression linéaire</div>` +
            `</div>`;
    },

    renderHistoryProjectionChart(record) {
        const canvas = document.getElementById('projection-history-chart');
        if (!canvas || !record) return;

        const histYears = (record.historique?.annees || []).map(Number);
        const histVals = (record.historique?.effectifs || []).map(Number);
        const projYears = (record.projection?.annees || []).map(Number);
        const projVals = (record.projection?.effectifs || []).map(Number);

        const historyData = histYears.map((year, i) => ({ x: year, y: histVals[i] }));

        // Droite de régression sur la période historique + projection : même a et b
        // intercept = projVals[0] - slope * projYears[0]
        const slope = Number(record.projection?.pente_par_an);
        const intercept = projVals.length && projYears.length
            ? projVals[0] - slope * projYears[0]
            : null;
        const regressionHistData = intercept !== null
            ? histYears.map(year => ({ x: year, y: slope * year + intercept }))
            : [];

        const projectionData = [];
        if (histYears.length && projVals.length) {
            // Point de jonction sur la droite de régression (pas la valeur réelle)
            projectionData.push({ x: histYears[histYears.length - 1], y: slope * histYears[histYears.length - 1] + intercept });
        }
        projYears.forEach((year, i) => projectionData.push({ x: year, y: projVals[i] }));

        this.destroyChart('history');
        this.charts.history = new Chart(canvas, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Historique observé',
                        data: historyData,
                        borderColor: '#1f6fb2',
                        backgroundColor: 'rgba(31,111,178,0.12)',
                        pointRadius: 3,
                        tension: 0.2,
                        fill: true,
                    },
                    {
                        label: 'Droite de régression (historique)',
                        data: regressionHistData,
                        borderColor: '#27ae60',
                        backgroundColor: 'transparent',
                        borderDash: [4, 3],
                        pointRadius: 0,
                        tension: 0,
                        fill: false,
                    },
                    {
                        label: 'Projection tendancielle',
                        data: projectionData,
                        borderColor: '#e67e22',
                        backgroundColor: 'rgba(230,126,34,0.10)',
                        borderDash: [6, 4],
                        pointRadius: 2,
                        tension: 0,
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                parsing: false,
                scales: {
                    x: {
                        type: 'linear',
                        ticks: { precision: 0 },
                        title: { display: true, text: 'Année' },
                    },
                    y: {
                        beginAtZero: false,
                        title: { display: true, text: 'Effectif' },
                    },
                },
                plugins: {
                    legend: { position: 'bottom' },
                    title: {
                        display: true,
                        text: `${record.specialite} — ${record.departement}`,
                        font: { size: 12 },
                        color: '#555',
                    },
                },
            },
        });
    },

    renderCompareChart(record) {
        const canvas = document.getElementById('projection-compare-chart');
        if (!canvas || !record) return;

        const allRecords = this.getRecordsBySpecialite(record.specialite);
        if (!allRecords.length) {
            this.destroyChart('compare');
            return;
        }

        // Couleurs fixes par département
        const depColors = {
            'Haute-Corse':   { border: '#1f6fb2', bg: 'rgba(31,111,178,0.12)' },
            'Corse-du-Sud':  { border: '#1a7a3c', bg: 'rgba(26,122,60,0.12)' },
        };
        const fallback = ['#9c27b0', '#ff5722', '#795548', '#f44336'];

        const datasets = allRecords.map((rec, i) => {
            const histYears = (rec.historique?.annees || []).map(Number);
            const histVals  = (rec.historique?.effectifs || []).map(Number);
            const data = histYears.map((year, j) => ({ x: year, y: histVals[j] }));
            const col = depColors[rec.departement] || { border: fallback[i % fallback.length], bg: 'rgba(0,0,0,0.08)' };
            return {
                label: rec.departement,
                data,
                borderColor: col.border,
                backgroundColor: col.bg,
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: 0.2,
                fill: false,
            };
        });

        this.destroyChart('compare');
        this.charts.compare = new Chart(canvas, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                parsing: false,
                scales: {
                    x: {
                        type: 'linear',
                        ticks: { precision: 0 },
                        title: { display: true, text: 'Année' },
                    },
                    y: {
                        beginAtZero: false,
                        title: { display: true, text: 'Effectif observé' },
                    },
                },
                plugins: {
                    legend: { position: 'bottom' },
                    title: {
                        display: true,
                        text: record.specialite,
                        font: { size: 12 },
                        color: '#555',
                    },
                },
            },
        });
    },

    renderAgeChart(record) {
        const canvas = document.getElementById('projection-age-chart');
        if (!canvas || !record) return;

        const distribution = record.demographie?.repartition_tranches_age || [];
        if (!distribution.length) return;

        const getMinAge = (label) => {
            const norm = label.toLowerCase();
            if (norm.includes('moins')) return 0;
            const nums = [...norm.matchAll(/\d+/g)].map(m => parseInt(m[0]));
            return nums.length ? Math.min(...nums) : 999;
        };

        // Classer chaque tranche dans l'une des 3 cohortes
        const cohortOf = (d) => {
            const age = getMinAge(d.tranche_age);
            if (d.is_55_plus || age >= 55) return 'seniors';
            if (age >= 40)                 return 'intermediaires';
            return 'jeunes';
        };

        // Union de toutes les années disponibles
        const allYears = [...new Set(
            distribution.flatMap(d => Object.keys(d.effectifs_par_annee || {})).map(Number)
        )].sort((a, b) => a - b);

        if (!allYears.length) return;

        // Agréger les effectifs par cohorte et par année
        const cohorts = {
            jeunes:          { label: 'Jeunes (< 40 ans)',         color: '#2ecc71', fill: 'rgba(46,204,113,0.12)' },
            intermediaires:  { label: 'Intermédiaires (40–54 ans)', color: '#f39c12', fill: 'rgba(243,156,18,0.12)' },
            seniors:         { label: 'Seniors (55 ans et plus)',   color: '#e74c3c', fill: 'rgba(231,76,60,0.12)'  },
        };

        // Initialiser les sommes à 0 pour chaque cohorte × année
        const sums = {};
        Object.keys(cohorts).forEach(k => { sums[k] = {}; allYears.forEach(y => { sums[k][y] = 0; }); });

        distribution.forEach(d => {
            const cohort = cohortOf(d);
            Object.entries(d.effectifs_par_annee || {}).forEach(([y, v]) => {
                const year = Number(y);
                if (sums[cohort][year] !== undefined) sums[cohort][year] += Number(v);
            });
        });

        const datasets = Object.entries(cohorts).map(([key, meta]) => ({
            label: meta.label,
            data: allYears.map(y => sums[key][y] || 0),
            borderColor: meta.color,
            backgroundColor: meta.fill,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2.5,
            tension: 0.3,
        }));

        this.destroyChart('age');
        this.charts.age = new Chart(canvas, {
            type: 'line',
            data: { labels: allYears, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${record.specialite} (${record.departement}) — Évolution des cohortes d'âge`,
                        font: { size: 12 },
                    },
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 11 }, boxWidth: 14 },
                    },
                },
                scales: {
                    x: { title: { display: true, text: 'Année' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Effectif' } },
                },
            },
        });
    },

    renderDemographieKPIs(record) {
        const el = document.getElementById('projection-demo-kpis');
        if (!el || !record) return;

        const demo = record.demographie || {};
        const dist = demo.repartition_tranches_age || [];

        // Tranche dominante = effectif le plus élevé
        const dominant = dist.reduce((best, d) => {
            return (Number(d.effectif) > Number(best?.effectif ?? -1)) ? d : best;
        }, null);

        if (!dominant) { el.innerHTML = ''; return; }

        const share55 = Number(demo.part_55_plus_pct);
        const alertLevel = share55 >= 70 ? 'critique' : share55 >= 50 ? 'eleve' : 'normal';
        const share55Color = alertLevel === 'critique' ? '#c0392b' : alertLevel === 'eleve' ? '#e67e22' : '#1a7a3c';
        const domColor   = dominant.is_55_plus ? '#c0392b' : '#1a7a3c';

        const alertBadge = alertLevel !== 'normal'
            ? `<div class="projection-kpi projection-kpi-alert-${alertLevel}">` +
              `<strong>⚠ Vieillissement marquant</strong><br>` +
              `${share55.toFixed(0)}% des professionnels ont 55 ans ou plus</div>`
            : '';

        el.innerHTML =
            `<div class="projection-kpis">` +
                `<div class="projection-kpi">` +
                  `<strong>Classe d'âge dominante</strong><br>` +
                  `<span style="color:${domColor};font-weight:700">${dominant.tranche_age}</span><br>` +
                  `<em>${Number(dominant.part_pct).toFixed(1)} % des effectifs</em>` +
                `</div>` +
                alertBadge +
            `</div>`;
    },

    renderAgeStackedComparison(departement) {
        const canvas = document.getElementById('projection-age-stacked-chart');
        if (!canvas) return;

        // Toutes les séries du département sélectionné
        const seriesDep = this.getSeries().filter(s => s.departement === departement);
        if (!seriesDep.length) return;

        // Extraire l'âge minimum d'un label pour trier
        const getMinAge = (label) => {
            const norm = label.toLowerCase();
            if (norm.includes('moins')) return 0;
            const nums = [...norm.matchAll(/\d+/g)].map(m => parseInt(m[0]));
            return nums.length ? Math.min(...nums) : 999;
        };

        // Union de tous les labels de tranches présents, triés par âge croissant
        const allAgeLabels = [...new Set(
            seriesDep.flatMap(s => (s.demographie?.repartition_tranches_age || []).map(t => t.tranche_age))
        )].sort((a, b) => getMinAge(a) - getMinAge(b));

        // Palette : bleu-vert (jeune) → orange-rouge (senior)
        const ageColor = (idx, total) => {
            const t = idx / Math.max(total - 1, 1);
            const r = Math.round(50  + t * 205);
            const g = Math.round(160 - t * 120);
            const b = Math.round(190 - t * 160);
            return `rgba(${r},${g},${b},0.82)`;
        };

        // Un dataset par tranche d'âge, une barre par spécialité
        const datasets = allAgeLabels.map((ageLabel, idx) => ({
            label: ageLabel,
            data: seriesDep.map(s => {
                const entry = (s.demographie?.repartition_tranches_age || [])
                    .find(t => t.tranche_age === ageLabel);
                return entry ? Number(entry.part_pct) : 0;
            }),
            backgroundColor: ageColor(idx, allAgeLabels.length),
            borderWidth: 0,
        }));

        const specialiteLabels = seriesDep.map(s => s.specialite);

        // Année(s) de référence utilisées
        const years = [...new Set(seriesDep.map(s => s.demographie?.annee_reference).filter(Boolean))].sort();
        const yearLabel = years.length === 1 ? `${years[0]}` : `${years[0]}–${years[years.length - 1]}`;

        this.destroyChart('ageStacked');
        this.charts.ageStacked = new Chart(canvas, {
            type: 'bar',
            data: { labels: specialiteLabels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    title: {
                        display: true,
                        text: `${departement} — % de l'effectif par tranche d'âge (dernière année : ${yearLabel})`,
                        font: { size: 13 },
                    },
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 10 }, boxWidth: 14, padding: 8 },
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label} : ${Number(ctx.raw).toFixed(1)} %`,
                        },
                    },
                },
                scales: {
                    x: {
                        stacked: true,
                        min: 0,
                        max: 100,
                        title: { display: true, text: '% de l\'effectif total' },
                    },
                    y: {
                        stacked: true,
                        ticks: { autoSkip: false, font: { size: 11 } },
                    },
                },
            },
        });
    },

    // ─── Helpers calcul tendance / cohorte ────────────────────────────────

    _getMinAge(label) {
        const norm = label.toLowerCase();
        if (norm.includes('moins')) return 0;
        const nums = [...norm.matchAll(/\d+/g)].map(m => parseInt(m[0]));
        return nums.length ? Math.min(...nums) : 999;
    },

    _cohortShare(record, cohort) {
        const dist = record.demographie?.repartition_tranches_age || [];
        const cohortOf = d => {
            const age = this._getMinAge(d.tranche_age);
            if (d.is_55_plus || age >= 55) return 'seniors';
            if (age >= 40) return 'intermediaires';
            return 'jeunes';
        };
        const total = dist.reduce((s, d) => s + (Number(d.effectif) || 0), 0);
        if (!total) return 0;
        return dist.filter(d => cohortOf(d) === cohort)
                   .reduce((s, d) => s + (Number(d.effectif) || 0), 0) / total * 100;
    },

    _deltaFutPct(record) {
        const last = Number(record.indicateurs?.effectif_final_observe);
        const proj = Number(record.projection?.effectif_projete_2036);
        if (!Number.isFinite(last) || !Number.isFinite(proj) || last === 0) return NaN;
        return (proj - last) / last * 100;
    },

    _trendOf(record) {
        const d = this._deltaFutPct(record);
        if (!Number.isFinite(d)) return 'unknown';
        return d > 5 ? 'croissance' : d < -5 ? 'decroissance' : 'stable';
    },

    // ─── Tableau de synthèse ─────────────────────────────────────────────

    renderSyntheseTable() {
        const el = document.getElementById('projection-synthese-table');
        if (!el) return;

        const series = this.getSeries();
        if (!series.length) { el.innerHTML = ''; return; }

        const deps = [...new Set(series.map(s => s.departement))]
            .sort((a, b) => a.localeCompare(b, 'fr'));

        // Retourne la ou les spécialités à la valeur extrême (gère les ex-aequo)
        const topBy = (sd, getter, max = true) => {
            const vals = sd.map(s => ({ s, v: getter(s) })).filter(x => Number.isFinite(x.v));
            if (!vals.length) return 'N/A';
            const ext = max ? Math.max(...vals.map(x => x.v)) : Math.min(...vals.map(x => x.v));
            return vals.filter(x => x.v === ext).map(x => x.s.specialite).join(', ');
        };

        // Comme topBy mais affiche aussi la valeur entre parenthèses
        const topByWithVal = (sd, getter, max = true, fmt = v => v.toFixed(1)) => {
            const vals = sd.map(s => ({ s, v: getter(s) })).filter(x => Number.isFinite(x.v));
            if (!vals.length) return 'N/A';
            const ext = max ? Math.max(...vals.map(x => x.v)) : Math.min(...vals.map(x => x.v));
            return vals.filter(x => x.v === ext)
                       .map(x => `${x.s.specialite} <em style="color:#666">(${ext >= 0 ? '+' : ''}${fmt(ext)} %)</em>`)
                       .join(', ');
        };

        const buildStats = dep => {
            const sd = series.filter(s => s.departement === dep);
            return {
                total:              sd.length,
                croissance:         sd.filter(s => this._trendOf(s) === 'croissance').length,
                stable:             sd.filter(s => this._trendOf(s) === 'stable').length,
                decroissance:       sd.filter(s => this._trendOf(s) === 'decroissance').length,
                plusVieillissante:  topBy(sd, s => Number(s.demographie?.part_55_plus_pct)),
                plusJeune:          topBy(sd, s => this._cohortShare(s, 'jeunes')),
                plusIntermediaire:  topBy(sd, s => this._cohortShare(s, 'intermediaires')),
                hauteProjection:    topBy(sd, s => Number(s.projection?.effectif_projete_2036)),
                faibleProjection:   topBy(sd, s => Number(s.projection?.effectif_projete_2036), false),
                hauteVariation:     topByWithVal(sd, s => this._deltaFutPct(s)),
                faibleVariation:    topByWithVal(sd, s => this._deltaFutPct(s), false),
            };
        };

        const stats = Object.fromEntries(deps.map(d => [d, buildStats(d)]));

        const rows = [
            ['Professions analysées',              d => stats[d].total],
            ['Projection croissante (> +5 %)',      d => `<span style="color:#1a7a3c;font-weight:700">${stats[d].croissance}</span>`],
            ['Projection stable (\u22125 % à +5 %)',   d => `<span style="color:#c07a00;font-weight:700">${stats[d].stable}</span>`],
            ['Projection décroissante (< \u22125 %)',  d => `<span style="color:#c0392b;font-weight:700">${stats[d].decroissance}</span>`],
            ['Profession(s) la plus vieillissante', d => stats[d].plusVieillissante],
            ['Profession(s) la plus jeune',        d => stats[d].plusJeune],
            ['Profession(s) la plus intermédiaire',d => stats[d].plusIntermediaire],
            ['Effectif projeté 2036 le plus élevé',d => stats[d].hauteProjection],
            ['Effectif projeté 2036 le plus faible',d => stats[d].faibleProjection],
            ['Variation projetée la plus élevée',   d => stats[d].hauteVariation],
            ['Variation projetée la plus faible',   d => stats[d].faibleVariation],
        ];

        const headerCells = deps.map(d => `<th>${d}</th>`).join('');
        const bodyRows = rows.map(([label, fn]) =>
            `<tr><td class="synthese-row-label">${label}</td>${deps.map(d => `<td>${fn(d)}</td>`).join('')}</tr>`
        ).join('');

        el.innerHTML =
            `<table class="synthese-table">` +
            `<thead><tr><th>Indicateur</th>${headerCells}</tr></thead>` +
            `<tbody>${bodyRows}</tbody>` +
            `</table>`;
    },

    // ─── Scatter Projection × Vieillissement ────────────────────────────

    renderScatterChart() {
        const canvas = document.getElementById('projection-scatter-chart');
        if (!canvas) return;

        const series = this.getSeries();
        if (!series.length) return;

        // Filtre départemental depuis le sélecteur de la synthèse
        const scatterDepSelect = document.getElementById('synthese-scatter-dep');
        const depFilter = scatterDepSelect?.value || '';
        const filtered = depFilter ? series.filter(s => s.departement === depFilter) : series;

        const trendCfg = {
            croissance:  { label: 'Croissance (> +5 %)',      color: '#27ae60' },
            stable:      { label: 'Stabilité (\u22125 % à +5 %)', color: '#e67e22' },
            decroissance:{ label: 'Décroissance (< \u22125 %)',   color: '#e74c3c' },
        };

        const buckets = { croissance: [], stable: [], decroissance: [] };
        filtered.forEach(s => {
            const x = this._deltaFutPct(s);
            const y = Number(s.demographie?.part_55_plus_pct);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const trend = this._trendOf(s);
            if (buckets[trend]) buckets[trend].push({
                x,
                y,
                label: `${s.specialite} (${s.departement})`,
            });
        });

        const datasets = Object.entries(trendCfg).map(([key, cfg]) => ({
            type: 'scatter',
            label: cfg.label,
            data: buckets[key],
            backgroundColor: cfg.color + 'bb',
            borderColor: cfg.color,
            borderWidth: 1.5,
            pointRadius: 7,
            pointHoverRadius: 10,
        }));

        // Ligne verticale à x = 0 (étendue largement pour couvrir tout l'axe Y auto)
        datasets.push({
            type: 'line',
            label: '__vline__',
            data: [{ x: 0, y: -200 }, { x: 0, y: 200 }],
            borderColor: '#999',
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0,
            showLine: true,
        });

        this.destroyChart('scatter');
        this.charts.scatter = new Chart(canvas, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            filter: item => item.text !== '__vline__',
                            font: { size: 11 },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                if (!ctx.raw?.label) return null;
                                return [
                                    ctx.raw.label,
                                    `Variation projetée : ${Number(ctx.raw.x).toFixed(1)} %`,
                                    `Seniors (55+) : ${Number(ctx.raw.y).toFixed(1)} %`,
                                ];
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Dynamique d\'évolution future — Variation projetée 2036 (%)' },
                        grid: { color: ctx => ctx.tick?.value === 0 ? '#aaa' : '#e8e8e8' },
                        ticks: { maxTicksLimit: 8 },
                    },
                    y: {
                        title: { display: true, text: 'Vieillissement — Part des seniors 55+ (%)' },
                        min: -50,
                        max: 150,
                    },
                },
            },
        });
    },

    _populateScatterDepSelect() {
        const sel = document.getElementById('synthese-scatter-dep');
        if (!sel) return;
        const deps = [...new Set(this.getSeries().map(s => s.departement).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
        sel.innerHTML = '<option value="">Tous les départements</option>' +
            deps.map(d => `<option value="${d}">${d}</option>`).join('');
    },


    render() {
        this.initUI();

        if (!this.payload || !Array.isArray(this.payload.series) || !this.payload.series.length) {
            this.renderNoData('Aucune donnée de projection disponible. Exécutez le pipeline pour générer le JSON dédié.');
            return;
        }

        const record = this.getSelectedRecord();
        if (!record) {
            this.renderNoData('Aucune série disponible pour la sélection courante.');
            return;
        }

        this.selectedSeriesId = record.id;
        const specSelect = document.getElementById('projection-specialite');
        if (specSelect) specSelect.value = this.selectedSeriesId;

        // Toujours tout rendre : les éléments existent dans le DOM même si leur
        // panneau n'est pas actif, et Chart.js gère la destruction/recréation.
        this.renderHistoriqueKPIs(record);
        this.renderCompareChart(record);
        this.renderProjectionKPIs(record);
        this.renderHistoryProjectionChart(record);
        this.renderDemographieKPIs(record);
        this.renderAgeChart(record);
        this.renderAgeStackedComparison(record.departement);
        this.renderSyntheseTable();
        this._populateScatterDepSelect();
        this.renderScatterChart();
    },
};

window.ProjectionSanteController = ProjectionSanteController;
