/**
 * Génération des légendes pour les cartes OppChoVec.
 *
 * Élimine la duplication de ~100 lignes HTML dans l'original
 * (légende LISA 5% et 1% quasi-identiques dans OppChoVec.html).
 */

/**
 * Rend un élément DOM déplaçable à la souris dans le conteneur d'une carte Leaflet.
 *
 * @param {HTMLElement} div - L'élément à rendre déplaçable
 * @param {L.Map}       map - La carte Leaflet parent
 */
function _makeDraggable(div, map) {
    div.style.cursor = 'grab';
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    let dragging = false, startX, startY;

    const onMove = (e) => {
        if (!dragging) return;
        const mapEl  = map.getContainer();
        const newLeft = Math.max(0, Math.min(e.clientX - startX, mapEl.offsetWidth  - div.offsetWidth));
        const newTop  = Math.max(0, Math.min(e.clientY - startY, mapEl.offsetHeight - div.offsetHeight));
        div.style.left = newLeft + 'px';
        div.style.top  = newTop  + 'px';
    };

    const onUp = () => {
        if (!dragging) return;
        dragging = false;
        div.style.cursor = 'grab';
    };

    div.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const mapEl  = map.getContainer();
        const mapRect = mapEl.getBoundingClientRect();
        const divRect = div.getBoundingClientRect();

        // Détacher du flux Leaflet → position absolue sur le conteneur carte
        div.style.position = 'absolute';
        div.style.margin   = '0';
        div.style.right    = 'auto';
        div.style.bottom   = 'auto';
        div.style.left     = (divRect.left - mapRect.left) + 'px';
        div.style.top      = (divRect.top  - mapRect.top)  + 'px';
        div.style.zIndex   = '1000';
        mapEl.appendChild(div);

        startX   = e.clientX - div.offsetLeft;
        startY   = e.clientY - div.offsetTop;
        dragging = true;
        div.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
}


/**
 * Crée un contrôle Leaflet de légende choroplèthe (classification Jenks).
 *
 * @param {string} type  - Clé de carte ('oppchovec', 'opp', 'cho', 'vec')
 * @param {string} titre - Titre affiché dans la légende
 * @returns {L.Control}
 */
function buildChoroplethLegend(type, titre) {
    const control = L.control({ position: 'bottomright' });

    control.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        // Utiliser les seuils dynamiques (recalcul p_k) ou les seuils statiques
        const seuils  = AppState.seuilsJenks[type];
        const labels  = seuils
            ? genererLabelsJenks([1, ...seuils, 10])
            : (LABELS_JENKS[type] || ['Très faible', 'Faible', 'Moyen', 'Élevé']);

        div.innerHTML = `<strong>${titre}</strong><br>
            <small style="color:#666;">Échelle 1-10 (Jenks)</small><br><br>`;

        for (let i = 0; i < COLORS_JENKS.length; i++) {
            div.innerHTML +=
                `<i style="background:${COLORS_JENKS[i]};width:18px;height:18px;` +
                `display:inline-block;margin-right:5px;"></i>${labels[i]}<br>`;
        }

        _makeDraggable(div, map);
        return div;
    };

    return control;
}


/**
 * Génère le HTML de la légende LISA (injecté dans les placeholders de index.html).
 *
 * @param {string} seuil - '5%' ou '1%'
 * @returns {string} HTML complet de la légende
 */
function buildLisaLegendHTML(seuil) {
    const isPct5 = seuil === '5%';

    // Statistiques extraites des données LISA pré-calculées
    const data        = isPct5 ? LISA_DATA        : LISA_DATA_1PCT;
    const pValLabel   = isPct5 ? 'p ≥ 0.05'      : 'p ≥ 0.01';
    const stats       = data.statistiques ?? {};
    const nbSig       = data.metadata?.nb_significatives ?? '–';
    const pctSig      = data.metadata?.pourcent_significatives?.toFixed(1) ?? '–';
    const moranI      = data.metadata?.moran_global_I?.toFixed(4) ?? '–';
    const nbHH        = stats['HH (High-High)'] ?? '–';
    const nbLL        = stats['LL (Low-Low)']   ?? '–';
    const nbHL        = stats['HL (High-Low)']  ?? '–';
    const nbLH        = stats['LH (Low-High)']  ?? '–';
    const nbOutliers  = (typeof nbHL === 'number' && typeof nbLH === 'number')
        ? nbHL + nbLH : '–';
    const titreStrict = isPct5 ? '' : '<li><em>Seuil plus strict = patterns plus robustes et fiables</em></li>';

    const colorBoxes = Object.entries(COLORS_LISA).map(([label, color]) => `
        <div class="lisa-legend-item">
            <span class="lisa-color-box" style="background-color:${color};"></span>
            <span class="lisa-label"><strong>${label}</strong>${_lisaLabelDesc(label, pValLabel)}</span>
        </div>`).join('');

    return `
        <div class="lisa-legend">
            <h3>Légende des clusters LISA (Seuil ${seuil})</h3>
            <div class="lisa-legend-colors">${colorBoxes}</div>

            <h3>Qu'est-ce que LISA ?</h3>
            <p><strong>LISA (Local Indicators of Spatial Association)</strong> détecte les zones
            où les communes ont des valeurs similaires ou différentes à leurs voisines.</p>

            <h3>Interprétation des clusters :</h3>
            <ul>
                <li><strong>HH (High-High)</strong> : communes à indice <strong>élevé</strong>
                    entourées de communes à indice <strong>élevé</strong> → "Hotspots"</li>
                <li><strong>LL (Low-Low)</strong> : communes à indice <strong>faible</strong>
                    entourées de communes à indice <strong>faible</strong> → "Coldspots"</li>
                <li><strong>HL (High-Low)</strong> : commune <strong>élevée</strong>
                    entourée de communes <strong>faibles</strong> → Outlier positif</li>
                <li><strong>LH (Low-High)</strong> : commune <strong>faible</strong>
                    entourée de communes <strong>élevées</strong> → Outlier négatif</li>
                <li><strong>Non significatif</strong> : pas de pattern spatial (${pValLabel})</li>
            </ul>

            <h3>Résultats de l'analyse (Seuil ${seuil}) :</h3>
            <ul>
                <li><strong>${pctSig}% des communes (${nbSig})</strong> présentent un pattern significatif</li>
                <li><strong>${nbHH} communes HH</strong> : hotspots d'opportunités</li>
                <li><strong>${nbLL} communes LL</strong> : coldspots d'opportunités</li>
                <li><strong>${nbOutliers} outliers</strong> (${nbHL} HL + ${nbLH} LH)</li>
                <li><strong>Indice de Moran I = ${moranI}</strong> (p-value = 0.001)</li>
                ${titreStrict}
            </ul>
        </div>`;
}

/** Retourne la courte description d'un type de cluster LISA. */
function _lisaLabelDesc(label, pValLabel) {
    const descs = {
        'HH (High-High)':   ' – Valeurs élevées entourées de valeurs élevées → Hotspots',
        'LL (Low-Low)':     ' – Valeurs faibles entourées de valeurs faibles → Coldspots',
        'HL (High-Low)':    ' – Valeur élevée entourée de valeurs faibles → Outlier positif',
        'LH (Low-High)':    ' – Valeur faible entourée de valeurs élevées → Outlier négatif',
        'Non significatif': ` – Pas de pattern spatial significatif (${pValLabel})`,
    };
    return descs[label] ?? '';
}
