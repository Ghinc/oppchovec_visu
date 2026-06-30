/**
 * Vue cartographique Santé Corse
 *
 * Responsabilité : rendre la carte Santé, légende et popups.
 */
const SanteMapView = {
    buildLegendControl(category, mode, useWeighted = false) {
        const isScoreMode = mode === 'score';
        const isGravityMode = mode === 'gravity' || mode === 'sfca';
        const scoreKey = useWeighted ? 'score_couverture_weighted' : 'score_couverture';
        const categoryKey = isScoreMode
            ? scoreKey
            : (isGravityMode
                ? SanteModel.getSelectedGravityColumnKey()
                : (useWeighted && category?.key ? `${category.key}_weighted` : category?.key));
        /*  Legende Jenks (labels + couleurs)*/
        const breaks = SanteModel.breaksForCategory(categoryKey);
        const labels = SanteModel.labelsForCategory(categoryKey);
        const gravityKey = SanteModel.getSelectedGravityColumnKey();
        const gravityBreaks = SanteModel.breaksForCategory(gravityKey);
        const gravityLabels = SanteModel.labelsForCategory(gravityKey);

        const control = L.control({ position: 'bottomright' });
        control.onAdd = function () {
            const div = L.DomUtil.create('div', 'info legend');
            if (isScoreMode) {
                const weightedLabel = useWeighted ? ' (offre pondérée)' : '';
                div.innerHTML = `<strong>Score couverture${weightedLabel}</strong><br><small style="color:#666;">Échelle 0–100 (Jenks)</small><br><br>`;
                div.innerHTML += `<i style="background:${SanteModel.zeroClassColor};width:18px;height:18px;display:inline-block;margin-right:5px;"></i>${SanteModel.zeroClassLabel}<br>`;
                const classCount = labels.length || (breaks.length ? breaks.length + 1 : 0);
                for (let i = 0; i < classCount; i++) {
                    const interval = labels[i] || `Classe ${i + 1}`;
                    const texte = SanteModel.jenksClassDecoratedLabel(i, interval, classCount || COLORS_JENKS.length);
                    div.innerHTML += `<i style="background:${COLORS_JENKS[i]};width:18px;height:18px;display:inline-block;margin-right:5px;"></i>${texte}<br>`;
                }
            } else if (isGravityMode) {
                const gravSel = SanteModel.getGravitySelection();
                const methodLabel = SanteModel.accessibilityMethodLabel(gravSel.method);
                const offerLabel = gravSel.offerVariant === 'weighted' ? ' — offre pondérée' : ' — offre brute';
                div.innerHTML = `<strong>Accessibilité spatiale — ${methodLabel}${offerLabel}</strong><br><small style="color:#666;">Échelle 0–100 (Jenks)</small><br><br>`;
                div.innerHTML += `<i style="background:${SanteModel.zeroClassColor};width:18px;height:18px;display:inline-block;margin-right:5px;"></i>${SanteModel.zeroClassLabel}<br>`;
                const classCount = gravityLabels.length || (gravityBreaks.length ? gravityBreaks.length + 1 : 0);
                for (let i = 0; i < classCount; i++) {
                    const interval = gravityLabels[i] || `Classe ${i + 1}`;
                    const texte = SanteModel.jenksClassDecoratedLabel(i, interval, classCount || COLORS_JENKS.length);
                    div.innerHTML += `<i style="background:${COLORS_JENKS[i]};width:18px;height:18px;display:inline-block;margin-right:5px;"></i>${texte}<br>`;
                }
            } else {
                let title = category?.label || 'Catégorie';
                if (category?.key === 'densite_professionnels_total_10000') {
                    title = 'Densité médicale';
                }
                div.innerHTML = `<strong>${title}</strong><br><small style="color:#666;">Échelle 0–100 (Jenks)</small><br><br>`;
                div.innerHTML += `<i style="background:${SanteModel.zeroClassColor};width:18px;height:18px;display:inline-block;margin-right:5px;"></i>${SanteModel.zeroClassLabel}<br>`;
                const classCount = labels.length || (breaks.length ? breaks.length + 1 : 0);
                for (let i = 0; i < classCount; i++) {
                    const interval = labels[i] || `Classe ${i + 1}`;
                    const texte = SanteModel.jenksClassDecoratedLabel(i, interval, classCount || COLORS_JENKS.length);
                    div.innerHTML += `<i style="background:${COLORS_JENKS[i]};width:18px;height:18px;display:inline-block;margin-right:5px;"></i>${texte}<br>`;
                }
            }
            return div;
        };
        return control;
    },

    afficherCarte() {
        if (!SanteModel.isLoaded || !AppState.communeJson) return;
        const category = SanteModel.getActiveCategory();
        const mode = SanteModel.getMapDisplayMode();
        const isScoreMode = mode === 'score';
        const isGravityMode = mode === 'gravity' || mode === 'sfca';
        const isDensityMode = mode === 'density';
        const selectedVariant = window.SanteController?.getCurrentMapOfferVariant?.() || SanteModel.mapOfferVariant || 'raw';
        const useWeighted = selectedVariant === 'weighted';
        const gravityKey = SanteModel.getSelectedGravityColumnKey();
        const densityKey = isDensityMode && useWeighted && category?.key ? `${category.key}_weighted` : category?.key;

        const carte = initMap('map-sante', 'sante');

        if (AppState.geojsonLayers['sante']) {
            carte.removeLayer(AppState.geojsonLayers['sante']);
        }
        if (AppState.legendControls['sante']) {
            carte.removeControl(AppState.legendControls['sante']);
        }

        AppState.geojsonLayers['sante'] = L.geoJSON(AppState.communeJson, {
            style: (feature) => {
                const value = isScoreMode
                    ? SanteModel.scoreRowForFeature(feature, useWeighted)?.score_couverture
                    : (isGravityMode
                        ? SanteModel.gravityValueForFeature(feature)
                        : SanteModel.valueForFeature(feature, densityKey, useWeighted));
                return {
                    /*  Couleur de la commune selon la classe Jenks*/
                    fillColor: isScoreMode
                        ? SanteModel.getColor(value, useWeighted ? 'score_couverture_weighted' : 'score_couverture')
                        : SanteModel.getColor(value, isGravityMode ? gravityKey : densityKey),
                    color: '#000000',
                    weight: 1,
                    fillOpacity: 0.7,
                };
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties || {};
                const nom = props.nom || '?';
                const detail = SanteModel.detailForFeature(feature);

                if (isScoreMode) {
                    const scoreRow = SanteModel.scoreRowForFeature(feature, useWeighted);
                    const scoreKey = useWeighted ? 'score_couverture_weighted' : 'score_couverture';
                    const scoreRaw = scoreRow ? Number(scoreRow.score_couverture) : null;
                    const scoreNorm = isFinite(scoreRaw)
                        ? SanteModel.normalizeValueForCategory(scoreRaw, scoreKey)
                        : null;
                    layer.bindPopup(
                        `<strong>${nom}</strong><br>` +
                        `Score brut : ${scoreRaw !== null ? scoreRaw.toFixed(3) : 'N/A'} / 1<br>` +
                        `Score normalisé : ${scoreNorm !== null ? scoreNorm.toFixed(1) : 'N/A'} / 100<br>` +
                        `Classe : ${scoreRow?.classe_score_couverture || 'N/A'}<br>` +
                        `Densité totale : ${scoreRow ? Number(scoreRow.densite_totale).toFixed(2) : 'N/A'} / 10 000 hab.<br>` +
                        `Population : ${scoreRow?.population ?? 'N/A'}<br>` +
                        `Diversité : ${scoreRow?.diversite_specialites ?? 'N/A'}<br>` +
                        `Offre totale : ${scoreRow?.effectif_total ?? 'N/A'}`
                    );
                } else if (isGravityMode) {
                    const value = SanteModel.gravityValueForFeature(feature);
                    /*Affichage “Classe Jenks” dans les popups */
                    const classe = SanteModel.classLabelForValue(value, gravityKey);
                    const normalized = SanteModel.normalizeValueForCategory(value, gravityKey);
                    const gravSel = SanteModel.getGravitySelection();
                    const nbProsGrav = gravSel.offerVariant === 'weighted'
                        ? (Number(detail?.sum_sj) || 0).toFixed(2)
                        : (detail?.nb_professionnels_total ?? 'N/A');
                    const offerLabelGrav = gravSel.offerVariant === 'weighted' ? ' (pondérée)' : '';
                    layer.bindPopup(
                        `<strong>${nom}</strong><br>` +
                        `Valeur brute : ${isFinite(value) ? Number(value).toFixed(4) : 'N/A'}<br>` +
                        `Valeur normalisée : ${isFinite(normalized) ? Number(normalized).toFixed(2) : 'N/A'} / 100<br>` +
                        `Classe Jenks : ${classe || 'N/A'}<br>` +
                        `Offre${offerLabelGrav} : ${nbProsGrav}<br>` +
                        `Population : ${detail?.population ?? 'N/A'}`
                    );
                } else if (isDensityMode) {
                    const densite = SanteModel.valueForFeature(feature, densityKey, useWeighted);
                    const nbPro = useWeighted ? Number(detail?.sum_sj) || 0 : Number(detail?.[category?.countKey]);
                    const pop = detail?.population;
                    /*Affichage “Classe Jenks” dans les popupsoui */
                    const classe = SanteModel.classLabelForValue(densite, densityKey);

                    layer.bindPopup(
                        `<strong>${nom}</strong><br>` +
                        `Catégorie : ${category?.label || 'N/A'}<br>` +
                        `Densité : ${densite !== undefined ? Number(densite).toFixed(2) : 'N/A'} / 10 000 hab. ${useWeighted ? '(pondérée)' : ''}<br>` +
                        `Offre : ${nbPro !== undefined ? nbPro : 'N/A'}<br>` +
                        `Population : ${pop !== undefined ? pop : 'N/A'}<br>` +
                        `Classe Jenks : ${classe || 'N/A'}`
                    );
                } else {
                    const densite = detail?.[category?.key];
                    const nbPro = detail?.[category?.countKey];
                    const pop = detail?.population;
                    const classe = SanteModel.classLabelForValue(densite, category?.key);

                    layer.bindPopup(
                        `<strong>${nom}</strong><br>` +
                        `Catégorie : ${category?.label || 'N/A'}<br>` +
                        `Densité : ${densite !== undefined ? Number(densite).toFixed(2) : 'N/A'} / 10 000 hab.<br>` +
                        `Offre : ${nbPro !== undefined ? nbPro : 'N/A'}<br>` +
                        `Population : ${pop !== undefined ? pop : 'N/A'}<br>` +
                        `Classe Jenks : ${classe || 'N/A'}`
                    );
                }
            },
        }).addTo(carte);

        const bounds = AppState.geojsonLayers['sante'].getBounds();
        if (bounds.isValid()) carte.fitBounds(bounds, { padding: [10, 10] });

        AppState.legendControls['sante'] = this.buildLegendControl(category, mode, useWeighted);
        AppState.legendControls['sante'].addTo(carte);

        setTimeout(() => carte.invalidateSize(), 100);
    },

    aggregationTypeLabel(type) {
        const typeLabels = {
            density: 'Densité agrégée',
            score: 'Score agrégé',
            gravity: 'Accessibilité gravitaire agrégée',
            sfca: 'Accessibilité 2SFCA agrégée',
            global: 'Agrégation globale',
        };
        return typeLabels[type] || String(type || 'Agrégation');
    },

    buildAggregationLegendControl(titleLabel, breaks, labels) {
        const legendControl = L.control({ position: 'bottomright' });
        legendControl.onAdd = function () {
            const div = L.DomUtil.create('div', 'info legend legend-compact legend-collapsible');
            const classCount = labels.length || (breaks.length ? breaks.length + 1 : 0);

            let rowsHtml = `<div class="legend-row"><i style="background:${SanteModel.zeroClassColor};"></i><span>${SanteModel.zeroClassLabel}</span></div>`;
            for (let i = 0; i < classCount; i++) {
                const interval = labels[i] || `Classe ${i + 1}`;
                const texte = SanteModel.jenksClassDecoratedLabel(i, interval, classCount || COLORS_JENKS.length);
                rowsHtml += `<div class="legend-row"><i style="background:${COLORS_JENKS[i]};"></i><span>${texte}</span></div>`;
            }

            div.innerHTML =
                `<div class="legend-head">` +
                `<strong>${titleLabel}</strong>` +
                `<button type="button" class="legend-toggle" title="Replier / déplier">▾</button>` +
                `</div>` +
                `<div class="legend-sub">Échelle 0–100 (Jenks)</div>` +
                `<div class="legend-body">${rowsHtml}</div>`;

            const toggle = div.querySelector('.legend-toggle');
            const body = div.querySelector('.legend-body');
            let collapsed = false;
            if (toggle && body) {
                toggle.addEventListener('click', () => {
                    collapsed = !collapsed;
                    body.style.display = collapsed ? 'none' : 'block';
                    div.classList.toggle('is-collapsed', collapsed);
                    toggle.textContent = collapsed ? '▸' : '▾';
                });
            }

            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            return div;
        };
        return legendControl;
    },

    _rawValueLabel(mapType) {
        if (mapType === 'sante-tension-reference' || mapType === 'sante-aggregation') {
            const type = this._lastTensionType || '';
            if (type === 'density') return 'Densité agrégée (pros / 10k hab.)';
            if (type === 'score')   return 'Score composite [0–1]';
            if (type === 'gravity') return 'Accessibilité gravitaire agrégée (brut)';
            if (type === 'sfca')    return 'Accessibilité 2SFCA agrégée (brut)';
            if (type === 'global')  return 'Score global composite [0–100]';
        }
        if (mapType === 'sante-tension-reduced') {
            const type = this._lastTensionType || '';
            if (type === 'density') return 'Densité réduite (pros / 10k hab.)';
            if (type === 'score')   return 'Score composite réduit [0–1]';
            if (type === 'gravity') return 'Accessibilité gravitaire réduite (brut)';
            if (type === 'sfca')    return 'Accessibilité 2SFCA réduite (brut)';
            if (type === 'global')  return 'Score global composite réduit [0–100]';
        }
        return 'Valeur brute';
    },

    renderAggregationMap({
        mapId,
        mapType,
        aggData,
        titleLabel,
        rowsByCode,
        showComparisonWith,
        rawValueByCode,
        referenceRawByCode,
        indicatorType,
    }) {
        if (!aggData || !AppState.communeJson) return;

        const { norm100Map, breaks, labels } = aggData;
        const carte = initMap(mapId, mapType);

        if (AppState.geojsonLayers[mapType]) {
            carte.removeLayer(AppState.geojsonLayers[mapType]);
        }
        if (AppState.legendControls[mapType]) {
            carte.removeControl(AppState.legendControls[mapType]);
        }

        const legendControl = this.buildAggregationLegendControl(titleLabel, breaks, labels);

        const layer = L.geoJSON(AppState.communeJson, {
            style: (feature) => {
                const code = SanteModel.normalizeCode(
                    feature?.properties?.code_commune || feature?.properties?.code
                );
                const value = norm100Map[code];
                const rawValStyle = Number(rawValueByCode?.[code]);
                // Classe 0 (gris) seulement si offre reellement nulle (rawVal = 0)
                // Les communes avec rawVal > 0 mais norm faible restent en classe Jenks 1
                const isZeroClass = !isFinite(rawValStyle) || rawValStyle === 0;
                if (isZeroClass) {
                    return { fillColor: SanteModel.zeroClassColor, weight: 1, color: '#000000', fillOpacity: 0.7 };
                }
                return {
                    // Si rawVal > 0 mais norm = 0 (commune minimum), on force la classe 1 (0.001)
                    // pour eviter que getColorFromNorm100 retourne zeroClassColor pour value=0
                    fillColor: SanteModel.getColorFromNorm100(value > 0 ? value : 0.001, breaks),
                    weight: 1,
                    color: '#000000',
                    fillOpacity: 0.7,
                };
            },
            onEachFeature: (feature, lyr) => {
                const code = SanteModel.normalizeCode(
                    feature?.properties?.code_commune || feature?.properties?.code
                );
                const value = norm100Map[code];
                const commune = feature?.properties?.nom || feature?.properties?.nom_commune || code;
                const rawVal = Number(rawValueByCode?.[code]);
                // Meme critere que pour la couleur : rawVal = 0 → classe zero
                const isZeroDisplay = !isFinite(rawVal) || rawVal === 0;
                // Si classe 0, forcer displayVal = '0' pour rester coherent avec la couleur grise
                const displayVal = isZeroDisplay
                    ? '0'
                    : (isFinite(value)
                        ? (value < 0.1 ? value.toFixed(3) : value.toFixed(1))
                        : 'N/A');
                const rawLabel = indicatorType === 'global'
                    ? 'Agrégation brute'
                    : (indicatorType === 'score'
                        ? 'Score brut'
                        : (indicatorType === 'density'
                            ? 'Densité brute'
                            : (indicatorType === 'gravity'
                                ? 'Accessibilité gravitaire brute'
                                : (indicatorType === 'sfca'
                                    ? 'Accessibilité 2SFCA brute'
                                    : 'Valeur agrégée brute'))));
                const classCount = labels.length || (breaks.length ? breaks.length + 1 : 0);
                const classIdx = !isZeroDisplay
                    ? SanteModel.getJenksClassIndex(value, breaks) - 1
                    : -1;
                const classLabel = classIdx >= 0
                    ? SanteModel.jenksClassDecoratedLabel(classIdx, labels[classIdx] || '', classCount)
                    : SanteModel.zeroClassLabel;

                const row = rowsByCode?.[code] || null;
                const population = row?.population != null ? Number(row.population).toLocaleString('fr-FR') : 'N/A';
                const countKey = SanteModel.getTotalCountKey(false);
                const nbPros = row?.[countKey] != null ? Number(row[countKey]).toLocaleString('fr-FR') : 'N/A';
                const diversiteKey = SanteModel.activeDataset === 'etab' ? 'diversite_etab' : 'diversite_specialites';
                const diversite = row?.[diversiteKey] != null ? row[diversiteKey] : 'N/A';
                const diversiteLabel = SanteModel.activeDataset === 'etab' ? 'Diversité (types)' : 'Diversité (spécialités)';
                const offreLabel = SanteModel.activeDataset === 'etab' ? 'Établissements' : 'Professionnels';

                let compareHtml = '';
                if (referenceRawByCode && isFinite(referenceRawByCode[code]) && isFinite(rawVal)) {
                                        const referenceNormVal = showComparisonWith && isFinite(showComparisonWith[code])
                                                ? Number(showComparisonWith[code])
                                                : NaN;
                    const deltaAbs = rawVal - Number(referenceRawByCode[code]);
                    const deltaPct = Number(referenceRawByCode[code]) > 0
                        ? (deltaAbs / Number(referenceRawByCode[code])) * 100
                        : NaN;
                    const signAbs = deltaAbs >= 0 ? '+' : '';
                    const signPct = isFinite(deltaPct) && deltaPct >= 0 ? '+' : '';
                                        const refLine = indicatorType === 'global'
                                                ? `Référence brute (moyenne) : <strong>${Number(referenceRawByCode[code]).toFixed(4)}</strong><br>` +
                                                    `Référence normalisée : <strong>${isFinite(referenceNormVal) ? referenceNormVal.toFixed(1) : 'N/A'} / 100</strong><br>`
                                                : `Référence brute : <strong>${Number(referenceRawByCode[code]).toFixed(4)}</strong><br>` +
                                                    `Référence normalisée : <strong>${isFinite(referenceNormVal) ? referenceNormVal.toFixed(1) : 'N/A'} / 100</strong><br>`;
                                        compareHtml = refLine +
                                                `Delta brut vs référence : <strong>${signAbs}${deltaAbs.toFixed(4)}</strong><br>` +
                        `Delta % vs référence : <strong>${isFinite(deltaPct) ? `${signPct}${deltaPct.toFixed(1)}%` : 'N/A'}</strong><br>`;
                } else if (showComparisonWith && isFinite(showComparisonWith[code]) && isFinite(value)) {
                    const delta = value - Number(showComparisonWith[code]);
                    const sign = delta >= 0 ? '+' : '';
                    compareHtml = `Δ index (normalisé) vs référence : <strong>${sign}${delta.toFixed(1)}</strong><br>`;
                }

                const popupMainHtml = `${titleLabel} : <strong>${displayVal} / 100</strong><br>` +
                    `${rawLabel} : <strong>${isFinite(rawVal) ? rawVal.toFixed(6) : 'N/A'}</strong><br>`;

                lyr.bindPopup(
                    `<strong>${commune}</strong><br>` +
                                        `${popupMainHtml}` +
                    `${compareHtml}` +
                    `Classe Jenks : ${classLabel}<br>` +
                    `<hr style="margin:4px 0;">` +
                    `Population : ${population}<br>` +
                    `${offreLabel} : ${nbPros}<br>` +
                    `${diversiteLabel} : ${diversite}`
                );
                lyr.on('mouseover', function () { this.openPopup(); });
                lyr.on('mouseout', function () { this.closePopup(); });
            },
        }).addTo(carte);

        const bounds = layer.getBounds();
        if (bounds.isValid()) carte.fitBounds(bounds, { padding: [10, 10] });

        AppState.geojsonLayers[mapType] = layer;
        legendControl.addTo(carte);
        AppState.legendControls[mapType] = legendControl;

        setTimeout(() => carte.invalidateSize(), 100);
    },

    buildRawAggregationValueMap(type, rowsByCode, refRowsByCode = null) {
        const rows = Object.values(rowsByCode || {}).filter(Boolean);
        if (!rows.length) return {};

        const keys = new Set();
        rows.forEach(row => {
            Object.keys(row || {}).forEach(k => keys.add(k));
        });

        const avgAcrossCols = (cols) => {
            const result = {};
            rows.forEach(row => {
                const code = SanteModel.normalizeCode(row?.code_commune);
                if (!code) return;
                const vals = cols
                    .map(c => Number(row?.[c]))
                    .filter(v => isFinite(v) && v > 0);
                result[code] = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
            });
            return result;
        };

        // Pour gravity et sfca : diviser par le nombre TOTAL de colonnes (y compris les zeros).
        // Evite l'artefact : retirer une colonne a faible valeur reduit le denominateur
        // et fait monter la moyenne meme si l'acces reel a baisse.
        const avgAcrossColsAll = (cols) => {
            if (!cols.length) return {};
            const result = {};
            rows.forEach(row => {
                const code = SanteModel.normalizeCode(row?.code_commune);
                if (!code) return;
                const sum = cols.reduce((acc, c) => {
                    const v = Number(row?.[c]);
                    return acc + (isFinite(v) && v >= 0 ? v : 0);
                }, 0);
                result[code] = sum / cols.length;
            });
            return result;
        };

        // Normalise map vers [0,1] en utilisant les bornes min/max de refMap si fourni
        // (evite l'artefact de renormalisation lors de la comparaison reference vs reduit)
        const normalize01 = (map, refMap = null) => {
            const sourceForBounds = refMap || map;
            const values = Object.values(sourceForBounds).filter(v => isFinite(v) && v > 0);
            if (!values.length) return {};
            const min = Math.min(...values);
            const max = Math.max(...values);
            const out = {};
            Object.entries(map).forEach(([code, v]) => {
                const num = Number(v);
                if (!isFinite(num) || num <= 0 || max <= min) {
                    out[code] = 0;
                } else {
                    out[code] = Math.max(0, Math.min(1, (num - min) / (max - min)));
                }
            });
            return out;
        };

        const densityCols = [
            'densite_professionnels_total_10000',
            'densite_professionnels_total_10000_weighted',
            'densite_etab_total_10000',   // dataset établissements
        ].filter(k => keys.has(k));
        const scoreCols = ['score_couverture', 'score_couverture_weighted']
            .filter(k => keys.has(k));
        const gravityCols = [...keys].filter(k => /^acc_grav_/.test(k));
        const sfcaCols = [...keys].filter(k => /^acc_2sfca_/.test(k));

        if (type === 'density') return avgAcrossCols(densityCols);
        if (type === 'score') {
            if (!refRowsByCode) {
                // Mode affichage simple : utilise le score pre-calcule par Python
                return avgAcrossCols(scoreCols);
            }
            // Mode comparaison delta : recalcul depuis density+diversite brutes avec echelle
            // fixee sur la reference → evite l'artefact min-max independant par scenario.
            // Ex : Calenzana (2 pros meme specialite, 1 retire) ne peut pas paraitre en amelioration.
            const densityCol = 'densite_professionnels_total_10000';
            const diversityCol = SanteModel.activeDataset === 'etab' ? 'diversite_etab' : 'diversite_specialites';
            const buildRawMaps = (sourceRows) => {
                const densMap = {}, divMap = {};
                sourceRows.forEach(row => {
                    const code = SanteModel.normalizeCode(row?.code_commune);
                    if (!code) return;
                    const d = Number(row?.[densityCol]);
                    densMap[code] = isFinite(d) && d > 0 ? d : 0;
                    const v = Number(row?.[diversityCol]);
                    divMap[code] = isFinite(v) && v > 0 ? v : 0;
                });
                return { densMap, divMap };
            };
            const refRows2 = Object.values(refRowsByCode).filter(Boolean);
            const { densMap: refDensMap, divMap: refDivMap } = buildRawMaps(refRows2);
            const { densMap: redDensMap, divMap: redDivMap } = buildRawMaps(rows);
            const normDens = normalize01(redDensMap, refDensMap);
            const normDiv  = normalize01(redDivMap,  refDivMap);
            const result = {};
            const allCodes2 = new Set([...Object.keys(normDens), ...Object.keys(normDiv)]);
            allCodes2.forEach(code => {
                const d = normDens[code] ?? 0;
                const v = normDiv[code] ?? 0;
                result[code] = 0.6 * d + 0.4 * v;
            });
            return result;
        }
        if (type === 'gravity') return avgAcrossColsAll(gravityCols);
        if (type === 'sfca') return avgAcrossColsAll(sfcaCols);

        // Pour global : si refRowsByCode fourni, on calcule les moyennes de reference
        // et on utilise leurs bornes pour normaliser les donnees reduites -> comparaison sur echelle fixe
        let refAvgD = null, refAvgS = null, refAvgG = null, refAvgF = null;
        let globalRedScoreMap = null; // score recalcule depuis density+diversite (fix artefact score_couverture)
        if (refRowsByCode) {
            const refRows2 = Object.values(refRowsByCode).filter(Boolean);
            const refKeys = new Set(); refRows2.forEach(r => Object.keys(r||{}).forEach(k => refKeys.add(k)));
            const avgRef    = (cols) => { const res = {}; refRows2.forEach(row => { const c = SanteModel.normalizeCode(row?.code_commune); if (!c) return; const vs = cols.map(x => Number(row?.[x])).filter(v => isFinite(v) && v > 0); if (vs.length) res[c] = vs.reduce((a,b)=>a+b,0)/vs.length; }); return res; };
            const avgRefAll = (cols) => { if (!cols.length) return {}; const res = {}; refRows2.forEach(row => { const c = SanteModel.normalizeCode(row?.code_commune); if (!c) return; const sum = cols.reduce((acc, x) => { const v = Number(row?.[x]); return acc + (isFinite(v) && v >= 0 ? v : 0); }, 0); res[c] = sum / cols.length; }); return res; };
            const rDCols = ['densite_professionnels_total_10000','densite_professionnels_total_10000_weighted'].filter(k => refKeys.has(k));
            const rGCols = [...refKeys].filter(k => /^acc_grav_/.test(k));
            const rFCols = [...refKeys].filter(k => /^acc_2sfca_/.test(k));
            refAvgD = avgRef(rDCols);
            refAvgG = avgRefAll(rGCols);
            refAvgF = avgRefAll(rFCols);
            // Recalcul du score depuis densite+diversite avec bornes fixes sur la reference
            // → evite l'artefact du score_couverture pre-calcule par Python (min-max par scenario)
            const _densCol = 'densite_professionnels_total_10000';
            const _divCol  = SanteModel.activeDataset === 'etab' ? 'diversite_etab' : 'diversite_specialites';
            const _buildDV = (srcRows) => {
                const dM = {}, vM = {};
                srcRows.forEach(r => { const c = SanteModel.normalizeCode(r?.code_commune); if (!c) return; const d = Number(r?.[_densCol]); dM[c] = isFinite(d) && d > 0 ? d : 0; const v = Number(r?.[_divCol]); vM[c] = isFinite(v) && v > 0 ? v : 0; });
                return { dM, vM };
            };
            const { dM: rDM, vM: rVM } = _buildDV(refRows2);
            const { dM: redDM, vM: redVM } = _buildDV(rows);
            const ndRef = normalize01(rDM, rDM);  const nvRef = normalize01(rVM, rVM);
            const ndRed = normalize01(redDM, rDM); const nvRed = normalize01(redVM, rVM);
            const refScoreMap = {};
            Object.keys(ndRef).forEach(c => { refScoreMap[c] = 0.6 * (ndRef[c] ?? 0) + 0.4 * (nvRef[c] ?? 0); });
            refAvgS = refScoreMap;
            globalRedScoreMap = {};
            const _allScoreCodes = new Set([...Object.keys(ndRed), ...Object.keys(nvRed)]);
            _allScoreCodes.forEach(c => { globalRedScoreMap[c] = 0.6 * (ndRed[c] ?? 0) + 0.4 * (nvRed[c] ?? 0); });
        }

        const d01 = normalize01(avgAcrossCols(densityCols),                    refAvgD);
        const s01 = normalize01(globalRedScoreMap || avgAcrossCols(scoreCols), refAvgS);
        const g01 = normalize01(avgAcrossColsAll(gravityCols),  refAvgG);
        const f01 = normalize01(avgAcrossColsAll(sfcaCols),     refAvgF);

        const allCodes = new Set();
        [d01, s01, g01, f01].forEach(map => Object.keys(map).forEach(c => allCodes.add(c)));
        const global = {};
        allCodes.forEach(code => {
            const vals = [d01[code], s01[code], g01[code], f01[code]].filter(v => isFinite(v));
            global[code] = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) * 100 : 0;
        });
        return global;
    },

    buildTensionDisplayData(type, refRowsByCode, reducedRowsByCode) {
        const refRows = Object.values(refRowsByCode || {}).filter(Boolean);
        const reducedRows = Object.values(reducedRowsByCode || {}).filter(Boolean);
        const options = {
            totalDensityRaw: 'densite_professionnels_total_10000',
            totalDensityWeighted: 'densite_professionnels_total_10000_weighted',
            scoreKeys: ['score_couverture', 'score_couverture_weighted'],
        };

        const refAgg = SanteModel.computeAggregationMapsFromRows(refRows, options)?.[type] || null;
        const reducedAgg = SanteModel.computeAggregationMapsFromRows(reducedRows, options)?.[type] || null;
        if (!refAgg || !reducedAgg) return null;

        return {
            reference: {
                ...refAgg,
                // Pour score/global : passe refRowsByCode = refRowsByCode → normalise sur ses propres
                // bornes (identique a sans reference), mais garantit la coherence de la formule
                // entre reference et reduit.
                rawValueByCode: this.buildRawAggregationValueMap(type, refRowsByCode,
                    (type === 'global' || type === 'score') ? refRowsByCode : null),
            },
            reduced: {
                ...reducedAgg,
                // Pour score/global : passe refRowsByCode pour fixer l'echelle de normalisation
                // et eviter l'artefact de renormalisation min-max independant par scenario.
                rawValueByCode: this.buildRawAggregationValueMap(type, reducedRowsByCode,
                    (type === 'global' || type === 'score') ? refRowsByCode : null),
            },
        };
    },

    getDeltaColor(deltaPct) {
        if (!isFinite(deltaPct)) return '#bdbdbd';
        if (deltaPct > 0)  return '#78c679';   // amélioration
        if (deltaPct === 0) return '#555555';   // aucun changement
        if (deltaPct <= -40) return '#8b0000';
        if (deltaPct <= -30) return '#d94801';
        if (deltaPct <= -20) return '#f16913';
        if (deltaPct <= -10) return '#fdcc8a';
        return '#ffe082';  // -10% < delta < 0
    },

    getDeltaLabel(deltaPct) {
        if (!isFinite(deltaPct)) return 'N/A';
        if (deltaPct > 0)  return 'Amélioration (delta% > 0)';
        if (deltaPct === 0) return 'Stable (aucun changement)';
        if (deltaPct <= -40) return 'Chute critique (≤ -40%)';
        if (deltaPct <= -30) return 'Chute forte (-40% à -30%)';
        if (deltaPct <= -20) return 'Chute marquée (-30% à -20%)';
        if (deltaPct <= -10) return 'Faible baisse (-20% à -10%)';
        return 'Très faible baisse (0% à -10%)';
    },

    buildDeltaLegendControl() {
        const control = L.control({ position: 'bottomright' });
        control.onAdd = () => {
            const div = L.DomUtil.create('div', 'info legend legend-compact legend-collapsible');
            div.innerHTML =
                `<div class="legend-head">` +
                `<strong>Variation relative (Delta %)</strong>` +
                `<button type="button" class="legend-toggle" title="Replier / déplier">▾</button>` +
                `</div>` +
                `<div class="legend-sub">Δ% = (V<sub>réduite</sub> − V<sub>référence</sub>) / V<sub>référence</sub> × 100</div>` +
                `<div class="legend-body">` +
                `<div class="legend-row"><i style="background:#78c679;"></i><span>Amélioration (delta% &gt; 0)</span></div>` +
                `<div class="legend-row"><i style="background:#555555;"></i><span>Stable (delta% = 0)</span></div>` +
                `<div class="legend-row"><i style="background:#ffe082;"></i><span>Très faible baisse (0% à -10%)</span></div>` +
                `<div class="legend-row"><i style="background:#fdcc8a;"></i><span>Faible baisse (-10% à -20%)</span></div>` +
                `<div class="legend-row"><i style="background:#f16913;"></i><span>Chute marquée (-20% à -30%)</span></div>` +
                `<div class="legend-row"><i style="background:#d94801;"></i><span>Chute forte (-30% à -40%)</span></div>` +
                `<div class="legend-row"><i style="background:#8b0000;"></i><span>Chute critique (≤ -40%)</span></div>` +
                `</div>`;

            const toggle = div.querySelector('.legend-toggle');
            const body = div.querySelector('.legend-body');
            let collapsed = false;
            if (toggle && body) {
                toggle.addEventListener('click', () => {
                    collapsed = !collapsed;
                    body.style.display = collapsed ? 'none' : 'block';
                    div.classList.toggle('is-collapsed', collapsed);
                    toggle.textContent = collapsed ? '▸' : '▾';
                });
            }

            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            return div;
        };
        return control;
    },

    renderTensionDeltaMap(referenceRawByCode, reducedRawByCode, indicatorType, reducedRowsByCode) {
        const mapId = 'map-sante-tension-delta';
        const mapType = 'sante-tension-delta';
        const refUnit = indicatorType === 'global' ? 'Agrégation brute'
            : indicatorType === 'score' ? 'Score brut'
            : indicatorType === 'density' ? 'Densité brute'
            : indicatorType === 'gravity' ? 'Accessibilité gravitaire brute'
            : indicatorType === 'sfca' ? 'Accessibilité 2SFCA brute'
            : 'Valeur brute';
        const carte = initMap(mapId, mapType);

        if (AppState.geojsonLayers[mapType]) {
            carte.removeLayer(AppState.geojsonLayers[mapType]);
        }
        if (AppState.legendControls[mapType]) {
            carte.removeControl(AppState.legendControls[mapType]);
        }

        const deltaPctByCode = {};
        const deltaAbsByCode = {};
        const allCodes = new Set([
            ...Object.keys(referenceRawByCode || {}),
            ...Object.keys(reducedRawByCode || {}),
        ]);

        allCodes.forEach(code => {
            const refVal = Number(referenceRawByCode?.[code]);
            const redVal = Number(reducedRawByCode?.[code]);
            if (!isFinite(refVal) || !isFinite(redVal)) {
                deltaPctByCode[code] = NaN;
                deltaAbsByCode[code] = NaN;
                return;
            }
            // Les deux sont nuls (commune sans offre) → stable
            if (refVal === 0 && redVal === 0) {
                deltaPctByCode[code] = 0;
                deltaAbsByCode[code] = 0;
                return;
            }
            // Référence nulle mais offre réduite non nulle → cas impossible, NaN
            if (refVal <= 0) {
                deltaPctByCode[code] = NaN;
                deltaAbsByCode[code] = NaN;
                return;
            }
            const deltaAbs = redVal - refVal;
            const deltaPct = (deltaAbs / refVal) * 100;
            deltaAbsByCode[code] = deltaAbs;
            deltaPctByCode[code] = deltaPct;
        });

        const layer = L.geoJSON(AppState.communeJson, {
            style: (feature) => {
                const code = SanteModel.normalizeCode(feature?.properties?.code_commune || feature?.properties?.code);
                const deltaPct = Number(deltaPctByCode?.[code]);
                return {
                    fillColor: this.getDeltaColor(deltaPct),
                    weight: 1,
                    color: '#000000',
                    fillOpacity: 0.75,
                };
            },
            onEachFeature: (feature, lyr) => {
                const code = SanteModel.normalizeCode(feature?.properties?.code_commune || feature?.properties?.code);
                const commune = feature?.properties?.nom || feature?.properties?.nom_commune || code;
                const refVal = Number(referenceRawByCode?.[code]);
                const redVal = Number(reducedRawByCode?.[code]);
                const deltaAbs = Number(deltaAbsByCode?.[code]);
                const deltaPct = Number(deltaPctByCode?.[code]);
                const sign = isFinite(deltaAbs) && deltaAbs > 0 ? '+' : '';
                const signPct = isFinite(deltaPct) && deltaPct > 0 ? '+' : '';

                const redRow = reducedRowsByCode?.[code] || null;
                const countKey = SanteModel.getTotalCountKey(false);
                const population = redRow?.population != null ? Number(redRow.population).toLocaleString('fr-FR') : 'N/A';
                const nbPros = redRow?.[countKey] != null ? Number(redRow[countKey]).toLocaleString('fr-FR') : 'N/A';
                const diversiteKey = SanteModel.activeDataset === 'etab' ? 'diversite_etab' : 'diversite_specialites';
                const diversite = redRow?.[diversiteKey] != null ? redRow[diversiteKey] : 'N/A';
                const diversiteLabel = SanteModel.activeDataset === 'etab' ? 'Diversité (types)' : 'Diversité (spécialités)';
                const offreLabel = SanteModel.activeDataset === 'etab' ? 'Établissements' : 'Professionnels';

                const _dec = 6;
                lyr.bindPopup(
                    `<strong>${commune}</strong><br>` +
                    `Valeur brute référence : <strong>${isFinite(refVal) ? refVal.toFixed(_dec) : 'N/A'}</strong><br>` +
                    `Valeur brute offre réduite : <strong>${isFinite(redVal) ? redVal.toFixed(_dec) : 'N/A'}</strong><br>` +
                    `Δ brut : <strong>${isFinite(deltaAbs) ? `${sign}${deltaAbs.toFixed(_dec)}` : 'N/A'}</strong><br>` +
                    `Δ% : <strong>${isFinite(deltaPct) ? `${signPct}${deltaPct.toFixed(1)}%` : 'N/A'}</strong><br>` +
                    `Classe tension : ${this.getDeltaLabel(deltaPct)}<br>` +
                    `<hr style="margin:4px 0;">` +
                    `Population : ${population}<br>` +
                    `${offreLabel} (après réduction) : ${nbPros}<br>` +
                    `${diversiteLabel} : ${diversite}`
                );
                lyr.on('mouseover', function () { this.openPopup(); });
                lyr.on('mouseout', function () { this.closePopup(); });
            },
        }).addTo(carte);

        const bounds = layer.getBounds();
        if (bounds.isValid()) carte.fitBounds(bounds, { padding: [10, 10] });

        AppState.geojsonLayers[mapType] = layer;
        const legendControl = this.buildDeltaLegendControl();
        legendControl.addTo(carte);
        AppState.legendControls[mapType] = legendControl;

        setTimeout(() => carte.invalidateSize(), 100);
    },

    afficherCarteAggregation(type) {
        if (!SanteModel.isLoaded || !AppState.communeJson) return;
        const aggData = SanteModel.aggregationMaps?.[type];
        if (!aggData) return;
        this._lastTensionType = type;
        this.renderAggregationMap({
            mapId: 'map-sante-aggregation',
            mapType: 'sante-aggregation',
            aggData,
            titleLabel: this.aggregationTypeLabel(type),
            rowsByCode: SanteModel.dataByKey,
            rawValueByCode: this.buildRawAggregationValueMap(type, SanteModel.dataByKey),
            indicatorType: type,
        });
    },

    afficherCarteTensions(type, scenarioKey) {
        if (!SanteModel.isLoaded || !AppState.communeJson || !SanteModel.hasTensionsData()) return;

        this._lastTensionType = type;
        const refRows = SanteModel.dataByKey || {};
        const reducedRows = SanteModel.getTensionScenarioRowsByCode(scenarioKey);
        const displayData = this.buildTensionDisplayData(type, refRows, reducedRows);
        if (!displayData) return;

        const reducedMatch = String(scenarioKey || '').match(/^remove_(\d+)$/);
        const removedCount = reducedMatch ? Number(reducedMatch[1]) : 1;

        this.renderAggregationMap({
            mapId: 'map-sante-tension-reduced',
            mapType: 'sante-tension-reduced',
            aggData: displayData.reduced,
            titleLabel: `${this.aggregationTypeLabel(type)} réduite à ${removedCount}`,
            rowsByCode: reducedRows,
            rawValueByCode: displayData.reduced.rawValueByCode,
            indicatorType: type,
        });

        this.renderTensionDeltaMap(
            displayData.reference.rawValueByCode,
            displayData.reduced.rawValueByCode,
            type,
            reducedRows,
        );

        const titleEl = document.getElementById('sante-tension-map-reduced-title');
        if (titleEl) {
            titleEl.textContent = `Offre réduite (${removedCount} professionnel${removedCount > 1 ? 's' : ''} retiré${removedCount > 1 ? 's' : ''} par commune)`;
        }
    },

    synchroniserAvecCarteReference() {
        const ref = AppState.cartes['oppchovec'];
        const santeMap = AppState.cartes['sante'];
        if (ref && santeMap) {
            santeMap.setView(ref.getCenter(), ref.getZoom(), { animate: false });
        }
    },
};

window.SanteMapView = SanteMapView;
