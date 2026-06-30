/**
 * Modèle Santé Corse
 *
 * Responsabilité : stocker et préparer les données Santé pour la cartographie.
 */
const SanteModel = {
    datasets: {},
    activeDataset: 'pro',
    datasetConfigs: {
        pro: {
            label: 'Carte professionnels de santé',
            categoriesLabel: 'Catégories de praticiens',
            supportsWeighted: true,
            supportsGravity: true,
            supportsScoreComposite: true,
        },
        etab: {
            label: 'Carte établissements sanitaires',
            categoriesLabel: 'Catégories d\'établissements',
            supportsWeighted: false,
            supportsGravity: true,
            supportsScoreComposite: true,
        },
    },
    zeroClassColor: '#9e9e9e',
    zeroClassLabel: 'Classe 0 — Zone sans offre (valeur = 0)',
    aggregationMaps: {},
    tensionMeta: {},
    tensionScenarioMaps: {},
    tensionScenarioRowsByCode: {},
    tensionAvailableLevels: [],
    indicatorConfig: {
        coverageScore: {
            totalDensityKey: 'densite_professionnels_total_10000',
            weights: {
                densite: 0.6,
                diversite: 0.4,
            },
        },
    },
    // Spécialités essentielles utilisées dans le calcul de couverture "essentielles"
    essentialDensityKeys: [
        'densite_cardiologue_10000',
        'densite_chirurgien_dentiste_10000',
        'densite_medecin_generaliste_10000',
        'densite_radiologue_10000',
        'densite_psychiatre_10000',
        'densite_sage_femme_10000',
        'densite_ophtalmologiste_10000',
    ],
    dataByKey: {},
    densiteByCategory: {},
    categories: [],
    allCategories: [],
    topCategories: [],
    specialtyUniqueCounts: {},
    activeCategoryKey: null,
    mapDisplayMode: 'density',
    mapOfferVariant: 'raw',  // Sélection raw/weighted pour densité et composite sur carte
    gravityColumns: [],
    sfcaColumns: [],
    gravitySelection: {
        method: 'grav',
        accessType: 'spatial_local',
        betaKey: 'b010',
        radiusKey: 'r15km',
        offerVariant: 'raw',
    },
    coverageScoreByCode: {},
    breaksByCategory: {},
    labelsByCategory: {},
    jenksClassesByCategory: {},
    jenksLabelsByCategory: {},
    minMaxByCategory: {},
    isLoaded: false,

    reset() {
        this.datasets = {};
        this.activeDataset = 'pro';
        this.dataByKey = {};
        this.densiteByCategory = {};
        this.categories = [];
        this.allCategories = [];
        this.topCategories = [];
        this.specialtyUniqueCounts = {};
        this.activeCategoryKey = null;
        this.mapDisplayMode = 'density';
        this.mapOfferVariant = 'raw';
        this.gravityColumns = [];
        this.sfcaColumns = [];
        this.gravitySelection = {
            method: 'grav',
            accessType: 'spatial_local',
            betaKey: 'b010',
            radiusKey: 'r15km',
            offerVariant: 'raw',
        };
        this.coverageScoreByCode = {};
        this.breaksByCategory = {};
        this.labelsByCategory = {};
        this.jenksClassesByCategory = {};
        this.jenksLabelsByCategory = {};
        this.minMaxByCategory = {};
        this.tensionMeta = {};
        this.tensionScenarioMaps = {};
        this.tensionScenarioRowsByCode = {};
        this.tensionAvailableLevels = [];
        this.isLoaded = false;
    },

    formatCategoryLabel(densityKey) {
        let label = String(densityKey || '')
            .replace(/^densite_etab_/, '')
            .replace(/^densite_/, '')
            .replace(/_10000$/, '')
            .replace(/_/g, ' ')
            .trim();

        if (!label) return 'Catégorie inconnue';
        if (label === 'total' && String(densityKey || '').startsWith('densite_etab_')) return 'Total établissements';
        if (label === 'professionnels total') return 'Total tous praticiens';

        return label
            .split(' ')
            .map(mot => mot ? mot[0].toUpperCase() + mot.slice(1) : mot)
            .join(' ');
    },

    countKeyForDensityKey(densityKey) {
        if (String(densityKey || '').startsWith('densite_etab_')) {
            return String(densityKey || '')
                .replace(/^densite_etab_/, 'nb_etab_')
                .replace(/_10000$/, '');
        }
        return String(densityKey || '')
            .replace(/^densite_/, 'nb_')
            .replace(/_10000$/, '');
    },

    normalizeCode(code) {
        return String(code || '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '');
    },

    getDatasetConfig(datasetKey = this.activeDataset) {
        return this.datasetConfigs[datasetKey] || this.datasetConfigs.pro;
    },

    getActiveDatasetKey() {
        return this.activeDataset;
    },

    getActiveDatasetLabel() {
        return this.getDatasetConfig().label;
    },

    getCategoriesLabel() {
        return this.getDatasetConfig().categoriesLabel;
    },

    supportsWeighted() {
        return this.getDatasetConfig().supportsWeighted;
    },

    supportsGravity() {
        const config = this.getDatasetConfig();
        if (!config.supportsGravity) return false;
        return (this.gravityColumns?.length || 0) > 0 || (this.sfcaColumns?.length || 0) > 0;
    },

    supportsScoreComposite() {
        return this.getDatasetConfig().supportsScoreComposite;
    },

    _snapshotState() {
        return {
            dataByKey: this.dataByKey,
            densiteByCategory: this.densiteByCategory,
            categories: this.categories,
            allCategories: this.allCategories,
            topCategories: this.topCategories,
            specialtyUniqueCounts: this.specialtyUniqueCounts,
            activeCategoryKey: this.activeCategoryKey,
            mapDisplayMode: this.mapDisplayMode,
            mapOfferVariant: this.mapOfferVariant,
            gravityColumns: this.gravityColumns,
            sfcaColumns: this.sfcaColumns,
            gravitySelection: { ...this.gravitySelection },
            coverageScoreByCode: this.coverageScoreByCode,
            breaksByCategory: this.breaksByCategory,
            labelsByCategory: this.labelsByCategory,
            jenksClassesByCategory: this.jenksClassesByCategory,
            jenksLabelsByCategory: this.jenksLabelsByCategory,
            minMaxByCategory: this.minMaxByCategory,
            aggregationMaps: this.aggregationMaps,
            isLoaded: this.isLoaded,
        };
    },

    _applyState(state) {
        this.dataByKey = state.dataByKey || {};
        this.densiteByCategory = state.densiteByCategory || {};
        this.categories = state.categories || [];
        this.allCategories = state.allCategories || [];
        this.topCategories = state.topCategories || [];
        this.specialtyUniqueCounts = state.specialtyUniqueCounts || {};
        this.activeCategoryKey = state.activeCategoryKey || null;
        this.mapDisplayMode = state.mapDisplayMode || 'density';
        this.mapOfferVariant = state.mapOfferVariant || 'raw';
        this.gravityColumns = state.gravityColumns || [];
        this.sfcaColumns = state.sfcaColumns || [];
        this.gravitySelection = state.gravitySelection || {
            method: 'grav',
            accessType: 'spatial_local',
            betaKey: 'b010',
            radiusKey: 'r15km',
            offerVariant: 'raw',
        };
        this.coverageScoreByCode = state.coverageScoreByCode || {};
        this.breaksByCategory = state.breaksByCategory || {};
        this.labelsByCategory = state.labelsByCategory || {};
        this.jenksClassesByCategory = state.jenksClassesByCategory || {};
        this.jenksLabelsByCategory = state.jenksLabelsByCategory || {};
        this.minMaxByCategory = state.minMaxByCategory || {};
        this.aggregationMaps = state.aggregationMaps || {};
        this.isLoaded = Boolean(state.isLoaded);
    },

    setActiveDataset(datasetKey) {
        if (!this.datasets[datasetKey]) return false;
        if (this.datasets[this.activeDataset]) {
            this.datasets[this.activeDataset] = this._snapshotState();
        }
        this.activeDataset = datasetKey;
        this._applyState(this.datasets[datasetKey]);
        return true;
    },

    /* Calcul des breaks/labels Jenks (avec gestion des zéros et du nombre de classes)*/
    computeBreaksAndLabels(values, treatZeroAsNoData = true) {
        const cleanValues = values.filter(v => isFinite(v));
        if (!cleanValues.length) return { breaks: [], labels: [] };

        let targetValues = cleanValues;
        if (treatZeroAsNoData) {
            const nonZeroValues = cleanValues.filter(v => Number(v) > 0);
            if (!nonZeroValues.length) return { breaks: [], labels: [] };
            targetValues = nonZeroValues;
        }
        const uniqueCount = new Set(targetValues.map(v => Number(v.toFixed(6)))).size;
        const nClasses = Math.min(5, uniqueCount);

        if (nClasses <= 1) {
            const vmax = Math.max(...targetValues);
            const maxAbs = Math.max(...targetValues.map(v => Math.abs(Number(v) || 0)));
            let decimals = 2;
            if (maxAbs < 0.001) decimals = 6;
            else if (maxAbs < 0.01) decimals = 5;
            else if (maxAbs < 0.1) decimals = 4;
            else if (maxAbs < 1) decimals = 3;
            else if (maxAbs >= 10 && maxAbs < 100) decimals = 1;
            else if (maxAbs >= 100) decimals = 0;

            const fmt = (v) => {
                const n = Number(v);
                if (!isFinite(n)) return 'N/A';
                const txt = n.toFixed(decimals);
                return txt.includes('.') ? txt.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') : txt;
            };

            const prefix = treatZeroAsNoData ? '> 0 – ' : '0 – ';
            return {
                breaks: [],
                labels: [`${prefix}${fmt(vmax)}`],
            };
        }

        const rawBreaks = calculerJenksBreaks(targetValues, nClasses)
            .filter(v => isFinite(v))
            .map(v => Number(v.toFixed(4)));

        const breaks = [...new Set(rawBreaks)].sort((a, b) => a - b);

        if (!breaks.length) {
            const vmax = Math.max(...targetValues);
            const prefix = treatZeroAsNoData ? '> 0 – ' : '0 – ';
            return { breaks: [], labels: [`${prefix}${vmax.toFixed(2)}`] };
        }

        const labels = genererLabelsJenks([Math.min(...targetValues), ...breaks, Math.max(...targetValues)]);
        return { breaks, labels };
    },

    /* Attribution de la classe Jenks pour une valeur (index + libellé)*/
    getJenksClassIndex(value, breaks = []) {
        const v = Number(value);
        if (!isFinite(v)) return null;
        for (let i = 0; i < breaks.length; i++) {
            if (v <= breaks[i]) return i + 1;
        }
        return breaks.length + 1;
    },

    getJenksClassLabel(value, categoryKey) {
        const labels = this.labelsForCategory(categoryKey);
        const breaks = this.breaksForCategory(categoryKey);
        if (!isFinite(Number(value))) return 'N/A';

        const v = Number(value);
        if (!breaks.length) {
            const intervalLabel = labels[0] || '> 0';
            return this.jenksClassDecoratedLabel(0, intervalLabel, 1);
        }
        const totalClasses = breaks.length + 1;
        for (let i = 0; i < breaks.length; i++) {
            if (v <= breaks[i]) {
                const intervalLabel = labels[i] || `≤ ${breaks[i]}`;
                return this.jenksClassDecoratedLabel(i, intervalLabel, totalClasses);
            }
        }

        const lastInterval = labels[breaks.length] || `> ${breaks[breaks.length - 1]}`;
        return this.jenksClassDecoratedLabel(breaks.length, lastInterval, totalClasses);
    },

    jenksNomenclature(totalClasses = 5) {
        return Array.from({ length: totalClasses }, (_, i) => `Classe ${i + 1}`);
    },

    normalizeValueForCategory(value, categoryKey) {
        const v = Number(value);
        if (!isFinite(v)) return NaN;
        const mm = this.minMaxByCategory[categoryKey];
        if (!mm || !isFinite(mm.min) || !isFinite(mm.max)) return v;
        if (mm.max === mm.min) return v === 0 ? 0 : 100;
        return ((v - mm.min) / (mm.max - mm.min)) * 100;
    },

    labelForNormalizedValue(normValue, categoryKey) {
        const labels = this.labelsForCategory(categoryKey);
        const breaks = this.breaksForCategory(categoryKey);
        if (!isFinite(Number(normValue))) return 'N/A';

        const v = Number(normValue);
        if (!breaks.length) {
            const intervalLabel = labels[0] || '0 – 100';
            return this.jenksClassDecoratedLabel(0, intervalLabel, 1);
        }
        const totalClasses = breaks.length + 1;
        for (let i = 0; i < breaks.length; i++) {
            if (v <= breaks[i]) {
                const intervalLabel = labels[i] || `≤ ${breaks[i]}`;
                return this.jenksClassDecoratedLabel(i, intervalLabel, totalClasses);
            }
        }

        const lastInterval = labels[breaks.length] || `> ${breaks[breaks.length - 1]}`;
        return this.jenksClassDecoratedLabel(breaks.length, lastInterval, totalClasses);
    },

    jenksClassDecoratedLabel(classIndex, intervalLabel, totalClasses = 5) {
        const names = this.jenksNomenclature(totalClasses);
        const idx = Math.max(0, Math.min(totalClasses - 1, classIndex));
        const classNo = idx + 1;
        const nom = names[idx] || `Zone classe ${classNo}`;
        return `Classe ${classNo} — ${nom} (${intervalLabel || 'N/A'})`;
    },

    parseGravityColumn(colName) {
        const m = String(colName || '').match(/^acc_grav_(spatial_local|population_weighted)_beta_(b\d{3})_(no_limit|r15km|r30km)(?:_(weighted))?$/);
        if (!m) return null;
        return {
            key: colName,
            method: 'grav',
            accessType: m[1],
            betaKey: m[2],
            radiusKey: m[3],
            offerVariant: m[4] ? 'weighted' : 'raw',
        };
    },

    parseSfcaColumn(colName) {
        const m = String(colName || '').match(/^acc_2sfca_(spatial_local|population_weighted)_(d\d+min)(?:_(weighted))?$/);
        if (!m) return null;
        return {
            key: colName,
            method: '2sfca',
            accessType: m[1],
            betaKey: 'none',
            radiusKey: m[2],
            offerVariant: m[3] ? 'weighted' : 'raw',
        };
    },

    accessibilityMethodLabel(methodKey) {
        return methodKey === '2sfca' ? '2SFCA classique' : 'Gravitaire';
    },

    gravityAccessTypeLabel(accessType) {
        if (accessType === 'population_weighted') return 'Spatiale pondérée population';
        return 'Spatiale locale';
    },

    gravityBetaLabel(betaKey) {
        if (betaKey === 'none') return 'Sans β (2SFCA)';
        const map = { b005: 'β = 0.05', b010: 'β = 0.10', b020: 'β = 0.20' };
        return map[betaKey] || `β = ${betaKey}`;
    },

    gravityRadiusLabel(radiusKey) {
        const sfcaMatch = String(radiusKey || '').match(/^d(\d+)min$/);
        if (sfcaMatch) return `d0 = ${sfcaMatch[1]} min`;
        if (radiusKey === 'r15km') return 'Rayon max 15 km';
        if (radiusKey === 'r30km') return 'Rayon max 30 km';
        return 'Sans rayon max';
    },

    gravityOfferVariantLabel(offerVariant) {
        if (offerVariant === 'weighted') return 'Offre pondérée';
        return 'Offre non pondérée';
    },

    /**
     * @param {Object|Array} santeData
     * @param {string} datasetKey
     */
    chargerDonnees(santeData, datasetKey = 'pro') {
        /* le front ne sinteresse pas au clés du JSON, il récupère directeent les objets */
        /*le front transforme le JSON en liste */
        const payload = santeData || {};
        const meta = (!Array.isArray(payload) && (payload.data || payload.meta)) ? (payload.meta || {}) : {};
        const rawData = (!Array.isArray(payload) && (payload.data || payload.meta)) ? (payload.data || {}) : payload;
        const lignes = Array.isArray(rawData) ? rawData : Object.values(rawData || {});
        const byKey = {};
        const densitesParCategorie = {};

        const densityKeys = new Set();
        for (const row of lignes) {
            for (const key of Object.keys(row || {})) {
                if (key.startsWith('densite_') && key.endsWith('_10000')) {
                    densityKeys.add(key);
                }
            }
        }

        const sortedDensityKeys = [...densityKeys].sort((a, b) => {
            if (a === 'densite_professionnels_total_10000') return -1;
            if (b === 'densite_professionnels_total_10000') return 1;
            if (a === 'densite_etab_total_10000') return -1;
            if (b === 'densite_etab_total_10000') return 1;
            return this.formatCategoryLabel(a).localeCompare(this.formatCategoryLabel(b), 'fr');
        });

        // Aussi charger les colonnes _weighted
        const weightedDensityKeys = sortedDensityKeys
            .map(k => k.replace(/_10000$/, '_10000_weighted'));

        const gravityColumns = [];
        const sfcaColumns = [];
        for (const row of lignes) {
            for (const key of Object.keys(row || {})) {
                if (this.parseGravityColumn(key)) gravityColumns.push(key);
                if (this.parseSfcaColumn(key)) sfcaColumns.push(key);
            }
        }
        const uniqueGravityColumns = [...new Set(gravityColumns)].sort((a, b) => a.localeCompare(b));
        const uniqueSfcaColumns = [...new Set(sfcaColumns)].sort((a, b) => a.localeCompare(b));

        for (const key of sortedDensityKeys) {
            densitesParCategorie[key] = {};
        }
        for (const key of weightedDensityKeys) {
            densitesParCategorie[key] = {};
        }

        /* le model reconstruit un dictionnaire indexé par commune (code commune) */
        for (const row of lignes) {
            const code = this.normalizeCode(row?.code_commune);
            if (!code) continue;

            /* chaque ligne d’indicateurs est stockée avec le code commune comme clé*/
            byKey[code] = row;

            for (const densityKey of sortedDensityKeys) {
                const d = Number(row?.[densityKey]);
                if (isFinite(d)) {
                    densitesParCategorie[densityKey][code] = d;
                }
            }
            
            for (const densityKey of weightedDensityKeys) {
                const d = Number(row?.[densityKey]);
                if (isFinite(d)) {
                    densitesParCategorie[densityKey][code] = d;
                }
            }
        }

        const allCategories = sortedDensityKeys.map(key => ({
            key,
            label: this.formatCategoryLabel(key),
            countKey: this.countKeyForDensityKey(key),
        }));

        /* Calcul global Jenks pour toutes les colonnes + ajout en mémoire (jenks_classes / jenks_labels)*/
        const breaksByCategory = {};
        const labelsByCategory = {};
        const minMaxByCategory = {};

        const buildMinMax = (vals) => {
            const finite = vals.filter(v => isFinite(v));
            if (!finite.length) return { min: NaN, max: NaN };
            return { min: Math.min(...finite), max: Math.max(...finite) };
        };

        for (const key of sortedDensityKeys) {
            const rawValues = lignes
                .map(r => Number(r?.[key]))
                .filter(v => isFinite(v));
            const mm = buildMinMax(rawValues);
            minMaxByCategory[key] = mm;

            const normalized = rawValues
                .filter(v => v > 0)
                .map(v => (mm.max === mm.min ? 100 : ((v - mm.min) / (mm.max - mm.min)) * 100));
            const { breaks, labels } = this.computeBreaksAndLabels(normalized, false);
            breaksByCategory[key] = breaks;
            labelsByCategory[key] = labels;
        }

        // Aussi charger les breaks/labels pour les colonnes pondérées
        for (const key of weightedDensityKeys) {
            const rawValues = lignes
                .map(r => Number(r?.[key]))
                .filter(v => isFinite(v));
            const mm = buildMinMax(rawValues);
            minMaxByCategory[key] = mm;
            const normalized = rawValues
                .filter(v => v > 0)
                .map(v => (mm.max === mm.min ? 100 : ((v - mm.min) / (mm.max - mm.min)) * 100));
            const { breaks, labels } = this.computeBreaksAndLabels(normalized, false);
            breaksByCategory[key] = breaks;
            labelsByCategory[key] = labels;
        }

        for (const gcol of uniqueGravityColumns) {
            const rawValues = lignes
                .map(r => Number(r?.[gcol]))
                .filter(v => isFinite(v));
            const mm = buildMinMax(rawValues);
            minMaxByCategory[gcol] = mm;
            const normalized = rawValues
                .filter(v => v > 0)
                .map(v => (mm.max === mm.min ? 100 : ((v - mm.min) / (mm.max - mm.min)) * 100));
            const { breaks, labels } = this.computeBreaksAndLabels(normalized, false);
            breaksByCategory[gcol] = breaks;
            labelsByCategory[gcol] = labels;
        }

        for (const scol of uniqueSfcaColumns) {
            const rawValues = lignes
                .map(r => Number(r?.[scol]))
                .filter(v => isFinite(v));
            const mm = buildMinMax(rawValues);
            minMaxByCategory[scol] = mm;
            const normalized = rawValues
                .filter(v => v > 0)
                .map(v => (mm.max === mm.min ? 100 : ((v - mm.min) / (mm.max - mm.min)) * 100));
            const { breaks, labels } = this.computeBreaksAndLabels(normalized, false);
            breaksByCategory[scol] = breaks;
            labelsByCategory[scol] = labels;
        }

        // Score composite (déjà normalisé [0,1] par le pipeline) — Jenks calculé ici
        const scoreCompositeKeys = ['score_couverture', 'score_couverture_weighted'].filter(
            k => lignes.some(r => isFinite(Number(r?.[k])) && Number(r?.[k]) > 0)
        );
        for (const key of scoreCompositeKeys) {
            const rawValues = lignes.map(r => Number(r?.[key])).filter(v => isFinite(v));
            const mm = buildMinMax(rawValues);
            minMaxByCategory[key] = mm;
            const normalized = rawValues
                .filter(v => v > 0)
                .map(v => (mm.max === mm.min ? 100 : ((v - mm.min) / (mm.max - mm.min)) * 100));
            const { breaks, labels } = this.computeBreaksAndLabels(normalized, false);
            breaksByCategory[key] = breaks;
            labelsByCategory[key] = labels;
        }

        const jenksClassesByCategory = {};
        const jenksLabelsByCategory = {};
        const allJenksKeys = Object.keys(breaksByCategory);
        for (const key of allJenksKeys) {
            jenksClassesByCategory[key] = {};
            jenksLabelsByCategory[key] = {};
        }

        for (const row of lignes) {
            if (!row) continue;
            const code = this.normalizeCode(row?.code_commune);
            if (!code) continue;

            row.jenks_classes = row.jenks_classes || {};
            row.jenks_labels = row.jenks_labels || {};

            for (const key of allJenksKeys) {
                const rawValue = Number(row?.[key]);
                if (!isFinite(rawValue)) continue;
                if (rawValue === 0) {
                    row.jenks_classes[key] = 0;
                    row.jenks_labels[key] = this.zeroClassLabel;
                    jenksClassesByCategory[key][code] = 0;
                    jenksLabelsByCategory[key][code] = this.zeroClassLabel;
                    continue;
                }
                const normValue = this.normalizeValueForCategory(rawValue, key);
                const classIndex = this.getJenksClassIndex(normValue, breaksByCategory[key]);
                const classLabel = this.labelForNormalizedValue(normValue, key);

                row.jenks_classes[key] = classIndex;
                row.jenks_labels[key] = classLabel;
                jenksClassesByCategory[key][code] = classIndex;
                jenksLabelsByCategory[key][code] = classLabel;
            }
        }

        const state = {
            dataByKey: byKey,
            densiteByCategory: densitesParCategorie,
            categories: allCategories,
            allCategories,
            topCategories: [],
            specialtyUniqueCounts: meta.specialty_unique_counts || {},
            activeCategoryKey: allCategories[0]?.key || null,
            mapDisplayMode: 'density',
            mapOfferVariant: 'raw',
            gravityColumns: uniqueGravityColumns,
            sfcaColumns: uniqueSfcaColumns,
            gravitySelection: {
                method: 'grav',
                accessType: 'spatial_local',
                betaKey: 'b010',
                radiusKey: 'r15km',
                offerVariant: 'raw',
            },
            coverageScoreByCode: {},
            breaksByCategory,
            labelsByCategory,
            jenksClassesByCategory,
            jenksLabelsByCategory,
            minMaxByCategory,
            isLoaded: true,
        };

        const previous = this._snapshotState();
        const previousDataset = this.activeDataset;
        this.activeDataset = datasetKey;
        this._applyState(state);
        const allAccessColumns = [...this.gravityColumns, ...this.sfcaColumns];
        if (!allAccessColumns.includes(this.getSelectedGravityColumnKey())) {
            const fallback = this.parseGravityColumn(this.gravityColumns[0]) || this.parseSfcaColumn(this.sfcaColumns[0]);
            if (fallback) {
                this.gravitySelection = {
                    method: fallback.method,
                    accessType: fallback.accessType,
                    betaKey: fallback.betaKey,
                    radiusKey: fallback.radiusKey,
                    offerVariant: fallback.offerVariant || 'raw',
                };
            }
        }
        state.topCategories = this.computeTopCategories(10);
        state.coverageScoreByCode = Object.fromEntries(
            this.getCoverageScoresAll().map(r => [this.normalizeCode(r.code_commune), r])
        );
        state.gravitySelection = { ...this.gravitySelection };
        this._applyState(previous);
        this.activeDataset = previousDataset;

        this.datasets[datasetKey] = state;
        // Toujours calculer les aggregationMaps pour le dataset chargé,
        // quel que soit le dataset actif au moment du chargement.
        {
            const savedActive = this.activeDataset;
            const savedSnapshot = this._snapshotState();
            this.activeDataset = datasetKey;
            this._applyState(state);
            this.computeAggregationMaps();
            this.datasets[datasetKey].aggregationMaps = this.aggregationMaps;
            // Restaurer le dataset actif précédent si ce n'est pas celui qu'on vient de charger
            if (savedActive !== datasetKey && this.datasets[savedActive]) {
                this.activeDataset = savedActive;
                this._applyState(savedSnapshot);
            }
        }
    },

    loadTensionsData(tensionPayload) {
        const payload = tensionPayload || {};
        const scenarios = payload?.scenarios || {};
        this.tensionMeta = payload?.meta || {};
        this.tensionScenarioMaps = {};
        this.tensionScenarioRowsByCode = {};
        this.tensionAvailableLevels = [];

        for (const [scenarioKey, scenarioObj] of Object.entries(scenarios)) {
            const rawData = scenarioObj?.data || {};
            const rows = Array.isArray(rawData) ? rawData : Object.values(rawData);
            if (!rows.length) continue;

            const rowsByCode = {};
            for (const row of rows) {
                const code = this.normalizeCode(row?.code_commune);
                if (!code) continue;
                rowsByCode[code] = row;
            }

            this.tensionScenarioRowsByCode[scenarioKey] = rowsByCode;
            this.tensionScenarioMaps[scenarioKey] = this.computeAggregationMapsFromRows(rows, {
                totalDensityRaw: 'densite_professionnels_total_10000',
                totalDensityWeighted: 'densite_professionnels_total_10000_weighted',
                scoreKeys: ['score_couverture', 'score_couverture_weighted'],
            });

            const match = String(scenarioKey).match(/^remove_(\d+)$/);
            if (match) {
                const level = Number(match[1]);
                if (isFinite(level) && level > 0) this.tensionAvailableLevels.push(level);
            }
        }

        this.tensionAvailableLevels = [...new Set(this.tensionAvailableLevels)].sort((a, b) => a - b);
    },

    hasTensionsData() {
        return Object.keys(this.tensionScenarioMaps || {}).length > 0;
    },

    getTensionScenarioLevels() {
        return [...(this.tensionAvailableLevels || [])];
    },

    getTensionScenarioKeyForRemoveCount(removeCount = 1) {
        const n = Number(removeCount);
        if (!isFinite(n) || n <= 0) return 'remove_1';
        return `remove_${Math.floor(n)}`;
    },

    getTensionScenarioRowsByCode(scenarioKey) {
        return this.tensionScenarioRowsByCode?.[scenarioKey] || {};
    },

    getTensionAggregationMap(type, scenarioKey) {
        return this.tensionScenarioMaps?.[scenarioKey]?.[type] || null;
    },

    getGlobalProfessionalTotal() {
        const val = Number(this.specialtyUniqueCounts?.nb_professionnels_total);
        return isFinite(val) ? val : null;
    },

    computeTopCategories(limit = 10, useWeighted = false) {
        const result = [];
        const entries = Object.values(this.dataByKey);
        const totalKey = this.activeDataset === 'etab'
            ? 'densite_etab_total_10000'
            : 'densite_professionnels_total_10000';

        for (const cat of this.allCategories) {
            if (cat.key === totalKey) continue;
            const densityKey = useWeighted ? `${cat.key}_weighted` : cat.key;

            const vals = entries
                .map(r => Number(r?.[densityKey]))
                .filter(v => isFinite(v));
            if (!vals.length) continue;

            const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            const max = Math.max(...vals);
            result.push({ ...cat, mean, max });
        }

        return result
            .sort((a, b) => b.mean - a.mean)
            .slice(0, limit);
    },

    getTopCategories(limit = 10, useWeighted = false) {
        if (!useWeighted) {
            return this.topCategories.slice(0, limit);
        }
        return this.computeTopCategories(limit, true);
    },

    getTopCategoriesByVolume(limit = 10) {
        const rows = this.getRows();
        const result = [];
        const totalKey = this.activeDataset === 'etab'
            ? 'densite_etab_total_10000'
            : 'densite_professionnels_total_10000';

        for (const cat of this.allCategories) {
            if (cat.key === totalKey) continue;
            const countKey = cat.countKey || this.countKeyForDensityKey(cat.key);

            const stats = this.getCategoryStats(cat.key);
            const totalEffectif = Number(stats.totalEffectif) || 0;

            result.push({
                ...cat,
                totalEffectif,
                mean: stats.mean,
                coverage: stats.nonZeroRatePct,
            });
        }

        return result
            .sort((a, b) => b.totalEffectif - a.totalEffectif)
            .slice(0, limit);
    },

    getCategoryStats(categoryKey, useWeighted = false) {
        const rows = Object.values(this.dataByKey);
        const densityKey = useWeighted ? `${categoryKey}_weighted` : categoryKey;
        const countKey = this.countKeyForDensityKey(categoryKey);
        const values = rows
            .map(r => Number(r?.[densityKey]))
            .filter(v => isFinite(v));
        const uniqueCount = Number(this.specialtyUniqueCounts?.[countKey]);
        const totalEffectif = isFinite(uniqueCount)
            ? uniqueCount
            : rows.reduce((acc, r) => acc + (Number(r?.[countKey]) || 0), 0);

        if (!values.length) {
            return {
                mean: 0,
                max: 0,
                min: 0,
                nonZeroCommunes: 0,
                totalCommunes: rows.length,
                nonZeroRatePct: 0,
                totalEffectif,
            };
        }

        const nonZero = values.filter(v => v > 0).length;
        const sum = values.reduce((a, b) => a + b, 0);
        const total = values.length;
        return {
            mean: sum / total,
            max: Math.max(...values),
            min: Math.min(...values),
            nonZeroCommunes: nonZero,
            totalCommunes: total,
            nonZeroRatePct: total > 0 ? (nonZero / total) * 100 : 0,
            totalEffectif,
        };
    },

    getTopCommunesForCategory(categoryKey, limit = 10, sortBy = 'density', useWeighted = false) {
        const countKey = this.countKeyForDensityKey(categoryKey);
        const densityKey = useWeighted ? `${categoryKey}_weighted` : categoryKey;
        const rows = Object.values(this.dataByKey)
            .map(r => {
                const density = Number(r?.[densityKey]);
                return {
                    code_commune: r?.code_commune || 'N/A',
                    commune: r?.commune || 'N/A',
                    population: Number(r?.population) || 0,
                    effectif: Number(r?.[countKey]) || 0,
                    densite: isFinite(density) ? density : 0,
                };
            })
            .filter(r => (sortBy === 'volume' ? r.effectif > 0 : r.densite > 0))
            .sort((a, b) => {
                if (sortBy === 'volume') {
                    return (b.effectif - a.effectif) || (b.densite - a.densite);
                }
                return (b.densite - a.densite) || (b.effectif - a.effectif);
            });

        return rows.slice(0, limit);
    },

    getRows() {
        return Object.values(this.dataByKey);
    },

    getSpecialtyDensityKeys() {
        return this.allCategories
            .map(c => c.key)
            .filter(k => k !== 'densite_professionnels_total_10000' && k !== 'densite_etab_total_10000');
    },

    getTotalDensityKey(useWeighted = false) {
        if (this.activeDataset === 'etab') {
            return 'densite_etab_total_10000';
        }
        return useWeighted ? 'densite_professionnels_total_10000_weighted' : 'densite_professionnels_total_10000';
    },

    getTotalCountKey(useWeighted = false) {
        if (this.activeDataset === 'etab') {
            return 'nb_etab_total';
        }
        return useWeighted ? 'sum_sj' : 'nb_professionnels_total';
    },

    getDecisionStats(useWeighted = false) {
        const rows = this.getRows();
        const totalDensityKey = this.getTotalDensityKey(useWeighted);
        const totalValues = rows
            .map(r => Number(r?.[totalDensityKey]))
            .filter(v => isFinite(v));

        if (!totalValues.length) {
            return null;
        }

        const sorted = [...totalValues].sort((a, b) => a - b);
        const idx = (p) => Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
        const p10 = sorted[idx(0.10)];
        const p50 = sorted[idx(0.50)];
        const p90 = sorted[idx(0.90)];

        const communesSousP10 = rows.filter(r => Number(r?.[totalDensityKey]) <= p10).length;
        const communesZero = rows.filter(r => Number(r?.[totalDensityKey]) === 0).length;

        const coverageByPreferred = this.categories
            .filter(c => c.key !== 'densite_professionnels_total_10000' && c.key !== 'densite_etab_total_10000')
            .map(c => {
                const stats = this.getCategoryStats(c.key, useWeighted);
                return {
                    label: c.label,
                    rate: stats.nonZeroRatePct,
                    mean: stats.mean,
                };
            })
            .sort((a, b) => b.rate - a.rate);

        return {
            totalCommunes: rows.length,
            meanDensity: totalValues.reduce((a, b) => a + b, 0) / totalValues.length,
            p10,
            p50,
            p90,
            communesSousP10,
            communesZero,
            coverageByPreferred,
        };
    },

    getCoverageScoresAll(useWeighted = false) {
        const rows = this.getRows();
        if (!rows.length) return [];
        const totalDensityKey = this.getTotalDensityKey(useWeighted);
        const scoreKey = useWeighted ? 'score_couverture_weighted' : 'score_couverture';
        const diversiteKey = this.activeDataset === 'etab' ? 'diversite_etab' : 'diversite_specialites';

        const scored = rows.map(r => {
            const densite_totale = Number(r?.densite_totale ?? r?.[totalDensityKey]) || 0;
            const diversite_specialites = Number(r?.[diversiteKey]);
            const effectif_total = Number(r?.effectif_total ?? r?.[this.getTotalCountKey(useWeighted)]) || 0;
            const scoreRaw = Number(r?.[scoreKey]);
            const scoreValue = isFinite(scoreRaw) ? scoreRaw : null;
            const classe = r?.jenks_labels?.[scoreKey] || 'N/A';

            return {
                code_commune: r?.code_commune || 'N/A',
                commune: r?.commune || 'N/A',
                population: Number(r?.population) || 0,
                densite_totale,
                diversite_specialites,
                effectif_total,
                score_couverture: scoreValue,
                classe_score_couverture: classe || 'N/A',
            };
        });

        return scored
            .sort((a, b) => ((b.score_couverture ?? -Infinity) - (a.score_couverture ?? -Infinity)) || (b.densite_totale - a.densite_totale));
    },

    getCoverageScores(limit = 10, useWeighted = false) {
        return this.getCoverageScoresAll(useWeighted).slice(0, limit);
    },

    getTopDensityCommunes(limit = 10, useWeighted = false) {
        const totalKey = this.getTotalDensityKey(useWeighted);
        const countKey = this.getTotalCountKey(useWeighted);
        const rows = this.getRows()
            .map(r => {
                const densite = Number(r?.[totalKey]) || 0;
                return {
                    code_commune: r?.code_commune || 'N/A',
                    commune: r?.commune || 'N/A',
                    population: Number(r?.population) || 0,
                    densite_totale: densite,
                    effectif_total: Number(r?.[countKey]) || 0,
                    classe_densite: this.classLabelForValue(densite, totalKey),
                };
            })
            .sort((a, b) => b.densite_totale - a.densite_totale);

        return rows.slice(0, limit);
    },


    getCategories() {
        return this.categories;
    },

    getActiveCategory() {
        return this.categories.find(c => c.key === this.activeCategoryKey) || null;
    },

    setActiveCategory(categoryKey) {
        if (!this.densiteByCategory[categoryKey]) return false;
        this.activeCategoryKey = categoryKey;
        return true;
    },

    getMapDisplayMode() {
        return this.mapDisplayMode;
    },

    setMapDisplayMode(mode) {
        this.mapDisplayMode = mode === 'score'
            ? 'score'
            : (mode === 'gravity'
                ? 'gravity'
                : (mode === 'sfca' ? 'sfca' : 'density'));
        return this.mapDisplayMode;
    },

    getGravityColumns() {
        if (!this.supportsGravity()) return [];
        const keys = this.gravitySelection.method === '2sfca' ? this.sfcaColumns : this.gravityColumns;
        return keys.map(key => {
            const spec = this.parseGravityColumn(key) || this.parseSfcaColumn(key);
            return {
                key,
                ...spec,
                methodLabel: this.accessibilityMethodLabel(spec?.method),
                accessTypeLabel: this.gravityAccessTypeLabel(spec?.accessType),
                betaLabel: this.gravityBetaLabel(spec?.betaKey),
                radiusLabel: this.gravityRadiusLabel(spec?.radiusKey),
                offerVariantLabel: this.gravityOfferVariantLabel(spec?.offerVariant),
            };
        });
    },

    getGravityOptionLists() {
        if (!this.supportsGravity()) {
            return {
                methods: [],
                accessTypes: [],
                betaKeys: [],
                radiusKeys: [],
                offerVariants: [],
            };
        }
        const specs = this.getGravityColumns();
        const methods = [...new Set([...this.gravityColumns.map(() => 'grav'), ...this.sfcaColumns.map(() => '2sfca')])];
        const accessTypes = [...new Set(specs.map(s => s.accessType))];
        const betaKeys = [...new Set(specs.map(s => s.betaKey))];
        const radiusKeys = [...new Set(specs.map(s => s.radiusKey))];
        const offerVariants = [...new Set(specs.map(s => s.offerVariant || 'raw'))];
        return {
            methods,
            accessTypes,
            betaKeys,
            radiusKeys,
            offerVariants,
        };
    },

    getGravitySelection() {
        return { ...this.gravitySelection };
    },

    getSelectedGravityColumnKey() {
        if (!this.supportsGravity()) return '';
        const { method, accessType, betaKey, radiusKey, offerVariant } = this.gravitySelection;
        const suffix = offerVariant === 'weighted' ? '_weighted' : '';
        if (method === '2sfca') {
            return `acc_2sfca_${accessType}_${radiusKey}${suffix}`;
        }
        return `acc_grav_${accessType}_beta_${betaKey}_${radiusKey}${suffix}`;
    },

    setGravitySelection(next = {}) {
        if (!this.supportsGravity()) return false;
        const merged = {
            ...this.gravitySelection,
            ...next,
        };
        if (merged.method === '2sfca') {
            merged.betaKey = 'none';
        }
        if (!this.supportsWeighted()) {
            merged.offerVariant = 'raw';
        } else {
            merged.offerVariant = merged.offerVariant === 'weighted' ? 'weighted' : 'raw';
        }
        const key = merged.method === '2sfca'
            ? `acc_2sfca_${merged.accessType}_${merged.radiusKey}${merged.offerVariant === 'weighted' ? '_weighted' : ''}`
            : `acc_grav_${merged.accessType}_beta_${merged.betaKey}_${merged.radiusKey}${merged.offerVariant === 'weighted' ? '_weighted' : ''}`;
        const validCols = merged.method === '2sfca' ? this.sfcaColumns : this.gravityColumns;
        if (!validCols.includes(key)) return false;
        this.gravitySelection = merged;
        return true;
    },

    getGravitySelectionLabel() {
        if (!this.supportsGravity()) return 'N/A';
        const { method, accessType, betaKey, radiusKey, offerVariant } = this.gravitySelection;
        const methodLabel = this.accessibilityMethodLabel(method);
        const betaPart = method === '2sfca' ? '' : ` • ${this.gravityBetaLabel(betaKey)}`;
        const offerPart = ` • ${this.gravityOfferVariantLabel(offerVariant)}`;
        return `${methodLabel} • ${this.gravityAccessTypeLabel(accessType)}${betaPart} • ${this.gravityRadiusLabel(radiusKey)}${offerPart}`;
    },

    getGravityAlternateRadiusKey() {
        if (!this.supportsGravity()) return 'no_limit';
        const validCols = this.gravitySelection.method === '2sfca' ? this.sfcaColumns : this.gravityColumns;
        if (this.gravitySelection.radiusKey === 'no_limit') {
            if (validCols.some(c => c.includes('_r30km'))) return 'r30km';
            if (validCols.some(c => c.includes('_r15km'))) return 'r15km';
            return 'no_limit';
        }

        if (this.gravitySelection.method === '2sfca') {
            const sfcaRadii = [...new Set(
                validCols
                    .map(c => this.parseSfcaColumn(c)?.radiusKey)
                    .filter(Boolean)
            )];
            const current = this.gravitySelection.radiusKey;
            const alt = sfcaRadii.find(r => r !== current);
            return alt || current;
        }

        if (validCols.some(c => c.endsWith('_no_limit'))) return 'no_limit';
        return this.gravitySelection.radiusKey === 'r30km' ? 'r15km' : 'r30km';
    },

    getGravityComparisonSummary() {
        if (!this.supportsGravity()) return null;
        const rows = this.getRows();
        if (!rows.length) return null;

        const selectedKey = this.getSelectedGravityColumnKey();
        const altRadius = this.getGravityAlternateRadiusKey();
        const altKey = this.gravitySelection.method === '2sfca'
            ? `acc_2sfca_${this.gravitySelection.accessType}_${altRadius}${this.gravitySelection.offerVariant === 'weighted' ? '_weighted' : ''}`
            : `acc_grav_${this.gravitySelection.accessType}_beta_${this.gravitySelection.betaKey}_${altRadius}${this.gravitySelection.offerVariant === 'weighted' ? '_weighted' : ''}`;
        const current = rows.map(r => Number(r?.[selectedKey])).filter(v => isFinite(v));
        const alt = rows.map(r => Number(r?.[altKey])).filter(v => isFinite(v));
        if (!current.length || current.length !== alt.length) return null;

        const diffs = current.map((v, i) => Math.abs(v - alt[i]));
        const changed = diffs.filter(d => d > 1e-9).length;
        const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

        return {
            selectedRadius: this.gravitySelection.radiusKey,
            alternateRadius: this.getGravityAlternateRadiusKey(),
            selectedMean: mean(current),
            alternateMean: mean(alt),
            changedCommunes: changed,
            maxDiff: Math.max(...diffs),
        };
    },

    gravityValueForFeature(feature) {
        if (!this.supportsGravity()) return NaN;
        const detail = this.detailForFeature(feature);
        const key = this.getSelectedGravityColumnKey();
        return Number(detail?.[key]);
    },

    getGravityRows(limit = 10) {
        if (!this.supportsGravity()) return [];
        const key = this.getSelectedGravityColumnKey();
        const rows = this.getRows()
            .map(r => ({
                code_commune: r?.code_commune || 'N/A',
                commune: r?.commune || 'N/A',
                population: Number(r?.population) || 0,
                gravity_value: Number(r?.[key]),
            }))
            .filter(r => isFinite(r.gravity_value))
            .sort((a, b) => b.gravity_value - a.gravity_value)
            .map(r => ({
                ...r,
                gravity_class: this.classLabelForValue(r.gravity_value, key),
            }));

        return rows.slice(0, limit);
    },

    breaksForCategory(categoryKey = this.activeCategoryKey) {
        return this.breaksByCategory[categoryKey] || [];
    },

    labelsForCategory(categoryKey = this.activeCategoryKey) {
        return this.labelsByCategory[categoryKey] || [];
    },

    classLabelForValue(value, categoryKey = this.activeCategoryKey) {
        const labels = this.labelsForCategory(categoryKey);
        const breaks = this.breaksForCategory(categoryKey);
        if (!isFinite(Number(value))) return 'N/A';

        const v = Number(value);
        if (v === 0) return this.zeroClassLabel;
        const normValue = this.normalizeValueForCategory(v, categoryKey);
        return this.labelForNormalizedValue(normValue, categoryKey);
    },

    valueForFeature(feature, categoryKey = this.activeCategoryKey, useWeighted = false) {
        const suffix = useWeighted ? '_weighted' : '';
        const key = `${categoryKey}${suffix}`;
        const byKey = this.densiteByCategory[key] || this.densiteByCategory[categoryKey] || {};
        const props = feature?.properties || {};
        const code = this.normalizeCode(props.code || props.code_commune || props.insee || props.insee_com);
        return byKey[code];
    },
    /* Leaflet parcourt chaque feature communal du GeoJSON*/
    detailForFeature(feature) {
        const props = feature?.properties || {};
        /* Pour chaque commune, le code récupère son identifiant dans les propriétés GeoJSON*/
        const code = this.normalizeCode(props.code || props.code_commune || props.insee || props.insee_com);
        /* Puis il cherche les indicateurs correspondants à ce code*/
        return this.dataByKey[code] || null;
    },

    scoreRowForFeature(feature, useWeighted = false) {
        const props = feature?.properties || {};
        const code = this.normalizeCode(props.code || props.code_commune || props.insee || props.insee_com);
        const detail = this.dataByKey[code];
        if (!detail) return null;

        const scoreKey = useWeighted ? 'score_couverture_weighted' : 'score_couverture';
        const diversiteKey = this.activeDataset === 'etab' ? 'diversite_etab' : 'diversite_specialites';
        const totalDensityKey = this.getTotalDensityKey(useWeighted);
        const countKey = this.getTotalCountKey(useWeighted);

        return {
            code_commune: detail?.code_commune,
            commune: detail?.commune,
            population: Number(detail?.population) || 0,
            densite_totale: Number(detail?.[totalDensityKey]) || 0,
            diversite_specialites: Number(detail?.[diversiteKey]) || 0,
            effectif_total: Number(detail?.[countKey]) || 0,
            score_couverture: Number(detail?.[scoreKey]) || 0,
            classe_score_couverture: detail?.jenks_labels?.[scoreKey] || 'N/A',
        };
    },

    scoreClassLabel(score) {
        return this.classLabelForValue(score, 'score_couverture');
    },

    scoreClassIndex(score) {
        if (!isFinite(score) || score <= 0) return 0;
        const normValue = this.normalizeValueForCategory(score, 'score_couverture');
        return this.getJenksClassIndex(normValue, this.breaksForCategory('score_couverture')) + 1;
    },

    scoreClassColors() {
        const n = (this.breaksForCategory('score_couverture').length || 4) + 1;
        return [this.zeroClassColor, ...COLORS_JENKS.slice(0, n)];
    },

    scoreClassLabels() {
        const rawLabels = this.labelsForCategory('score_couverture');
        const n = rawLabels.length || 4;
        return [
            this.zeroClassLabel,
            ...rawLabels.map((lbl, i) => this.jenksClassDecoratedLabel(i, lbl, n)),
        ];
    },

    getScoreColor(score) {
        return this.getColor(score, 'score_couverture');
    },

    getColor(value, categoryKey = this.activeCategoryKey) {
        const breaks = this.breaksForCategory(categoryKey);
        if (value === undefined || value === null || isNaN(value)) return '#cccccc';
        if (Number(value) === 0) return this.zeroClassColor;
        const normValue = this.normalizeValueForCategory(Number(value), categoryKey);
        for (let i = 0; i < breaks.length; i++) {
            if (normValue <= breaks[i]) return COLORS_JENKS[i];
        }
        return COLORS_JENKS[breaks.length] || COLORS_JENKS[COLORS_JENKS.length - 1];
    },

    /* Couleur Jenks pour une valeur déjà normalisée [0-100] avec breaks ad-hoc */
    getColorFromNorm100(normValue, breaks) {
        if (!isFinite(normValue)) return '#cccccc';
        if (normValue === 0) return this.zeroClassColor;
        for (let i = 0; i < breaks.length; i++) {
            if (normValue <= breaks[i]) return COLORS_JENKS[i];
        }
        return COLORS_JENKS[breaks.length] || COLORS_JENKS[COLORS_JENKS.length - 1];
    },

    computeAggregationMapsFromRows(rows, options = {}) {
        const safeRows = Array.isArray(rows) ? rows : [];
        if (!safeRows.length) return {};

        const allKeys = new Set();
        for (const row of safeRows) {
            for (const key of Object.keys(row || {})) {
                allKeys.add(key);
            }
        }

        // Moyenne des valeurs brutes d'un ensemble de colonnes par commune (valeurs > 0)
        const avgAcrossCols = (cols) => {
            const result = {};
            for (const row of safeRows) {
                const code = this.normalizeCode(row?.code_commune);
                if (!code) continue;
                const vals = cols.map(c => Number(row?.[c])).filter(v => isFinite(v) && v > 0);
                if (vals.length) result[code] = vals.reduce((a, b) => a + b, 0) / vals.length;
            }
            return result;
        };

        // Pour gravity et sfca : diviser par le nombre TOTAL de colonnes (y compris les zeros).
        // Evite l'artefact : retirer une colonne a faible valeur reduit le denominateur
        // et fait monter la moyenne meme si l'acces reel a baisse.
        const avgAcrossColsAll = (cols) => {
            if (!cols.length) return {};
            const result = {};
            for (const row of safeRows) {
                const code = this.normalizeCode(row?.code_commune);
                if (!code) continue;
                const sum = cols.reduce((acc, c) => {
                    const v = Number(row?.[c]);
                    return acc + (isFinite(v) && v >= 0 ? v : 0);
                }, 0);
                result[code] = sum / cols.length;
            }
            return result;
        };

        // Min-max normalisation vers [0, scale]
        const normalize = (map, scale = 100) => {
            const vals = Object.values(map).filter(v => isFinite(v));
            if (!vals.length) return {};
            const mn = Math.min(...vals);
            const mx = Math.max(...vals);
            const result = {};
            for (const [code, v] of Object.entries(map)) {
                result[code] = mx === mn ? 0 : ((v - mn) / (mx - mn)) * scale;
            }
            return result;
        };

        // Calcul Jenks sur les valeurs normees [0-100]
        const buildJenks = (norm100Map) => {
            const vals = Object.values(norm100Map).filter(v => isFinite(v) && v > 0);
            return this.computeBreaksAndLabels(vals, false);
        };

        const totalDensityRaw = options.totalDensityRaw || 'densite_professionnels_total_10000';
        const totalDensityWeighted = options.totalDensityWeighted || 'densite_professionnels_total_10000_weighted';
        const densityCandidates = [totalDensityRaw, totalDensityWeighted];
        const densityCols = [...new Set(densityCandidates)].filter(
            k => allKeys.has(k) && safeRows.some(r => isFinite(Number(r?.[k])) && Number(r?.[k]) > 0)
        );

        const scoreCandidates = options.scoreKeys || ['score_couverture', 'score_couverture_weighted'];
        const scoreCols = [...new Set(scoreCandidates)].filter(
            k => allKeys.has(k) && safeRows.some(r => isFinite(Number(r?.[k])) && Number(r?.[k]) > 0)
        );

        const gravityCols = (options.gravityColumns && options.gravityColumns.length)
            ? [...options.gravityColumns]
            : [...allKeys].filter(k => this.parseGravityColumn(k));
        const sfcaCols = (options.sfcaColumns && options.sfcaColumns.length)
            ? [...options.sfcaColumns]
            : [...allKeys].filter(k => this.parseSfcaColumn(k));

        const families = {
            density: densityCols,
            score: scoreCols,
            gravity: [...new Set(gravityCols)],
            sfca: [...new Set(sfcaCols)],
        };

        const aggregations = {};
        const norm01Maps = {};

        for (const [type, cols] of Object.entries(families)) {
            if (!cols.length) continue;
            const avgMap = (type === 'gravity' || type === 'sfca')
                ? avgAcrossColsAll(cols)
                : avgAcrossCols(cols);
            if (!Object.keys(avgMap).length) continue;
            const norm01 = normalize(avgMap, 1);
            const norm100 = normalize(avgMap, 100);
            const { breaks, labels } = buildJenks(norm100);
            aggregations[type] = { norm100Map: norm100, breaks, labels };
            norm01Maps[type] = norm01;
        }

        // Carte globale : moyenne des [0-1] normalises par indicateur, puis x100
        const allCodes = new Set(safeRows.map(r => this.normalizeCode(r?.code_commune)).filter(Boolean));
        const globalAvgMap = {};
        for (const code of allCodes) {
            const vals = Object.values(norm01Maps).map(m => m[code]).filter(v => isFinite(v));
            if (vals.length) globalAvgMap[code] = (vals.reduce((a, b) => a + b, 0) / vals.length) * 100;
        }
        if (Object.keys(globalAvgMap).length) {
            const globalNorm100 = normalize(globalAvgMap, 100);
            const { breaks: gBreaks, labels: gLabels } = buildJenks(globalNorm100);
            aggregations.global = { norm100Map: globalNorm100, breaks: gBreaks, labels: gLabels };
        }

        return aggregations;
    },

    /* Calcule les 5 cartes d'agrégation (density / score / gravity / sfca / global) */
    computeAggregationMaps() {
        const rows = Object.values(this.dataByKey);
        this.aggregationMaps = this.computeAggregationMapsFromRows(rows, {
            totalDensityRaw: this.getTotalDensityKey(false),
            totalDensityWeighted: this.getTotalDensityKey(true),
            scoreKeys: ['score_couverture', 'score_couverture_weighted'],
            gravityColumns: [...this.gravityColumns],
            sfcaColumns: [...this.sfcaColumns],
        });
    },
};

window.SanteModel = SanteModel;
