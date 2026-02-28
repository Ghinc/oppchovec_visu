/**
 * Rendu cartographique Leaflet pour OppChoVec.
 *
 * Gère la création des cartes, des couches choroplèthes et LISA,
 * et le surlignement des communes sélectionnées.
 */

// ==============================================================================
// EMBELLISSEMENTS CARTOGRAPHIQUES
// ==============================================================================

/** Rose des vents (SVG 80×80) en haut à gauche — s'ajoute une seule fois par carte. */
function ajouterRoseDesVents(carte) {
    if (carte.getContainer().querySelector('.rose-des-vents')) return;
    const ctrl = L.control({ position: 'topleft' });
    ctrl.onAdd = function () {
        const div = L.DomUtil.create('div', 'rose-des-vents');
        div.innerHTML = `
            <svg width="80" height="80" viewBox="0 0 80 80"
                 style="background:rgba(255,255,255,0.9);border-radius:50%;padding:5px;box-shadow:0 2px 5px rgba(0,0,0,0.2);">
                <circle cx="40" cy="40" r="35" fill="none" stroke="#333" stroke-width="1"/>
                <polygon points="40,10 45,35 40,30 35,35" fill="#d73027" stroke="#000" stroke-width="0.5"/>
                <polygon points="40,70 35,45 40,50 45,45" fill="#333"    stroke="#000" stroke-width="0.5"/>
                <polygon points="70,40 45,35 50,40 45,45" fill="#666"    stroke="#000" stroke-width="0.5"/>
                <polygon points="10,40 35,45 30,40 35,35" fill="#666"    stroke="#000" stroke-width="0.5"/>
                <text x="40" y="8"  text-anchor="middle" font-size="10" font-weight="bold" fill="#d73027">N</text>
                <text x="40" y="76" text-anchor="middle" font-size="8"  font-weight="bold" fill="#333">S</text>
                <text x="73" y="43" text-anchor="middle" font-size="8"  font-weight="bold" fill="#333">E</text>
                <text x="7"  y="43" text-anchor="middle" font-size="8"  font-weight="bold" fill="#333">O</text>
            </svg>`;
        return div;
    };
    ctrl.addTo(carte);
}

/** Barre d'échelle fixe à 50 km (bottomleft) — recalculée à chaque zoom/déplacement. */
function ajouterEchelle50km(carte) {
    const ctrl = L.control({ position: 'bottomleft' });
    ctrl.onAdd = function (map) {
        const container = L.DomUtil.create('div', 'leaflet-control-scale');
        const line      = L.DomUtil.create('div', 'leaflet-control-scale-line', container);
        function update() {
            const c    = map.getCenter();
            const p1   = map.latLngToContainerPoint(L.latLng(c.lat, c.lng - 0.5));
            const p2   = map.latLngToContainerPoint(L.latLng(c.lat, c.lng + 0.5));
            const pxPD = Math.abs(p2.x - p1.x);
            const kmPD = 111.32 * Math.cos(c.lat * Math.PI / 180);
            line.style.width = Math.max(20, Math.round(50 * pxPD / kmPD)) + 'px';
            line.innerHTML   = '50 km';
        }
        map.on('zoomend moveend', update);
        setTimeout(update, 50);
        L.DomEvent.disableClickPropagation(container);
        return container;
    };
    ctrl.addTo(carte);
}

/** Labels des 5 villes principales avec point noir et ligne de repère pointillée. */
function ajouterVillesPrincipales(carte) {
    const lignesPane = 'villesLignesPane';
    const labelsPane = 'villesPane';
    if (!carte.getPane(lignesPane)) carte.createPane(lignesPane).style.zIndex = 490;
    if (!carte.getPane(labelsPane)) carte.createPane(labelsPane).style.zIndex = 500;

    VILLES_PRINCIPALES.forEach(v => {
        const posV = [v.lat, v.lng];
        const posL = [v.lat + v.labelOffset.lat, v.lng + v.labelOffset.lng];

        L.polyline([posV, posL], {
            color: '#000', weight: 1, opacity: 0.6, dashArray: '3, 3', pane: lignesPane,
        }).addTo(carte);

        L.circleMarker(posV, {
            radius: 5, fillColor: '#000', color: '#fff', weight: 2, fillOpacity: 1, pane: labelsPane,
        }).addTo(carte);

        L.marker(posL, {
            icon: L.divIcon({
                className: 'ville-label',
                html: `<div style="font-weight:bold;font-size:13px;color:#000;
                           background:rgba(255,255,255,0.85);padding:3px 8px;
                           border:1px solid #000;border-radius:3px;white-space:nowrap;">
                           ${v.nom}</div>`,
                iconSize: [100, 20],
                iconAnchor: [50, 10],
            }),
            pane: labelsPane,
        }).addTo(carte);
    });
}

/** Notice de copyright centrée en bas de carte. */
function ajouterCopyright(carte) {
    if (carte.getContainer().querySelector('.copyright-control')) return;
    const ctrl = L.control({ position: 'bottomleft' });
    ctrl.onAdd = function () {
        const div = L.DomUtil.create('div', 'copyright-control');
        div.style.cssText = 'background:rgba(255,255,255,0.9);padding:4px 8px;border-radius:4px;' +
            'box-shadow:0 2px 5px rgba(0,0,0,0.2);font-size:9px;color:#666;font-family:Arial,sans-serif;';
        div.innerHTML = '© Ghinevra COMITI, Lise BOURDEAU-LEPAGE 2025 — Tous droits réservés';
        return div;
    };
    ctrl.addTo(carte);
    // Repositionner au centre-bas après ajout
    setTimeout(() => {
        const el = carte.getContainer().querySelector('.copyright-control');
        if (!el) return;
        const container = document.createElement('div');
        container.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:0;pointer-events:none;';
        container.appendChild(el);
        el.style.pointerEvents = 'auto';
        carte.getContainer().querySelector('.leaflet-control-container').appendChild(container);
    }, 100);
}

// ==============================================================================
// RÉSEAU ROUTIER
// ==============================================================================

/**
 * Initialise les couches de routes pour une carte (appelé après le lazy-fetch).
 *
 * @param {L.Map} carte
 * @param {string} mapType - Clé de carte ('oppchovec', 'opp', etc.)
 */
function ajouterReseauRoutier(carte, mapType) {
    const paneName = 'routesPane';
    if (!carte.getPane(paneName)) {
        const pane = carte.createPane(paneName);
        pane.style.zIndex = 450;
        pane.style.pointerEvents = 'auto';
    }

    if (!AppState.routesLayers[mapType]) AppState.routesLayers[mapType] = {};

    const types = ['nationales', 'departementales', 'communales', 'toutes'];
    types.forEach(type => {
        if (!AppState.routesGeojson[type] || AppState.routesLayers[mapType][type]) return;
        AppState.routesLayers[mapType][type] = L.geoJSON(AppState.routesGeojson[type], {
            pane: paneName,
            style: { color: '#ff0000', weight: 2, opacity: 0.7 },
            onEachFeature: (feature, layer) => {
                if (!feature.properties) return;
                const p = feature.properties;
                layer.bindPopup([
                    p.num_route  ? `<strong>Route :</strong> ${p.num_route}` : null,
                    p.class_adm  ? `<strong>Classification :</strong> ${p.class_adm}` : null,
                    p.toponyme   ? `<strong>Nom :</strong> ${p.toponyme}` : null,
                ].filter(Boolean).join('<br>') || 'Route');
            },
        });
    });

    mettreAJourAffichageRoutes(carte, mapType);
}

/**
 * Ajoute/retire les couches de routes selon l'état des checkboxes.
 *
 * @param {L.Map} carte
 * @param {string} mapType
 */
function mettreAJourAffichageRoutes(carte, mapType) {
    const layers = AppState.routesLayers[mapType];
    if (!layers) return;
    ['nationales', 'departementales', 'communales', 'toutes'].forEach(type => {
        const cb    = document.getElementById(`checkbox-${type}`);
        const layer = layers[type];
        if (!layer) return;
        if (carte.hasLayer(layer)) carte.removeLayer(layer);
        if (cb && cb.checked) layer.addTo(carte);
    });
}


// ==============================================================================
// INITIALISATION CARTE
// ==============================================================================

/**
 * Initialise une carte Leaflet sur fond blanc si elle n'existe pas encore.
 *
 * @param {string} mapId  - ID du div conteneur
 * @param {string} type   - Clé de carte dans AppState.cartes
 * @returns {L.Map}
 */
function initMap(mapId, type) {
    if (!AppState.cartes[type]) {
        AppState.cartes[type] = L.map(mapId, {
            center: MAP_CENTER,
            zoom:   MAP_ZOOM,
            zoomControl: true,
            attributionControl: false,
        });
        const carte = AppState.cartes[type];
        carte.getContainer().style.backgroundColor = '#ffffff';
        ajouterRoseDesVents(carte);
        ajouterEchelle50km(carte);
        ajouterVillesPrincipales(carte);
        ajouterCopyright(carte);
    }
    return AppState.cartes[type];
}


/**
 * Retourne la couleur Jenks correspondant à une valeur.
 * Utilise AppState.seuilsJenks[type] si disponible, sinon SEUILS_JENKS[type].
 *
 * @param {number} value - Valeur à coloriser
 * @param {string} type  - Clé de carte ('oppchovec', 'opp', etc.)
 * @returns {string} Code couleur hexadécimal
 */
function getColorJenks(value, type) {
    if (value === undefined || value === null || isNaN(value)) return '#cccccc';
    const seuils = AppState.seuilsJenks[type] || SEUILS_JENKS[type] || [3, 5, 7];
    if (value <= seuils[0]) return COLORS_JENKS[0];
    if (value <= seuils[1]) return COLORS_JENKS[1];
    if (value <= seuils[2]) return COLORS_JENKS[2];
    return COLORS_JENKS[3];
}


/**
 * Affiche ou met à jour une carte choroplèthe (OppChoVec, Opp, Cho ou Vec).
 *
 * @param {string} mapId          - ID du div conteneur
 * @param {string} type           - Clé de carte ('oppchovec', 'opp', 'cho', 'vec')
 * @param {Object} geojsonData    - FeatureCollection GeoJSON des communes
 * @param {Object} indicateursDict - {nom_commune: valeur_1_10}
 * @param {string} titre          - Titre affiché dans la légende et les popups
 */
function afficherCarteUnique(mapId, type, geojsonData, indicateursDict, titre) {
    const nbCommunes = Object.keys(indicateursDict).length;
    const nbFeatures = geojsonData ? geojsonData.features.length : 0;
    console.log(`[map] afficherCarteUnique type=${type} communes=${nbCommunes} features=${nbFeatures}`);
    if (nbCommunes > 0) {
        const sample = Object.entries(indicateursDict)[0];
        console.log(`[map]   sample indicateur: "${sample[0]}" = ${sample[1]}`);
    }
    if (nbFeatures > 0) {
        const firstProps = geojsonData.features[0].properties;
        console.log(`[map]   first feature props:`, JSON.stringify(firstProps));
    }

    const carte = initMap(mapId, type);

    // Supprimer l'ancienne couche et légende
    if (AppState.geojsonLayers[type]) {
        carte.removeLayer(AppState.geojsonLayers[type]);
    }
    if (AppState.legendControls[type]) {
        carte.removeControl(AppState.legendControls[type]);
    }

    // Créer la couche GeoJSON
    let _loggedFirst = false;
    AppState.geojsonLayers[type] = L.geoJSON(geojsonData, {
        style: feature => {
            const nom = feature.properties.nom;
            const val = indicateursDict[nom];
            if (!_loggedFirst) {
                console.log(`[map] style() type=${type} nom="${nom}" val=${val}`);
                _loggedFirst = true;
            }
            return {
                fillColor:   val !== undefined ? getColorJenks(val, type) : '#cccccc',
                color:       '#000000',
                weight:      1,
                fillOpacity: 0.7,
            };
        },
        onEachFeature: (feature, layer) => {
            const nom = feature.properties.nom;
            const val = indicateursDict[nom];

            // Stocker la couche par nom pour la carte principale (surlignement)
            if (type === 'oppchovec') {
                AppState.communeLayers[nom] = layer;
            }

            layer.bindPopup(
                `<strong>${nom}</strong><br>` +
                `${titre} : ${val !== undefined ? val.toFixed(2) : 'N/A'}/10`
            );
        },
    }).addTo(carte);

    // Ajouter la légende
    AppState.legendControls[type] = buildChoroplethLegend(type, titre);
    AppState.legendControls[type].addTo(carte);

    // Forcer le recalcul de la taille de la carte
    setTimeout(() => carte.invalidateSize(), 100);
    setTimeout(() => carte.invalidateSize(), 500);
}


/**
 * Affiche ou met à jour une carte LISA (5% ou 1%).
 *
 * @param {string} mapId       - ID du div conteneur
 * @param {string} mapType     - Clé de carte ('lisa-5pct' ou 'lisa-1pct')
 * @param {Object} geojsonData - FeatureCollection GeoJSON
 * @param {Object} indiceFinal - {nom_commune: valeur_oppchovec_1_10}
 * @param {Object} clustersLISA - {nom_commune: type_cluster}
 * @param {string} seuil       - '5%' ou '1%'
 */
function afficherCarteLISA(mapId, mapType, geojsonData, indiceFinal, clustersLISA, seuil) {
    const carte = initMap(mapId, mapType);

    if (AppState.geojsonLayers[mapType]) {
        carte.removeLayer(AppState.geojsonLayers[mapType]);
    }

    AppState.geojsonLayers[mapType] = L.geoJSON(geojsonData, {
        style: feature => {
            const nom     = feature.properties.nom;
            const cluster = clustersLISA[nom] || 'Non significatif';
            return {
                fillColor:   COLORS_LISA[cluster] || COLORS_LISA['Non significatif'],
                color:       '#000000',
                weight:      1,
                fillOpacity: 0.7,
            };
        },
        onEachFeature: (feature, layer) => {
            const nom     = feature.properties.nom;
            const cluster = clustersLISA[nom] || 'Non significatif';
            const val     = indiceFinal[nom];
            layer.bindPopup(
                `<strong>${nom}</strong><br>` +
                `<strong>Cluster LISA (${seuil}) :</strong> ${cluster}<br>` +
                `<strong>OppChoVec :</strong> ${val !== undefined ? val.toFixed(2) : 'N/A'}/10`
            );
        },
    }).addTo(carte);
}


/**
 * Affiche les 4 cartes principales (OppChoVec, Opp, Cho, Vec).
 * Met à jour les cartes LISA si elles sont déjà initialisées.
 *
 * @param {Object} geojsonData - FeatureCollection GeoJSON
 * @param {Object} indiceFinal - {commune: valeur_1_10}
 * @param {Object} scores      - {commune: {Score_Opp, Score_Cho, Score_Vec}}
 */
function afficherToutesLesCartes(geojsonData, indiceFinal, scores) {
    const scoresOpp = {}, scoresCho = {}, scoresVec = {};
    for (const [commune, s] of Object.entries(scores)) {
        scoresOpp[commune] = s.Score_Opp;
        scoresCho[commune] = s.Score_Cho;
        scoresVec[commune] = s.Score_Vec;
    }

    afficherCarteUnique('map-oppchovec', 'oppchovec', geojsonData, indiceFinal,  'OppChoVec');
    afficherCarteUnique('map-opp',       'opp',       geojsonData, scoresOpp,    'Score Opp');
    afficherCarteUnique('map-cho',       'cho',       geojsonData, scoresCho,    'Score Cho');
    afficherCarteUnique('map-vec',       'vec',       geojsonData, scoresVec,    'Score Vec');

    if (AppState.lisaCartesInitialisees) {
        afficherCarteLISA('map-lisa-5pct', 'lisa-5pct', geojsonData, indiceFinal, AppState.clustersLISA5pct, '5%');
        afficherCarteLISA('map-lisa-1pct', 'lisa-1pct', geojsonData, indiceFinal, AppState.clustersLISA1pct, '1%');
    }
}


/**
 * Initialise les deux cartes LISA (appelé au premier clic sur l'onglet LISA).
 */
function initialiserCartesLISA() {
    if (AppState.lisaCartesInitialisees) return;

    afficherCarteLISA('map-lisa-5pct', 'lisa-5pct', AppState.communeJson, AppState.indiceFinale, AppState.clustersLISA5pct, '5%');
    afficherCarteLISA('map-lisa-1pct', 'lisa-1pct', AppState.communeJson, AppState.indiceFinale, AppState.clustersLISA1pct, '1%');
    AppState.lisaCartesInitialisees = true;

    setTimeout(() => {
        if (AppState.cartes['lisa-5pct']) AppState.cartes['lisa-5pct'].invalidateSize();
    }, 100);
}


/**
 * Surligne le contour d'une commune sur la carte OppChoVec.
 *
 * @param {string} nomCommune - Nom de la commune
 * @param {string} couleur    - Couleur du contour (défaut : 'red')
 */
function surlignerCommune(nomCommune, couleur = 'red') {
    const layer = AppState.communeLayers[nomCommune];
    if (layer) {
        layer.setStyle({ color: couleur, weight: 3, fillOpacity: 0.7 });
        layer.bringToFront();
    }
    AppState.communesHighlightees.push(nomCommune);
}


/**
 * Réinitialise le style d'une commune surlignée.
 *
 * @param {string} nomCommune - Nom de la commune
 */
function reinitialiserStyleCommune(nomCommune) {
    const layer = AppState.communeLayers[nomCommune];
    if (layer) {
        // Correction : #000000 (noir) et non #ffffff (blanc) comme dans l'original
        layer.setStyle({ color: '#000000', weight: 1, fillOpacity: 0.7 });
    }
}
