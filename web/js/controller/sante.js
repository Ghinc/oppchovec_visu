/**
 * Contrôleur Santé Corse
 *
 * Responsabilité : relier le modèle Santé et la vue Santé.
 */
const SanteController = {
    uiInitialized: false,
    selectedTopCategoryKeyByMode: {
        access: null,
        volume: null,
    },
    top10Mode: 'access',
    scoringMode: 'composite',
    proStatsSortMode: 'coverage',
    etabStatsSortMode: 'coverage',
    etabTopN: 10,
    proVizSelectedCodes: [],
    proVizChart: null,
    proVizOfferVariant: 'raw',
    etabVizSelectedCodes: [],
    etabVizChart: null,

    setActiveDataset(datasetKey) {
        const updated = SanteModel.setActiveDataset(datasetKey);
        if (!updated) return false;
        this.applyDatasetUi();
        this.ouvrirOngletSante();
        return true;
    },

    applyDatasetUi() {
        this.updateDatasetLabels();
        this.applyDatasetModeDefaults();
        this.updateGravityControlsVisibility();
        this.updateDensityScoreOfferVisibility();
        this.updateCategoryPanelVisibility();
        this.renderCategoryList();
        this.updateCurrentCategoryLabel();
        this.updateIndicatorDescription(SanteModel.getMapDisplayMode());

        const statsBtn = document.querySelector('.sante-subtab-button[data-sante-tab="sante-stats-view"]');
        const vizBtn = document.querySelector('.sante-subtab-button[data-sante-tab="sante-viz-view"]');
        const statsView = document.getElementById('sante-stats-view');
        const vizView = document.getElementById('sante-viz-view');
        if (statsBtn) statsBtn.style.display = '';
        if (statsView) statsView.style.display = '';
        if (vizBtn) vizBtn.style.display = '';
        if (vizView) vizView.style.display = '';

        // Mettre à jour la visibilité des onglets conditionnels EN PREMIER,
        // avant les renders (qui pourraient lever une exception et stopper l'exécution)
        this.updateAggregationTabVisibility();
        this.updateTensionsTabVisibility();

        this.renderScoringTab();
        this.renderStatisticsTab();
        this.renderVisualizationTab();

        // Rafraîchir le sous-onglet actif si c'est agrégation ou tensions
        const activeSubtab = document.querySelector('.sante-subtab-button.active');
        const activeTabId = activeSubtab?.dataset?.santeTab;
        if (activeTabId === 'sante-aggregation-view') {
            setTimeout(() => this.renderAggregationTab(), 50);
        } else if (activeTabId === 'sante-tensions-view') {
            // Tensions n'existe que pour pro — si on arrive ici sur étab, forcer retour sur Cartographies
            if (SanteModel.activeDataset !== 'pro') {
                const tensionView = document.getElementById('sante-tensions-view');
                const mapView = document.getElementById('sante-map-view');
                if (tensionView) tensionView.classList.remove('active');
                if (mapView) mapView.classList.add('active');
                document.querySelectorAll('.sante-subtab-button').forEach(b => {
                    b.classList.toggle('active', b.dataset.santeTab === 'sante-map-view');
                });
                const tensionBtn = document.getElementById('sante-tensions-tab-btn');
                if (tensionBtn) tensionBtn.style.display = 'none';
            } else {
                setTimeout(() => this.renderTensionsTab(), 50);
            }
        }
    },

    updateDatasetLabels() {
        const catTitle = document.getElementById('sante-category-title');
        if (catTitle) catTitle.textContent = SanteModel.getCategoriesLabel();
        const scoringTitle = document.getElementById('sante-scoring-title');
        if (scoringTitle) {
            scoringTitle.textContent = SanteModel.supportsScoreComposite()
                ? 'Scoring de couverture en soins (Top 10 communes)'
                : 'Classement des communes (Top 10)';
        }
    },

    applyDatasetModeDefaults() {
        const mapModeSelect = document.getElementById('sante-display-mode');
        if (mapModeSelect) {
            const supportsGravity = SanteModel.supportsGravity();
            const supportsScore = SanteModel.supportsScoreComposite();
            Array.from(mapModeSelect.options).forEach(opt => {
                if (opt.value === 'gravity' || opt.value === 'sfca') {
                    opt.hidden = !supportsGravity;
                }
                if (opt.value === 'score') {
                    opt.hidden = !supportsScore;
                }
            });
        }

        const scoringModeSelect = document.getElementById('sante-scoring-mode');
        if (scoringModeSelect) {
            const supportsGravity = SanteModel.supportsGravity();
            const supportsScore = SanteModel.supportsScoreComposite();
            Array.from(scoringModeSelect.options).forEach(opt => {
                if (opt.value === 'gravity' || opt.value === 'sfca') {
                    opt.hidden = !supportsGravity;
                }
                if (opt.value === 'composite') {
                    opt.hidden = !supportsScore;
                }
            });
        }

        if (!SanteModel.supportsGravity() && ['gravity', 'sfca'].includes(SanteModel.getMapDisplayMode())) {
            SanteModel.setMapDisplayMode('density');
        }
        if (!SanteModel.supportsScoreComposite() && SanteModel.getMapDisplayMode() === 'score') {
            SanteModel.setMapDisplayMode('density');
        }

        if (mapModeSelect) {
            mapModeSelect.value = SanteModel.getMapDisplayMode();
        }

        if (!SanteModel.supportsGravity() && ['gravity', 'sfca'].includes(this.scoringMode)) {
            this.scoringMode = 'density';
        }
        if (!SanteModel.supportsScoreComposite() && this.scoringMode === 'composite') {
            this.scoringMode = 'density';
        }

        if (scoringModeSelect) {
            scoringModeSelect.value = this.scoringMode;
        }
    },

    updateGravityControlsVisibility() {
        const mapControls = document.getElementById('sante-gravity-controls-map');
        const scoringControls = document.getElementById('sante-gravity-controls-scoring');
        const isGravityMap = SanteModel.supportsGravity() && ['gravity', 'sfca'].includes(SanteModel.getMapDisplayMode());
        const isGravityScoring = SanteModel.supportsGravity() && ['gravity', 'sfca'].includes(this.scoringMode);
        if (mapControls) mapControls.style.display = isGravityMap ? 'grid' : 'none';
        if (scoringControls) scoringControls.style.display = isGravityScoring ? 'grid' : 'none';
        const offerMapLabel = document.querySelector('label[for="sante-gravity-offer-map"]');
        const offerMapSelect = document.getElementById('sante-gravity-offer-map');
        const offerScoringLabel = document.querySelector('label[for="sante-gravity-offer-scoring"]');
        const offerScoringSelect = document.getElementById('sante-gravity-offer-scoring');
        const showOffer = SanteModel.supportsWeighted();
        if (offerMapLabel) offerMapLabel.style.display = showOffer ? '' : 'none';
        if (offerMapSelect) offerMapSelect.style.display = showOffer ? '' : 'none';
        if (offerScoringLabel) offerScoringLabel.style.display = showOffer ? '' : 'none';
        if (offerScoringSelect) offerScoringSelect.style.display = showOffer ? '' : 'none';
        this.updateBetaControlVisibility();
    },

    updateAggregationTabVisibility() {
        const btn = document.getElementById('sante-aggregation-tab-btn');
        const view = document.getElementById('sante-aggregation-view');
        // Visible pour les deux datasets (pro et etab ont tous les deux acc_grav_* et acc_2sfca_*)
        const show = SanteModel.isLoaded;
        if (btn) btn.style.display = show ? '' : 'none';
        if (!show && view && view.classList.contains('active')) {
            // Basculer vers Cartographies si on cache cet onglet
            view.classList.remove('active');
            const mapView = document.getElementById('sante-map-view');
            if (mapView) mapView.classList.add('active');
            document.querySelectorAll('.sante-subtab-button').forEach(b => {
                b.classList.toggle('active', b.dataset.santeTab === 'sante-map-view');
            });
        }
    },

    updateTensionsTabVisibility() {
        const btn = document.getElementById('sante-tensions-tab-btn');
        const view = document.getElementById('sante-tensions-view');
        const show = SanteModel.activeDataset === 'pro' && SanteModel.isLoaded && SanteModel.hasTensionsData();
        if (btn) btn.style.display = show ? '' : 'none';
        if (!show && view && view.classList.contains('active')) {
            view.classList.remove('active');
            const mapView = document.getElementById('sante-map-view');
            if (mapView) mapView.classList.add('active');
            document.querySelectorAll('.sante-subtab-button').forEach(b => {
                b.classList.toggle('active', b.dataset.santeTab === 'sante-map-view');
            });
        }
    },

    renderAggregationTab() {
        const typeSelect = document.getElementById('sante-aggregation-type');
        const type = typeSelect?.value || 'global';
        this.updateAggregationDescription(type);
        SanteMapView.afficherCarteAggregation(type);
    },

    updateAggregationDescription(type) {
        const el = document.getElementById('sante-aggregation-desc');
        if (!el) return;
        const isEtab = SanteModel.activeDataset === 'etab';
        const offreLabel = isEtab ? 'étab./10 000 hab.' : 'pros/10 000 hab.';
        const descriptions = {
            density:  `<strong>Densité agrégée</strong> — Moyenne de la densité totale non pondérée et pondérée (${offreLabel}) par commune, normalisée [0–100].`,
            score:    `<strong>Score densité + diversité agrégé</strong> — Moyenne du score composite non pondéré et pondéré par commune, normalisée [0–100].`,
            gravity:  `<strong>Accessibilité gravitaire agrégée</strong> — Moyenne de toutes les combinaisons de paramètres (β, rayon, offre) de l'indicateur gravitaire par commune, normalisée [0–100].`,
            sfca:     `<strong>Accessibilité 2SFCA agrégée</strong> — Moyenne de toutes les combinaisons de paramètres (temps de trajet, offre) du 2SFCA par commune, normalisée [0–100].`,
            global:   `<strong>Agrégation globale</strong> — Synthèse des 4 indicateurs : chaque indicateur est d'abord normalisé à [0–1] indépendamment, puis les 4 valeurs sont moyennées par commune et ramenées à [0–100]. Donne un poids égal à chaque famille d'indicateur.`,
        };
        el.innerHTML = descriptions[type] || '';
    },

    renderTensionsTab() {
        const typeSelect = document.getElementById('sante-tension-aggregation-type');
        const removeSelect = document.getElementById('sante-tension-remove-level');
        if (!typeSelect || !removeSelect) return;
        if (!SanteModel.hasTensionsData()) {
            this.updateTensionDescription(typeSelect.value || 'global', 1, true);
            return;
        }

        const levels = SanteModel.getTensionScenarioLevels();
        if (levels.length) {
            const wanted = Number(removeSelect.value) || levels[0];
            removeSelect.innerHTML = levels.map(level =>
                `<option value="${level}">${level} professionnel${level > 1 ? 's' : ''} réduit${level > 1 ? 's' : ''}</option>`
            ).join('');
            removeSelect.value = String(levels.includes(wanted) ? wanted : levels[0]);
        }

        const type = typeSelect.value || 'global';
        const removedCount = Number(removeSelect.value) || 1;
        const scenarioKey = SanteModel.getTensionScenarioKeyForRemoveCount(removedCount);
        this.updateTensionDescription(type, removedCount, false);
        SanteMapView.afficherCarteTensions(type, scenarioKey);
    },

    updateTensionDescription(type, removedCount, noData = false) {
        const el = document.getElementById('sante-tension-desc');
        if (!el) return;
        el.innerHTML = '';
        el.style.display = 'none';
    },

    updateIndicatorDescription(mode) {
        const el = document.getElementById('sante-indicator-desc-content');
        if (!el) return;
        const isEtab = SanteModel.activeDataset === 'etab';

        const kf = (tex) => {
            if (window.katex) {
                return `<div class="sante-formula-block">${katex.renderToString(tex, { displayMode: true, throwOnError: false })}</div>`;
            }
            return `<div class="sante-formula-block"><code>${tex}</code></div>`;
        };

        const entity  = isEtab ? 'établissements sanitaires' : 'professionnels de santé';
        const unit    = isEtab ? "d'établissements" : 'de professionnels';
        const sj      = isEtab ? 'S<sub>j</sub> = effectif de l\'établissement j' : 'S<sub>j</sub> = offre du professionnel j (1 ou pondéré)';

        const wasExpanded = !!(el.querySelector('.sante-desc-body:not(.collapsed)'));

        const descriptions = {
            density: `<strong>Densité / 10 000 habitants</strong>
                <div class="sante-desc-body collapsed">
                Mesure le nombre de ${entity} par commune rapporté à la population locale.
                Elle repère les zones sous-dotées mais ignore la proximité géographique de l'offre voisine.
                ${kf('D_i = \\dfrac{O_i}{P_i} \\times 10\\,000')}
                <span class="sante-formula-legend">O<sub>i</sub> = nb ${unit} · P<sub>i</sub> = population</span>
                </div>`,

            score: `<strong>Score densité + diversité</strong>
                <div class="sante-desc-body collapsed">
                Combine ${isEtab ? 'la densité des établissements (60&nbsp;%) et la diversité des types présents (40&nbsp;%)' : 'la densité des professionnels (60&nbsp;%) et la diversité des spécialités (40&nbsp;%)'}, normalisées en [0,&nbsp;1].
                ${kf('S_i = 0.6\\,\\tilde{D}_i + 0.4\\,\\tilde{\\mathrm{Div}}_i')}
                </div>`,

            gravity: `<strong>Accessibilité spatiale gravitaire</strong>
                <div class="sante-desc-body collapsed">
                <span class="sante-formula-legend">${sj} · d<sub>ij</sub> = distance (km) · β = décroissance</span>
                Estime l'accessibilité à l'offre de soins en tenant compte à la fois du nombre de ${entity} disponibles et de leur éloignement.
                La contribution de chaque ${isEtab ? 'établissement' : 'professionnel'} diminue progressivement avec la distance selon un paramètre de décroissance β.
                Plus β est élevé, plus les ${entity} éloignés ont une influence faible sur l'indicateur.
                ${kf('A_i = \\sum_j S_j\\,e^{-\\beta\\,d_{ij}}')}
                </div>`,

            sfca: `<strong>Accessibilité spatiale 2SFCA classique</strong>
                <div class="sante-desc-body collapsed">
                <span class="sante-formula-legend">${sj} · P<sub>k</sub> = pop. du carreau k · t = seuil (km)</span>
                Méthode réalisée en deux étapes.<br>
                <em class="sante-formula-step">Étape 1 — un ratio offre/demande est calculé pour chaque ${isEtab ? 'établissement' : 'professionnel'} en tenant compte de la population dans son bassin d'attraction (temps de trajet) :</em>
                ${kf('R_j = \\dfrac{S_j}{\\displaystyle\\sum_{k\\,:\\,d_{kj}\\leq t} P_k}')}
                <em class="sante-formula-step">Étape 2 — pour chaque commune, les ratios des ${entity} accessibles dans ce même temps de trajet sont additionnés :</em>
                ${kf('A_i = \\sum_{j\\,:\\,d_{ij}\\leq t} R_j')}
                </div>`
        };
        el.innerHTML = descriptions[mode] || '';

        // Restaure l'état ouvert/fermé entre changements d'indicateur
        const toggle = document.getElementById('sante-desc-toggle');
        const body = el.querySelector('.sante-desc-body');
        if (wasExpanded && body) {
            body.classList.remove('collapsed');
            if (toggle) { toggle.textContent = '▲'; toggle.title = 'Masquer les détails'; }
        } else if (toggle) {
            toggle.textContent = '▼'; toggle.title = 'Afficher les détails';
        }
    },

    updateDensityScoreOfferVisibility() {
        const densityOfferMapControl = document.getElementById('sante-density-offer-map-control');
        const scoreOfferMapControl = document.getElementById('sante-score-offer-map-control');
        const scoringOfferControl = document.getElementById('sante-density-offer-control');
        const mapMode = SanteModel.getMapDisplayMode();
        const scoringMode = this.scoringMode;
        const supportsWeighted = SanteModel.supportsWeighted();

        if (densityOfferMapControl) {
            densityOfferMapControl.style.display = (supportsWeighted && mapMode === 'density') ? 'grid' : 'none';
        }
        if (scoreOfferMapControl) {
            scoreOfferMapControl.style.display = (supportsWeighted && mapMode === 'score') ? 'grid' : 'none';
        }
        if (scoringOfferControl) {
            scoringOfferControl.style.display = (supportsWeighted && (scoringMode === 'density' || scoringMode === 'composite')) ? 'grid' : 'none';
        }
    },

    updateCategoryPanelVisibility() {
        const panel = document.querySelector('.sante-categories-panel');
        if (!panel) return;
        const mode = SanteModel.getMapDisplayMode();
        panel.style.display = mode === 'density' ? '' : 'none';
    },

    getCurrentMapOfferVariant() {
        if (!SanteModel.supportsWeighted()) return 'raw';
        const mode = SanteModel.getMapDisplayMode();
        if (mode === 'density') {
            return document.getElementById('sante-density-offer-map')?.value || SanteModel.mapOfferVariant || 'raw';
        }
        if (mode === 'score') {
            return document.getElementById('sante-score-offer-map')?.value || SanteModel.mapOfferVariant || 'raw';
        }
        return 'raw';
    },

    updateBetaControlVisibility() {
        const method = SanteModel.getGravitySelection().method;
        const hideBeta = method === '2sfca';

        const mapBetaLabel = document.querySelector('label[for="sante-gravity-beta-map"]');
        const mapBetaSelect = document.getElementById('sante-gravity-beta-map');
        const scoringBetaLabel = document.querySelector('label[for="sante-gravity-beta-scoring"]');
        const scoringBetaSelect = document.getElementById('sante-gravity-beta-scoring');

        if (mapBetaLabel) mapBetaLabel.style.display = hideBeta ? 'none' : '';
        if (mapBetaSelect) mapBetaSelect.style.display = hideBeta ? 'none' : '';
        if (scoringBetaLabel) scoringBetaLabel.style.display = hideBeta ? 'none' : '';
        if (scoringBetaSelect) scoringBetaSelect.style.display = hideBeta ? 'none' : '';
    },

    updateRadiusControlLabels() {
        if (!SanteModel.supportsGravity()) return;
        const method = SanteModel.getGravitySelection().method;
        const isSfca = method === '2sfca';
        const mapRadiusLabel = document.querySelector('label[for="sante-gravity-radius-map"]');
        const scoringRadiusLabel = document.querySelector('label[for="sante-gravity-radius-scoring"]');
        const labelText = isSfca ? 'Temps de trajet' : 'Rayon de recherche';
        if (mapRadiusLabel) mapRadiusLabel.textContent = labelText;
        if (scoringRadiusLabel) scoringRadiusLabel.textContent = labelText;
    },

    applyDefaultAccessibilitySelectionByMode(mode) {
        const currentVariant = SanteModel.getGravitySelection().offerVariant || 'raw';

        if (mode === 'sfca') {
            const lists = SanteModel.getGravityOptionLists();
            const sfcaRadiusKeys = (lists.radiusKeys || []).filter(r => /^d\d+min$/.test(String(r)));
            const defaultSfcaRadius = sfcaRadiusKeys.length
                ? sfcaRadiusKeys.sort((a, b) => {
                    const ma = Number(String(a).match(/^d(\d+)min$/)?.[1] || 0);
                    const mb = Number(String(b).match(/^d(\d+)min$/)?.[1] || 0);
                    return ma - mb;
                })[0]
                : 'd15min';

            const applied = SanteModel.setGravitySelection({
                method: '2sfca',
                accessType: 'spatial_local',
                betaKey: 'none',
                radiusKey: defaultSfcaRadius,
                offerVariant: currentVariant,
            });
            if (!applied) {
                SanteModel.setGravitySelection({
                    method: '2sfca',
                    accessType: lists.accessTypes[0] || 'spatial_local',
                    betaKey: 'none',
                    radiusKey: defaultSfcaRadius,
                    offerVariant: currentVariant,
                });
            }
            return;
        }

        if (mode === 'gravity') {
            const applied = SanteModel.setGravitySelection({
                method: 'grav',
                accessType: 'spatial_local',
                betaKey: 'b010',
                radiusKey: 'r15km',
                offerVariant: currentVariant,
            });
            if (!applied) {
                const lists = SanteModel.getGravityOptionLists();
                const fallbackBeta = (lists.betaKeys || []).find(k => k !== 'none') || 'b010';
                const fallbackRadius = (lists.radiusKeys || []).find(k => k.startsWith('r') || k === 'no_limit') || 'r15km';
                SanteModel.setGravitySelection({
                    method: 'grav',
                    accessType: lists.accessTypes[0] || 'spatial_local',
                    betaKey: fallbackBeta,
                    radiusKey: fallbackRadius,
                    offerVariant: lists.offerVariants?.includes(currentVariant) ? currentVariant : (lists.offerVariants?.includes('raw') ? 'raw' : (lists.offerVariants?.[0] || 'raw')),
                });
            }
        }
    },

    renderEtabStatistics() {
        const tableTarget = document.getElementById('sante-etab-types-table');
        const sortEl = document.getElementById('sante-etab-sort');
        const kpiTarget = document.getElementById('sante-etab-kpis');
        if (!tableTarget) return;

        const categories = SanteModel.getCategories()
            .filter(c => c.key !== 'densite_etab_total_10000');
        if (!categories.length) {
            tableTarget.innerHTML = '<p>Aucune catégorie disponible.</p>';
            return;
        }

        const allRows = SanteModel.getRows();
        const totalPop = allRows.reduce((acc, r) => acc + (Number(r?.population) || 0), 0);
        const totalCountKey = SanteModel.getTotalCountKey(false);
        const totalEtab = allRows.reduce((acc, r) => acc + (Number(r?.[totalCountKey]) || 0), 0);
        const zeroCommunes = allRows.filter(r => (Number(r?.[totalCountKey]) || 0) <= 0).length;
        if (kpiTarget) {
            kpiTarget.innerHTML =
                `<div class="sante-kpi-card"><strong>Établissements</strong><br>${totalEtab}</div>` +
                `<div class="sante-kpi-card"><strong>Communes sans offre</strong><br>${zeroCommunes}</div>` +
                `<div class="sante-kpi-card"><strong>Communes totales</strong><br>${allRows.length}</div>`;
        }

        const rows = categories.map(cat => {
            const stats = SanteModel.getCategoryStats(cat.key, false);
            return {
                ...cat,
                mean: stats.mean,
                totalEffectif: stats.totalEffectif,
                coverageCommunes: stats.nonZeroCommunes,
            };
        });

        if (sortEl) {
            sortEl.value = this.etabStatsSortMode === 'volume' ? 'volume' : 'coverage';
        }

        const totalAll = rows.reduce((acc, r) => acc + (Number(r.totalEffectif) || 0), 0);
        const sorted = [...rows].sort((a, b) => {
            if (this.etabStatsSortMode === 'volume') {
                return (b.totalEffectif - a.totalEffectif) || (b.coverageCommunes - a.coverageCommunes);
            }
            return (b.coverageCommunes - a.coverageCommunes) || (b.totalEffectif - a.totalEffectif);
        });

        const displayRows = sorted;

        tableTarget.innerHTML =
            `<table class="sante-scoring-table">` +
            `<thead><tr>` +
                    `<th>Type</th><th>Total des établissements</th><th>Couverture geographique communale</th><th>Part (%)</th>` +
            `</tr></thead>` +
            `<tbody>${displayRows.map(r => {
                const part = totalAll > 0 ? (r.totalEffectif / totalAll) * 100 : 0;
                return `<tr>` +
                    `<td>${r.label}</td>` +
                    `<td>${r.totalEffectif}</td>` +
                        `<td>${r.coverageCommunes}</td>` +
                    `<td>${part.toFixed(1)}</td>` +
                    `</tr>`;
            }).join('')}</tbody></table>`;

        return;
    },

    renderVisualizationTab() {
        const isEtab = SanteModel.getActiveDatasetKey() === 'etab';
        const proPanel = document.getElementById('sante-pro-viz');
        const etabPanel = document.getElementById('sante-etab-viz');
        if (proPanel) proPanel.style.display = isEtab ? 'none' : '';
        if (etabPanel) etabPanel.style.display = isEtab ? '' : 'none';

        if (isEtab) {
            this.renderEtabVisualization();
            return;
        }
        this.renderProVisualization();
    },

    renderEtabVisualization() {
        const communeSelect = document.getElementById('sante-etab-viz-communes');
        const canvas = document.getElementById('sante-etab-histogram');
        if (!communeSelect || !canvas) return;

        const categories = SanteModel.getCategories()
            .filter(c => c.key !== 'densite_etab_total_10000');
        if (!categories.length) return;

        const rows = SanteModel.getRows()
            .map(r => ({
                code_commune: r?.code_commune || 'N/A',
                commune: r?.commune || 'N/A',
                row: r,
            }))
            .filter(r => r.code_commune !== 'N/A');

        if (!this.etabVizSelectedCodes.length) {
            this.etabVizSelectedCodes = rows
                .sort((a, b) => a.commune.localeCompare(b.commune, 'fr'))
                .slice(0, 1)
                .map(r => r.code_commune);
        }

        communeSelect.innerHTML = '';
        rows
            .sort((a, b) => a.commune.localeCompare(b.commune, 'fr'))
            .forEach(r => {
                const option = document.createElement('option');
                option.value = r.code_commune;
                option.textContent = `${r.commune} (${r.code_commune})`;
                if (this.etabVizSelectedCodes.includes(r.code_commune)) option.selected = true;
                communeSelect.appendChild(option);
            });

        const selectedCode = this.etabVizSelectedCodes[0];
        const selected = rows.find(r => r.code_commune === selectedCode);
        if (!selected) {
            const ctx = canvas.getContext('2d');
            if (this.etabVizChart) {
                this.etabVizChart.destroy();
                this.etabVizChart = null;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText('Sélectionnez une commune.', canvas.width / 2, canvas.height / 2);
            return;
        }

            const filteredCategories = categories
                .map(c => ({
                    label: c.label,
                    value: Number(selected.row?.[SanteModel.countKeyForDensityKey(c.key)]) || 0,
                }))
            .filter(c => c.value > 0);

        if (!filteredCategories.length) {
            if (this.etabVizChart) {
                this.etabVizChart.destroy();
            }
            this.etabVizChart = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: ['Aucun type'],
                    datasets: [{
                        label: `Nombre d\'établissements — ${selected.commune}`,
                        data: [0],
                        backgroundColor: ['#d7e9f7'],
                        borderColor: '#2c3e50',
                        borderWidth: 1,
                        minBarLength: 2,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { beginAtZero: true },
                        y: { ticks: { autoSkip: false } },
                    },
                },
            });
            return;
        }

        const labels = filteredCategories.map(c => c.label);
        const values = filteredCategories.map(c => c.value);

        const colors = this.buildGradientColors(values, '#d7e9f7', '#1f6fb2');

        if (this.etabVizChart) {
            this.etabVizChart.destroy();
        }

        this.etabVizChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: `Nombre d\'établissements — ${selected.commune}`,
                    data: values,
                    backgroundColor: colors,
                    borderColor: '#2c3e50',
                    borderWidth: 1,
                    minBarLength: 2,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.parsed.x}`,
                        },
                    },
                },
                layout: {
                    padding: { left: 60 },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                        },
                    },
                    y: { ticks: { autoSkip: false, padding: 12 } },
                },
            },
        });
    },

    renderProVisualization() {
        const communeSelect = document.getElementById('sante-pro-viz-communes');
        const offerSelect = document.getElementById('sante-pro-viz-offer');
        const canvas = document.getElementById('sante-pro-histogram');
        if (!communeSelect || !canvas) return;

        const supportsWeighted = SanteModel.supportsWeighted();
        if (offerSelect) {
            offerSelect.value = this.proVizOfferVariant || 'raw';
            offerSelect.style.display = supportsWeighted ? '' : 'none';
        }
        const offerLabel = document.querySelector('label[for="sante-pro-viz-offer"]');
        if (offerLabel) {
            offerLabel.style.display = supportsWeighted ? '' : 'none';
        }
        if (!supportsWeighted) {
            this.proVizOfferVariant = 'raw';
        }
        const offerVariant = supportsWeighted && offerSelect?.value === 'weighted' ? 'weighted' : 'raw';
        this.proVizOfferVariant = offerVariant;
        const totalKey = SanteModel.getTotalDensityKey(false);
        const categories = SanteModel.getCategories()
            .filter(c => c.key !== totalKey);
        if (!categories.length) return;

        const rows = SanteModel.getRows()
            .map(r => ({
                code_commune: r?.code_commune || 'N/A',
                commune: r?.commune || 'N/A',
                row: r,
            }))
            .filter(r => r.code_commune !== 'N/A');

        if (!this.proVizSelectedCodes.length) {
            this.proVizSelectedCodes = rows
                .sort((a, b) => a.commune.localeCompare(b.commune, 'fr'))
                .slice(0, 1)
                .map(r => r.code_commune);
        }

        communeSelect.innerHTML = '';
        rows
            .sort((a, b) => a.commune.localeCompare(b.commune, 'fr'))
            .forEach(r => {
                const option = document.createElement('option');
                option.value = r.code_commune;
                option.textContent = `${r.commune} (${r.code_commune})`;
                if (this.proVizSelectedCodes.includes(r.code_commune)) option.selected = true;
                communeSelect.appendChild(option);
            });

        const selectedCode = this.proVizSelectedCodes[0];
        const selected = rows.find(r => r.code_commune === selectedCode);
        if (!selected) {
            const ctx = canvas.getContext('2d');
            if (this.proVizChart) {
                this.proVizChart.destroy();
                this.proVizChart = null;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText('Sélectionnez une commune.', canvas.width / 2, canvas.height / 2);
            return;
        }

        const population = Number(selected.row?.population) || 0;
        const filteredCategories = categories
            .map(c => {
                if (offerVariant === 'weighted') {
                    const weightedKey = `${c.key}_weighted`;
                    const densite = Number(selected.row?.[weightedKey]);
                    const value = isFinite(densite) ? (densite * population) / 10000 : 0;
                    return { label: c.label, value };
                }
                return {
                    label: c.label,
                    value: Number(selected.row?.[SanteModel.countKeyForDensityKey(c.key)]) || 0,
                };
            })
            .filter(c => c.value > 0);

        if (!filteredCategories.length) {
            if (this.proVizChart) {
                this.proVizChart.destroy();
            }
            this.proVizChart = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: ['Aucune spécialité'],
                    datasets: [{
                        label: offerVariant === 'weighted'
                            ? `Offre ponderee (S_j) — ${selected.commune}`
                            : `Nombre de professionnels — ${selected.commune}`,
                        data: [0],
                        backgroundColor: ['#d7e9f7'],
                        borderColor: '#2c3e50',
                        borderWidth: 1,
                        minBarLength: 2,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { beginAtZero: true },
                        y: { ticks: { autoSkip: false } },
                    },
                },
            });
            return;
        }

        const labels = filteredCategories.map(c => c.label);
        const values = filteredCategories.map(c => c.value);

        const colors = this.buildGradientColors(values, '#d7e9f7', '#1f6fb2');

        if (this.proVizChart) {
            this.proVizChart.destroy();
        }

        this.proVizChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: offerVariant === 'weighted'
                        ? `Offre ponderee (S_j) — ${selected.commune}`
                        : `Nombre de professionnels — ${selected.commune}`,
                    data: values,
                    backgroundColor: colors,
                    borderColor: '#2c3e50',
                    borderWidth: 1,
                    minBarLength: 2,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.parsed.x}`,
                        },
                    },
                },
                layout: {
                    padding: { left: 60 },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                        },
                    },
                    y: { ticks: { autoSkip: false, padding: 12 } },
                },
            },
        });
    },

    buildGradientColors(values, startColor, endColor) {
        const toRgb = (hex) => {
            const clean = hex.replace('#', '');
            const r = parseInt(clean.slice(0, 2), 16);
            const g = parseInt(clean.slice(2, 4), 16);
            const b = parseInt(clean.slice(4, 6), 16);
            return { r, g, b };
        };
        const mix = (a, b, t) => Math.round(a + (b - a) * t);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const span = max - min || 1;
        const c1 = toRgb(startColor);
        const c2 = toRgb(endColor);

        return values.map(v => {
            const t = (v - min) / span;
            const r = mix(c1.r, c2.r, t);
            const g = mix(c1.g, c2.g, t);
            const b = mix(c1.b, c2.b, t);
            return `rgb(${r}, ${g}, ${b})`;
        });
    },

    fillSelect(selectEl, options, currentValue, toLabel) {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = toLabel(opt);
            if (opt === currentValue) option.selected = true;
            selectEl.appendChild(option);
        });
    },

    syncGravitySelectValues() {
        const sel = SanteModel.getGravitySelection();
        const ids = [
            'sante-gravity-type-map',
            'sante-gravity-beta-map',
            'sante-gravity-radius-map',
            'sante-gravity-offer-map',
            'sante-gravity-type-scoring',
            'sante-gravity-beta-scoring',
            'sante-gravity-radius-scoring',
            'sante-gravity-offer-scoring',
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id.includes('type')) el.value = sel.accessType;
            if (id.includes('beta')) el.value = sel.betaKey;
            if (id.includes('radius')) el.value = sel.radiusKey;
            if (id.includes('offer')) el.value = sel.offerVariant;
        });
    },

    renderGravitySelectors() {
        const lists = SanteModel.getGravityOptionLists();
        const current = SanteModel.getGravitySelection();

        this.fillSelect(
            document.getElementById('sante-gravity-type-map'),
            lists.accessTypes,
            current.accessType,
            (v) => SanteModel.gravityAccessTypeLabel(v)
        );
        this.fillSelect(
            document.getElementById('sante-gravity-beta-map'),
            lists.betaKeys,
            current.betaKey,
            (v) => SanteModel.gravityBetaLabel(v)
        );
        this.fillSelect(
            document.getElementById('sante-gravity-radius-map'),
            lists.radiusKeys,
            current.radiusKey,
            (v) => SanteModel.gravityRadiusLabel(v)
        );
        this.fillSelect(
            document.getElementById('sante-gravity-offer-map'),
            lists.offerVariants || ['raw'],
            current.offerVariant,
            (v) => SanteModel.gravityOfferVariantLabel(v)
        );

        this.fillSelect(
            document.getElementById('sante-gravity-type-scoring'),
            lists.accessTypes,
            current.accessType,
            (v) => SanteModel.gravityAccessTypeLabel(v)
        );
        this.fillSelect(
            document.getElementById('sante-gravity-beta-scoring'),
            lists.betaKeys,
            current.betaKey,
            (v) => SanteModel.gravityBetaLabel(v)
        );
        this.fillSelect(
            document.getElementById('sante-gravity-radius-scoring'),
            lists.radiusKeys,
            current.radiusKey,
            (v) => SanteModel.gravityRadiusLabel(v)
        );

        this.fillSelect(
            document.getElementById('sante-gravity-offer-scoring'),
            lists.offerVariants || ['raw'],
            current.offerVariant,
            (v) => SanteModel.gravityOfferVariantLabel(v)
        );
        this.syncGravitySelectValues();
        this.updateGravityControlsVisibility();
        this.updateRadiusControlLabels();
    },

    bindGravitySelector(id, field, scope = 'map') {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => {
            const next = { [field]: el.value };

            const refMode = scope === 'scoring' ? this.scoringMode : SanteModel.getMapDisplayMode();
            if (refMode === 'sfca') {
                next.method = '2sfca';
            } else if (refMode === 'gravity') {
                next.method = 'grav';
            }

            const updated = SanteModel.setGravitySelection(next);
            if (!updated) {
                this.renderGravitySelectors();
                this.syncGravitySelectValues();
                return;
            }

            this.renderGravitySelectors();
            this.syncGravitySelectValues();
            this.updateCurrentCategoryLabel();
            this.renderScoringTab();
            this.ouvrirOngletSante();
        });
    },

    initUI() {
        if (this.uiInitialized) return;

        const subtabButtons = document.querySelectorAll('.sante-subtab-button');
        const subtabContents = document.querySelectorAll('.sante-subtab-content');
        const top10ModeButtons = document.querySelectorAll('.sante-top10-mode-btn');
        const mapModeSelect = document.getElementById('sante-display-mode');
        const scoringModeSelect = document.getElementById('sante-scoring-mode');

        subtabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.santeTab;
                subtabButtons.forEach(b => b.classList.remove('active'));
                subtabContents.forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                const target = document.getElementById(tabId);
                if (target) target.classList.add('active');

                if (tabId === 'sante-map-view') {
                    setTimeout(() => this.ouvrirOngletSante(), 50);
                } else if (tabId === 'sante-stats-view') {
                    this.renderStatisticsTab();
                } else if (tabId === 'sante-viz-view') {
                    this.renderVisualizationTab();
                } else if (tabId === 'sante-scoring-view') {
                    this.renderScoringTab();
                } else if (tabId === 'sante-aggregation-view') {
                    setTimeout(() => this.renderAggregationTab(), 50);
                } else if (tabId === 'sante-tensions-view') {
                    setTimeout(() => this.renderTensionsTab(), 50);
                }
            });
        });

        top10ModeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const nextMode = btn.dataset.santeTop10Mode === 'volume' ? 'volume' : 'access';
                const currentSelected = this.selectedTopCategoryKeyByMode[this.top10Mode];

                // Conserver la spécialité en cours quand on change de mode
                if (currentSelected) {
                    this.selectedTopCategoryKeyByMode[nextMode] = currentSelected;
                }

                this.top10Mode = nextMode;
                top10ModeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderTop10Categories();
            });
        });

        if (mapModeSelect) {
            mapModeSelect.value = SanteModel.getMapDisplayMode();
            mapModeSelect.addEventListener('change', () => {
                SanteModel.setMapDisplayMode(mapModeSelect.value);
                this.applyDefaultAccessibilitySelectionByMode(mapModeSelect.value);
                this.renderGravitySelectors();
                this.updateCurrentCategoryLabel();
                this.updateGravityControlsVisibility();
                this.updateDensityScoreOfferVisibility();
                this.updateCategoryPanelVisibility();
                this.updateIndicatorDescription(mapModeSelect.value);
                this.ouvrirOngletSante();
            });
            this.updateIndicatorDescription(mapModeSelect.value);
        }

        // Bouton toggle du panneau de description
        const descToggle = document.getElementById('sante-desc-toggle');
        if (descToggle) {
            descToggle.addEventListener('click', () => {
                const body = document.querySelector('#sante-indicator-desc-content .sante-desc-body');
                if (!body) return;
                const nowCollapsed = body.classList.toggle('collapsed');
                descToggle.textContent = nowCollapsed ? '▼' : '▲';
                descToggle.title = nowCollapsed ? 'Afficher les détails' : 'Masquer les détails';
            });
        }

        // densité/composite sur la carte : écouteurs d'offre
        const densityOfferMapSelect = document.getElementById('sante-density-offer-map');
        if (densityOfferMapSelect) {
            densityOfferMapSelect.value = SanteModel.mapOfferVariant || 'raw';
            densityOfferMapSelect.addEventListener('change', () => {
                SanteModel.mapOfferVariant = densityOfferMapSelect.value;
                this.renderStatisticsTab();
                this.renderScoringTab();
                this.ouvrirOngletSante();
            });
        }

        const scoreOfferMapSelect = document.getElementById('sante-score-offer-map');
        if (scoreOfferMapSelect) {
            scoreOfferMapSelect.value = SanteModel.mapOfferVariant || 'raw';
            scoreOfferMapSelect.addEventListener('change', () => {
                SanteModel.mapOfferVariant = scoreOfferMapSelect.value;
                this.renderStatisticsTab();
                this.renderScoringTab();
                this.ouvrirOngletSante();
            });
        }

        if (scoringModeSelect) {
            scoringModeSelect.value = this.scoringMode;
            scoringModeSelect.addEventListener('change', () => {
                this.scoringMode = scoringModeSelect.value === 'density'
                    ? 'density'
                    : (scoringModeSelect.value === 'gravity'
                        ? 'gravity'
                        : (scoringModeSelect.value === 'sfca' ? 'sfca' : 'composite'));
                this.applyDefaultAccessibilitySelectionByMode(this.scoringMode);
                this.renderGravitySelectors();
                this.updateGravityControlsVisibility();
                this.updateDensityScoreOfferVisibility();
                this.renderScoringTab();
            });
        }

        // densité : écoute du sélecteur d'offre (raw / weighted)
        const densityOfferSelect = document.getElementById('sante-density-offer-scoring');
        if (densityOfferSelect) {
            densityOfferSelect.value = densityOfferSelect.value || 'raw';
            densityOfferSelect.addEventListener('change', () => this.renderScoringTab());
        }

        this.bindGravitySelector('sante-gravity-type-map', 'accessType', 'map');
        this.bindGravitySelector('sante-gravity-beta-map', 'betaKey', 'map');
        this.bindGravitySelector('sante-gravity-radius-map', 'radiusKey', 'map');
        this.bindGravitySelector('sante-gravity-offer-map', 'offerVariant', 'map');
        this.bindGravitySelector('sante-gravity-type-scoring', 'accessType', 'scoring');
        this.bindGravitySelector('sante-gravity-beta-scoring', 'betaKey', 'scoring');
        this.bindGravitySelector('sante-gravity-radius-scoring', 'radiusKey', 'scoring');
        this.bindGravitySelector('sante-gravity-offer-scoring', 'offerVariant', 'scoring');
        this.bindProStatsControls();
        this.bindEtabStatsControls();
        this.bindProVizControls();
        this.bindEtabVizControls();

        // Sélecteur de type d'agrégation
        const aggTypeSelect = document.getElementById('sante-aggregation-type');
        if (aggTypeSelect) {
            aggTypeSelect.addEventListener('change', () => {
                this.renderAggregationTab();
            });
        }

        const tensionTypeSelect = document.getElementById('sante-tension-aggregation-type');
        if (tensionTypeSelect) {
            tensionTypeSelect.addEventListener('change', () => this.renderTensionsTab());
        }
        const tensionRemoveSelect = document.getElementById('sante-tension-remove-level');
        if (tensionRemoveSelect) {
            tensionRemoveSelect.addEventListener('change', () => this.renderTensionsTab());
        }

        this.uiInitialized = true;
    },

    renderCategoryList() {
        const container = document.getElementById('sante-categorie-list');
        if (!container) return;

        container.innerHTML = '';
        const categories = SanteModel.getCategories();

        for (const cat of categories) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sante-categorie-btn';
            if (cat.key === SanteModel.activeCategoryKey) {
                btn.classList.add('active');
            }
            btn.textContent = cat.label;
            btn.addEventListener('click', () => {
                const changed = SanteModel.setActiveCategory(cat.key);
                if (!changed) return;
                this.renderCategoryList();
                this.updateCurrentCategoryLabel();
                this.ouvrirOngletSante();
            });
            container.appendChild(btn);
        }
    },

    updateCurrentCategoryLabel() {
        const target = document.getElementById('sante-current-category');
        if (!target) return;
        const mode = SanteModel.getMapDisplayMode();
        if (mode === 'gravity' || mode === 'sfca') {
            target.textContent = `Accessibilité spatiale : ${SanteModel.getGravitySelectionLabel()}`;
            return;
        }
        if (mode === 'score') {
            target.textContent = 'Indicateur densité + diversité';
            return;
        }
        const category = SanteModel.getActiveCategory();
        target.textContent = category ? `Catégorie active : ${category.label}` : '';
    },

    renderTop10Categories() {
        const container = document.getElementById('sante-top10-list');
        if (!container) return;

        container.innerHTML = '';
        const useWeighted = SanteModel.mapOfferVariant === 'weighted';
        const isVolumeMode = this.top10Mode === 'volume';
        const top10 = isVolumeMode
            ? SanteModel.getTopCategoriesByVolume(10)
            : SanteModel.getTopCategories(10, useWeighted);
        if (!top10.length) {
            container.innerHTML = '<div class="sante-top10-item">Aucune catégorie disponible</div>';
            return;
        }

        if (!this.selectedTopCategoryKeyByMode[this.top10Mode] || !top10.some(t => t.key === this.selectedTopCategoryKeyByMode[this.top10Mode])) {
            this.selectedTopCategoryKeyByMode[this.top10Mode] = top10[0].key;
        }

        top10.forEach((cat, idx) => {
            const stats = SanteModel.getCategoryStats(cat.key, useWeighted);
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'sante-top10-item';
            if (cat.key === this.selectedTopCategoryKeyByMode[this.top10Mode]) {
                item.classList.add('active');
            }
            item.textContent = isVolumeMode
                ? `${idx + 1}. ${cat.label} (offre: ${stats.totalEffectif} | couverture: ${stats.nonZeroRatePct.toFixed(1)}%)`
                : `${idx + 1}. ${cat.label} (moy: ${cat.mean.toFixed(2)} | couverture: ${stats.nonZeroRatePct.toFixed(1)}%)`;
            item.addEventListener('click', () => {
                this.selectedTopCategoryKeyByMode[this.top10Mode] = cat.key;
                this.renderTop10Categories();
                this.renderTop10Detail();
            });
            container.appendChild(item);
        });

        this.renderTop10Detail();
    },

    renderTop10Detail() {
        const target = document.getElementById('sante-top10-detail');
        if (!target) return;
        const useWeighted = SanteModel.mapOfferVariant === 'weighted';

        const selectedKey = this.selectedTopCategoryKeyByMode[this.top10Mode];
        if (!selectedKey) {
            target.innerHTML = '<p>Sélectionne une catégorie dans le Top 10.</p>';
            return;
        }

        const category = SanteModel.getTopCategories(10).find(c => c.key === selectedKey)
            || SanteModel.getTopCategoriesByVolume(10).find(c => c.key === selectedKey)
            || SanteModel.getCategories().find(c => c.key === selectedKey);
        if (!category) {
            target.innerHTML = '<p>Catégorie introuvable.</p>';
            return;
        }

        const stats = SanteModel.getCategoryStats(category.key, useWeighted);
        const topCommunes = SanteModel.getTopCommunesForCategory(
            category.key,
            10,
            this.top10Mode === 'volume' ? 'volume' : 'density',
            useWeighted
        );

        const communesList = topCommunes.length
            ? `<ul>${topCommunes.map(c => `<li><strong>${c.commune}</strong> (${c.code_commune}) — densité ${c.densite.toFixed(2)} / 10 000, offre ${c.effectif}, pop ${c.population}</li>`).join('')}</ul>`
            : '<p>Aucune commune avec densité non nulle pour cette spécialité.</p>';

        target.innerHTML =
            `<h3>${category.label}</h3>` +
            `<p>Couverture: <strong>${stats.nonZeroRatePct.toFixed(1)}%</strong> (${stats.nonZeroCommunes}/${stats.totalCommunes}) • Moy: <strong>${stats.mean.toFixed(2)}</strong> • Max: <strong>${stats.max.toFixed(2)}</strong> • Offre: <strong>${stats.totalEffectif}</strong></p>` +
            `<p><button type="button" class="sante-categorie-btn" id="sante-show-on-map-btn">Voir sur la carte</button></p>` +
            communesList;

        const mapBtn = document.getElementById('sante-show-on-map-btn');
        if (mapBtn) {
            mapBtn.addEventListener('click', () => {
                SanteModel.setActiveCategory(category.key);
                this.renderCategoryList();
                this.updateCurrentCategoryLabel();

                const mapTabBtn = document.querySelector('.sante-subtab-button[data-sante-tab="sante-map-view"]');
                if (mapTabBtn) mapTabBtn.click();
            });
        }
    },

    renderProStatistics() {
        const tableTarget = document.getElementById('sante-pro-types-table');
        const sortEl = document.getElementById('sante-pro-sort');
        const kpiTarget = document.getElementById('sante-pro-kpis');
        if (!tableTarget) return;

        const totalKey = SanteModel.getTotalDensityKey(false);
        const categories = SanteModel.getCategories()
            .filter(c => c.key !== totalKey);
        if (!categories.length) {
            tableTarget.innerHTML = '<p>Aucune spécialité disponible.</p>';
            return;
        }

        const useWeighted = SanteModel.supportsWeighted() && SanteModel.mapOfferVariant === 'weighted';
        const allRows = SanteModel.getRows();
        const totalCountKey = SanteModel.getTotalCountKey(useWeighted);
        const globalTotal = SanteModel.getGlobalProfessionalTotal();
        const totalValue = isFinite(globalTotal)
            ? globalTotal
            : allRows.reduce((acc, r) => acc + (Number(r?.[totalCountKey]) || 0), 0);
        const zeroCommunes = allRows.filter(r => (Number(r?.[totalCountKey]) || 0) <= 0).length;
        const totalDisplay = useWeighted ? totalValue.toFixed(2) : totalValue;
        if (kpiTarget) {
            kpiTarget.innerHTML =
                `<div class="sante-kpi-card"><strong>Professionnels</strong><br>${totalDisplay}</div>` +
                `<div class="sante-kpi-card"><strong>Specialites</strong><br>${categories.length}</div>` +
                `<div class="sante-kpi-card"><strong>Communes sans offre</strong><br>${zeroCommunes}</div>` +
                `<div class="sante-kpi-card"><strong>Communes totales</strong><br>${allRows.length}</div>`;
        }

        const rows = categories.map(cat => {
            const stats = SanteModel.getCategoryStats(cat.key, useWeighted);
            return {
                ...cat,
                mean: stats.mean,
                totalEffectif: stats.totalEffectif,
                coverageCommunes: stats.nonZeroCommunes,
            };
        });

        if (sortEl) {
            sortEl.value = this.proStatsSortMode === 'volume' ? 'volume' : 'coverage';
        }

        const totalAll = rows.reduce((acc, r) => acc + (Number(r.totalEffectif) || 0), 0);
        const sorted = [...rows].sort((a, b) => {
            if (this.proStatsSortMode === 'volume') {
                return (b.totalEffectif - a.totalEffectif) || (b.coverageCommunes - a.coverageCommunes);
            }
            return (b.coverageCommunes - a.coverageCommunes) || (b.totalEffectif - a.totalEffectif);
        });

        tableTarget.innerHTML =
            `<table class="sante-scoring-table">` +
            `<thead><tr>` +
                    `<th>Spécialité</th><th>Total des professionnels</th><th>Couverture geographique communale</th><th>Part (%)</th>` +
            `</tr></thead>` +
            `<tbody>${sorted.map(r => {
                const part = totalAll > 0 ? (r.totalEffectif / totalAll) * 100 : 0;
                return `<tr>` +
                    `<td>${r.label}</td>` +
                    `<td>${r.totalEffectif}</td>` +
                    `<td>${r.coverageCommunes}</td>` +
                    `<td>${part.toFixed(1)}</td>` +
                    `</tr>`;
            }).join('')}</tbody></table>`;
    },

    renderStatisticsTab() {
        const isEtab = SanteModel.getActiveDatasetKey() === 'etab';
        const proBlock = document.getElementById('sante-pro-stats');
        const etabBlock = document.getElementById('sante-etab-stats');
        if (proBlock) proBlock.style.display = isEtab ? 'none' : '';
        if (etabBlock) etabBlock.style.display = isEtab ? '' : 'none';

        if (isEtab) {
            this.renderEtabStatistics();
            return;
        }
        this.renderProStatistics();
    },

    bindProStatsControls() {
        const sortEl = document.getElementById('sante-pro-sort');
        if (sortEl) {
            sortEl.addEventListener('change', () => {
                this.proStatsSortMode = sortEl.value === 'volume' ? 'volume' : 'coverage';
                this.renderStatisticsTab();
            });
        }
    },

    bindEtabStatsControls() {
        const sortEl = document.getElementById('sante-etab-sort');
        if (sortEl) {
            sortEl.addEventListener('change', () => {
                this.etabStatsSortMode = sortEl.value === 'volume' ? 'volume' : 'coverage';
                this.renderStatisticsTab();
            });
        }

        return;
    },

    bindEtabVizControls() {
        const communeEl = document.getElementById('sante-etab-viz-communes');
        if (communeEl) {
            const syncSelection = () => {
                const selected = Array.from(communeEl.selectedOptions).map(o => o.value);
                this.etabVizSelectedCodes = selected.slice(0, 1);
                this.renderVisualizationTab();
            };
            communeEl.addEventListener('change', syncSelection);
            communeEl.addEventListener('input', syncSelection);
            communeEl.addEventListener('click', syncSelection);
        }
    },

    bindProVizControls() {
        const communeEl = document.getElementById('sante-pro-viz-communes');
        const offerEl = document.getElementById('sante-pro-viz-offer');
        if (communeEl) {
            const syncSelection = () => {
                const selected = Array.from(communeEl.selectedOptions).map(o => o.value);
                this.proVizSelectedCodes = selected.slice(0, 1);
                this.renderVisualizationTab();
            };
            communeEl.addEventListener('change', syncSelection);
            communeEl.addEventListener('input', syncSelection);
            communeEl.addEventListener('click', syncSelection);
        }
        if (offerEl) {
            offerEl.addEventListener('change', () => {
                this.proVizOfferVariant = offerEl.value === 'weighted' ? 'weighted' : 'raw';
                this.renderVisualizationTab();
            });
        }
    },

    renderScoringTab() {
        const methodTarget = document.getElementById('sante-scoring-method');
        const listTarget = document.getElementById('sante-scoring-list');
        const scoringModeSelect = document.getElementById('sante-scoring-mode');
        if (!methodTarget || !listTarget) return;

        if (scoringModeSelect) {
            this.scoringMode = scoringModeSelect.value === 'density'
                ? 'density'
                : (scoringModeSelect.value === 'gravity'
                    ? 'gravity'
                    : (scoringModeSelect.value === 'sfca' ? 'sfca' : 'composite'));
        }

        if (!SanteModel.supportsGravity() && ['gravity', 'sfca'].includes(this.scoringMode)) {
            this.scoringMode = 'density';
        }
        if (!SanteModel.supportsScoreComposite() && this.scoringMode === 'composite') {
            this.scoringMode = 'density';
        }

        this.updateGravityControlsVisibility();

        const gravityMode = SanteModel.supportsGravity() && (this.scoringMode === 'gravity' || this.scoringMode === 'sfca');
        const densityMode = this.scoringMode === 'density';

        if (gravityMode) {
            if (this.scoringMode === 'sfca') {
                if (!SanteModel.setGravitySelection({ method: '2sfca' })) {
                    this.applyDefaultAccessibilitySelectionByMode('sfca');
                }
            } else {
                if (!SanteModel.setGravitySelection({ method: 'grav' })) {
                    this.applyDefaultAccessibilitySelectionByMode('gravity');
                }
            }

            const top = SanteModel.getGravityRows(10);
            if (!top.length) {
                methodTarget.innerHTML = `<p><strong>Accessibilité spatiale</strong> : aucune donnée disponible pour l'option sélectionnée.</p>`;
                listTarget.innerHTML = '<p>Aucune donnée disponible.</p>';
                return;
            }

            methodTarget.innerHTML = '';

            listTarget.innerHTML =
                `<table class="sante-scoring-table">` +
                `<thead><tr><th>Rang</th><th>Commune</th><th>Code</th><th>Population</th><th>Valeur</th><th>Classe Jenks</th></tr></thead>` +
                `<tbody>${top.map((r, i) =>
                    `<tr><td>${i + 1}</td><td>${r.commune}</td><td>${r.code_commune}</td><td>${r.population}</td><td><strong>${r.gravity_value.toFixed(4)}</strong></td><td>${r.gravity_class}</td></tr>`
                ).join('')}</tbody></table>`;
            return;
        }

        if (densityMode) {
            const densityOfferEl = document.getElementById('sante-density-offer-scoring');
            const useWeighted = SanteModel.supportsWeighted() && densityOfferEl && densityOfferEl.value === 'weighted';
            methodTarget.innerHTML = '';
            const top = SanteModel.getTopDensityCommunes(10, useWeighted);
            if (!top.length) {
                listTarget.innerHTML = '<p>Aucune donnée disponible.</p>';
                return;
            }

            listTarget.innerHTML =
                `<table class="sante-scoring-table">` +
                `<thead><tr><th>Rang</th><th>Commune</th><th>Code</th><th>Population</th><th>Densité totale</th><th>Offre totale</th><th>Classe densité</th></tr></thead>` +
                `<tbody>${top.map((r, i) =>
                    `<tr><td>${i + 1}</td><td>${r.commune}</td><td>${r.code_commune}</td><td>${r.population}</td><td><strong>${r.densite_totale.toFixed(2)}</strong></td><td>${r.effectif_total}</td><td>${r.classe_densite}</td></tr>`
                ).join('')}</tbody></table>`;
            return;
        }

        methodTarget.innerHTML = '';

        const densityOfferEl = document.getElementById('sante-density-offer-scoring');
        const useWeighted = densityOfferEl && densityOfferEl.value === 'weighted';
        const top = SanteModel.getCoverageScores(10, useWeighted);
        if (!top.length) {
            listTarget.innerHTML = '<p>Aucune donnée de scoring disponible.</p>';
            return;
        }

        methodTarget.innerHTML = '';

        const diversiteLabel = SanteModel.activeDataset === 'etab' ? 'Catégories' : 'Spécialités';
        const offreLabel = SanteModel.activeDataset === 'etab' ? 'Établissements' : 'Offre';
        listTarget.innerHTML =
            `<table class="sante-scoring-table">` +
            `<thead><tr><th>Rang</th><th>Commune</th><th>Code</th><th>Population</th><th>Score /1</th><th>Classe</th><th>Densité</th><th>${diversiteLabel}</th><th>${offreLabel}</th></tr></thead>` +
            `<tbody>${top.map((r, i) =>
                `<tr><td>${i + 1}</td><td>${r.commune}</td><td>${r.code_commune}</td><td>${r.population}</td><td><strong>${r.score_couverture.toFixed(3)}</strong></td><td>${r.classe_score_couverture}</td><td>${r.densite_totale.toFixed(2)}</td><td>${r.diversite_specialites ?? 'N/A'}</td><td>${r.effectif_total}</td></tr>`
            ).join('')}</tbody></table>`;
    },

    reset() {
        SanteModel.reset();
        this.initUI();
        const mapModeSelect = document.getElementById('sante-display-mode');
        if (mapModeSelect) mapModeSelect.value = SanteModel.getMapDisplayMode();
        const scoringModeSelect = document.getElementById('sante-scoring-mode');
        if (scoringModeSelect) scoringModeSelect.value = this.scoringMode;
        this.renderGravitySelectors();
        this.updateDensityScoreOfferVisibility();
        this.renderCategoryList();
        this.updateCurrentCategoryLabel();
        this.renderStatisticsTab();
        this.renderScoringTab();
        this.renderVisualizationTab();
    },

    /**
     * @param {Object|Array} santeData
     * @param {Object|Array} etabData
     */
    chargerDonnees(santeData, etabData, tensionsData = null) {
        this.initUI();
        SanteModel.chargerDonnees(santeData, 'pro');
        if (etabData) {
            SanteModel.chargerDonnees(etabData, 'etab');
        }
        SanteModel.loadTensionsData(tensionsData || null);
        SanteModel.setActiveDataset('pro');
        this.applyDatasetUi();
        const mapModeSelect = document.getElementById('sante-display-mode');
        if (mapModeSelect) mapModeSelect.value = SanteModel.getMapDisplayMode();
        const scoringModeSelect = document.getElementById('sante-scoring-mode');
        if (scoringModeSelect) scoringModeSelect.value = this.scoringMode;
        this.renderGravitySelectors();
        this.updateDensityScoreOfferVisibility();
        this.renderCategoryList();
        this.updateCurrentCategoryLabel();
        this.renderStatisticsTab();
        this.renderScoringTab();
        this.renderVisualizationTab();
    },

    ouvrirOngletSante() {
        const mapMode = SanteModel.getMapDisplayMode();
        if (mapMode === 'sfca') {
            if (!SanteModel.setGravitySelection({ method: '2sfca' })) {
                this.applyDefaultAccessibilitySelectionByMode('sfca');
            }
        } else if (mapMode === 'gravity') {
            if (!SanteModel.setGravitySelection({ method: 'grav' })) {
                this.applyDefaultAccessibilitySelectionByMode('gravity');
            }
        }

        this.updateCurrentCategoryLabel();
        SanteMapView.afficherCarte();
        SanteMapView.synchroniserAvecCarteReference();
    },
};

window.SanteController = SanteController;
