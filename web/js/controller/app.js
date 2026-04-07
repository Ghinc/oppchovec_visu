/**
 * Contrôleur principal de l'application OppChoVec.
 *
 * Seul fichier qui contient des addEventListener.
 * Coordonne le modèle (AppState, calculator) et la vue (map, commune, legend).
 *
 * Corrections apportées vs l'original :
 *  - `resultDiv` déclaré avant utilisation dans recalculerIndice
 *  - Pas de variables globales isolées (tout dans AppState)
 */

// ==============================================================================
// UTILITAIRE
// ==============================================================================

/**
 * Lit un fichier uploadé et retourne son contenu texte.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
        reader.onload  = () => resolve(reader.result);
        reader.readAsText(file);
    });
}


/**
 * Charge les clusters LISA depuis les globals LISA_DATA et LISA_DATA_1PCT
 * (injectés par lisa_data.js et lisa_data_1pct.js).
 *
 * @returns {{ clusters5pct: Object, clusters1pct: Object }}
 */
function chargerClustersLISA() {
    try {
        if (typeof LISA_DATA === 'undefined')     throw new Error('LISA_DATA manquant (lisa_data.js absent ?)');
        if (typeof LISA_DATA_1PCT === 'undefined') throw new Error('LISA_DATA_1PCT manquant (lisa_data_1pct.js absent ?)');

        const clusters5pct = {};
        for (const [commune, info] of Object.entries(LISA_DATA.clusters)) {
            clusters5pct[commune] = info.cluster;
        }

        const clusters1pct = {};
        for (const [commune, info] of Object.entries(LISA_DATA_1PCT.clusters)) {
            clusters1pct[commune] = info.cluster;
        }

        return { clusters5pct, clusters1pct };
    } catch (err) {
        console.error('Erreur chargement LISA :', err);
        return { clusters5pct: {}, clusters1pct: {} };
    }
}


// ==============================================================================
// ACTIONS UTILISATEUR (accessibles depuis les onclick inline dans commune.js)
// ==============================================================================

/**
 * Recalcule l'indice après modification des sliders d'une commune.
 *
 * @param {string} selectedCommune
 */
function recalculerIndice(selectedCommune) {
    const communeData = AppState.indicateursCommune[selectedCommune];
    if (!communeData) return;

    // Lire les nouvelles valeurs des sliders
    for (const indicateur of Object.keys(communeData)) {
        const input = document.getElementById(indicateur);
        if (input) communeData[indicateur] = parseFloat(input.value);
    }
    AppState.indicateursCommune[selectedCommune] = communeData;

    // Recalculer
    const { indiceFinale: indiceBrut, scoresParCommune: scoresBruts } =
        recalculerDepuisIndicateurs(AppState.indicateursCommune);

    // Normaliser l'indice brut → 0-10 (même logique que recalculerCarteOppChoVec)
    const valeursIndice = Object.values(indiceBrut);
    const minI = Math.min(...valeursIndice), maxI = Math.max(...valeursIndice);
    const indiceFinale = {};
    for (const c in indiceBrut) {
        indiceFinale[c] = (maxI === minI) ? 5 : ((indiceBrut[c] - minI) / (maxI - minI)) * 10;
    }

    // Normaliser les scores bruts 0-1 → 0-10 pour cohérence avec l'affichage opp/cho/vec
    const scoresParCommune = {};
    for (const [c, s] of Object.entries(scoresBruts)) {
        scoresParCommune[c] = {
            Score_Opp: s.Score_Opp * 10,
            Score_Cho: s.Score_Cho * 10,
            Score_Vec: s.Score_Vec * 10,
        };
    }

    // Recalculer les seuils Jenks sur les nouvelles valeurs
    AppState.seuilsJenks['oppchovec'] = calculerJenksBreaks(Object.values(indiceFinale), 5);
    AppState.seuilsJenks['opp'] = calculerJenksBreaks(Object.values(scoresParCommune).map(s => s.Score_Opp), 5);
    AppState.seuilsJenks['cho'] = calculerJenksBreaks(Object.values(scoresParCommune).map(s => s.Score_Cho), 5);
    AppState.seuilsJenks['vec'] = calculerJenksBreaks(Object.values(scoresParCommune).map(s => s.Score_Vec), 5);

    AppState.indiceFinale     = indiceFinale;
    AppState.scoresParCommune = scoresParCommune;

    // Mettre à jour toutes les cartes
    afficherToutesLesCartes(AppState.communeJson, AppState.indiceFinale, AppState.scoresParCommune);

    // Réappliquer le surlignement rouge (la couche GeoJSON vient d'être recrée)
    surlignerCommune(selectedCommune, 'red');

    // Mettre à jour l'affichage de l'indice dans la sidebar
    const resultDiv = document.getElementById('resultCommune');
    const valeur    = AppState.indiceFinale[selectedCommune];
    if (valeur === undefined) {
        resultDiv.innerHTML = '<p style="color:red;">Données introuvables pour cette commune.</p>';
        return;
    }

    const ligneIndice = resultDiv.querySelector('p:nth-child(2)');
    if (ligneIndice) {
        ligneIndice.innerHTML = `<strong>OppChoVec :</strong> ${valeur.toFixed(2)}/10`;
    }

    // Mettre à jour la comparaison si elle est en cours
    if (AppState.comparaisonEnCours) {
        const { commune1, commune2 } = AppState.comparaisonEnCours;
        if (commune1 === selectedCommune || commune2 === selectedCommune) {
            afficherResultatComparaison(commune1, commune2);
        }
    }

    alert('Indice recalculé avec succès.');
}


/**
 * Réinitialise les indicateurs d'une commune à leurs valeurs d'origine.
 *
 * @param {string} commune
 */
function reinitialiserValeurs(commune) {
    const { indicateursDict } = parseDataJSON(AppState.indicateursOriginaux);
    AppState.indicateursCommune = indicateursDict;
    afficherCommune(commune);
    alert('Valeurs réinitialisées avec succès.');
}


/**
 * Ajuste la valeur d'un slider par delta (boutons +/−).
 *
 * @param {string} indicateur - ID du champ range
 * @param {number} delta      - Incrément ou décrément
 */
function ajusterValeur(indicateur, delta) {
    const input   = document.getElementById(indicateur);
    const display = document.getElementById(indicateur + '_val');
    if (!input || !display) return;

    const min  = parseFloat(input.min);
    const max  = parseFloat(input.max);
    const nouv = Math.max(min, Math.min(max, parseFloat(input.value) + delta));

    input.value   = nouv.toFixed(2);
    display.innerText = nouv.toFixed(2);
}


// ==============================================================================
// WIRING DES ÉVÉNEMENTS
// ==============================================================================

// ==============================================================================
// PONDÉRATION p_k DYNAMIQUE
// ==============================================================================

/** Bascule le mode de calcul des poids p_k et relance le rendu OppChoVec + LISA. */
function toggleModePk() {
    AppState.modeCalculPk = (AppState.modeCalculPk === 'egal') ? 'betti' : 'egal';
    recalculerCarteOppChoVec();
}

/**
 * Recalcule l'indice OppChoVec avec les p_k courants, met à jour les seuils Jenks
 * et re-rend la carte OppChoVec + les cartes LISA si déjà initialisées.
 */
function recalculerCarteOppChoVec() {
    if (!AppState.scoresParCommune01 || Object.keys(AppState.scoresParCommune01).length === 0) {
        console.warn('[pk] scoresParCommune01 non disponibles — charger les données d\'abord.');
        return;
    }

    const pk = AppState.modeCalculPk === 'betti'
        ? calculerPkBetti(AppState.scoresParCommune01)
        : [1, 1, 1];

    console.log(`[pk mode=${AppState.modeCalculPk}] Opp=${pk[0].toFixed(4)} Cho=${pk[1].toFixed(4)} Vec=${pk[2].toFixed(4)}`);

    // Recalculer l'indice brut à partir des scores 0-1
    const indiceBrut = calculerIndiceBienEtre(AppState.scoresParCommune01, pk);

    // Renormaliser min-max → 0-10
    const valeurs  = Object.values(indiceBrut);
    const minVal   = Math.min(...valeurs);
    const maxVal   = Math.max(...valeurs);
    const indiceNorm = {};
    for (const commune in indiceBrut) {
        indiceNorm[commune] = (maxVal === minVal) ? 5
            : ((indiceBrut[commune] - minVal) / (maxVal - minVal)) * 10;
    }

    // Recalculer les seuils Jenks (5 classes = 4 seuils)
    const breaks = calculerJenksBreaks(Object.values(indiceNorm), 5);
    AppState.seuilsJenks['oppchovec'] = breaks;
    console.log('[Jenks oppchovec]', breaks.map(v => v.toFixed(3)).join(' | '));

    // Mettre à jour l'indice final et re-rendre la carte OppChoVec
    AppState.indiceFinale = indiceNorm;
    afficherCarteUnique('map-oppchovec', 'oppchovec', AppState.communeJson, indiceNorm, 'OppChoVec');

    // Switcher les clusters LISA selon le mode
    if (AppState.modeCalculPk === 'betti'
            && typeof LISA_DATA_BETTI !== 'undefined'
            && typeof LISA_DATA_BETTI_1PCT !== 'undefined') {
        const c5 = {}, c1 = {};
        for (const [k, v] of Object.entries(LISA_DATA_BETTI.clusters))     c5[k] = v.cluster;
        for (const [k, v] of Object.entries(LISA_DATA_BETTI_1PCT.clusters)) c1[k] = v.cluster;
        AppState.clustersLISA5pct = c5;
        AppState.clustersLISA1pct = c1;
    } else {
        const c5 = {}, c1 = {};
        for (const [k, v] of Object.entries(LISA_DATA.clusters))     c5[k] = v.cluster;
        for (const [k, v] of Object.entries(LISA_DATA_1PCT.clusters)) c1[k] = v.cluster;
        AppState.clustersLISA5pct = c5;
        AppState.clustersLISA1pct = c1;
    }

    if (AppState.lisaCartesInitialisees) {
        afficherCarteLISA('map-lisa-5pct', 'lisa-5pct', AppState.communeJson, indiceNorm, AppState.clustersLISA5pct, '5%');
        afficherCarteLISA('map-lisa-1pct', 'lisa-1pct', AppState.communeJson, indiceNorm, AppState.clustersLISA1pct, '1%');
    }

    majAffichagePk(pk);
}

/** Met à jour le label du bouton p_k et l'affichage des valeurs. */
function majAffichagePk(pk) {
    const btn  = document.getElementById('btn-toggle-pk');
    const info = document.getElementById('pk-values-display');
    if (!btn || !info) return;
    if (AppState.modeCalculPk === 'betti') {
        btn.textContent = 'p_k : Betti et al. ✓';
        btn.classList.add('active');
        info.textContent = `Opp=${pk[0].toFixed(3)} | Cho=${pk[1].toFixed(3)} | Vec=${pk[2].toFixed(3)}`;
    } else {
        btn.textContent = 'p_k : égal [1,1,1]';
        btn.classList.remove('active');
        info.textContent = 'Pondérations égales (p_k = 1/3 chacun)';
    }
}


// ==============================================================================
// CHARGEMENT DES DONNÉES
// ==============================================================================

/**
 * Charge uniquement un GeoJSON (sans indicateurs).
 * Toutes les communes s'affichent en gris (#cccccc).
 *
 * @param {Object} geojsonData - GeoJSON FeatureCollection
 */
function chargerGeojsonSeulement(geojsonData) {
    if (geojsonData.type !== 'FeatureCollection' || !Array.isArray(geojsonData.features)) {
        throw new Error('GeoJSON invalide : attendu un FeatureCollection.');
    }

    AppState.indicateursOriginaux = {};
    AppState.communeJson          = geojsonData;
    AppState.indicateursCommune  = {};
    AppState.scoresParCommune    = {};
    AppState.indiceFinale        = {};
    AppState.scoresParCommune01  = {};
    AppState.seuilsJenks         = {};
    AppState.modeCalculPk           = 'egal';
    AppState.clustersLISA5pct       = {};
    AppState.clustersLISA1pct       = {};
    AppState.lisaCartesInitialisees = false;

    // Toutes les cartes en gris (dicts vides → #cccccc pour chaque commune)
    afficherToutesLesCartes(geojsonData, {}, {});

    // Remplir le sélecteur avec les noms de features du GeoJSON
    const communeNames = {};
    for (const feature of geojsonData.features) {
        const nom = feature.properties.nom;
        if (nom) communeNames[nom] = {};
    }
    populateCommuneSelect(communeNames);
}


/**
 * Logique commune : initialise l'application à partir des deux objets parsés.
 *
 * @param {Object} dataIndicateurs - JSON des indicateurs
 * @param {Object} geojsonData     - GeoJSON FeatureCollection
 */
function chargerEtAfficher(dataIndicateurs, geojsonData) {
    if (geojsonData.type !== 'FeatureCollection' || !Array.isArray(geojsonData.features)) {
        throw new Error('GeoJSON invalide : attendu un FeatureCollection.');
    }

    AppState.indicateursOriginaux = dataIndicateurs;
    AppState.communeJson          = geojsonData;

    const { indicateursDict, scoresDict, indiceDict, scores01Dict } = parseDataJSON(dataIndicateurs);
    AppState.indicateursCommune  = indicateursDict;
    AppState.scoresParCommune    = scoresDict;
    AppState.indiceFinale        = indiceDict;
    AppState.scoresParCommune01  = scores01Dict;
    AppState.seuilsJenks         = {};    // reset les seuils dynamiques
    AppState.modeCalculPk        = 'egal';

    if (Object.keys(indiceDict).length === 0) {
        throw new Error(
            'Aucune commune trouvée dans le JSON. ' +
            'Le fichier doit contenir les champs "Zone" et "OppChoVec_1_10".'
        );
    }

    const { clusters5pct, clusters1pct } = chargerClustersLISA();
    AppState.clustersLISA5pct = clusters5pct;
    AppState.clustersLISA1pct = clusters1pct;

    // Calcul Jenks dynamique (5 classes) pour les 4 dimensions
    AppState.seuilsJenks['oppchovec'] = calculerJenksBreaks(Object.values(indiceDict), 5);
    AppState.seuilsJenks['opp'] = calculerJenksBreaks(Object.values(scoresDict).map(s => s.Score_Opp), 5);
    AppState.seuilsJenks['cho'] = calculerJenksBreaks(Object.values(scoresDict).map(s => s.Score_Cho), 5);
    AppState.seuilsJenks['vec'] = calculerJenksBreaks(Object.values(scoresDict).map(s => s.Score_Vec), 5);

    afficherToutesLesCartes(AppState.communeJson, AppState.indiceFinale, AppState.scoresParCommune);
    populateCommuneSelect(AppState.indicateursCommune);
}


document.addEventListener('DOMContentLoaded', () => {

    // --- Taille de police sidebar + légendes ---
    let fontSize = 13;
    const setFont = (size) => {
        fontSize = Math.max(9, Math.min(22, size));
        document.documentElement.style.setProperty('--sidebar-fs', fontSize + 'px');
    };
    document.getElementById('btn-font-decrease').addEventListener('click', () => setFont(fontSize - 1));
    document.getElementById('btn-font-reset')   .addEventListener('click', () => setFont(13));
    document.getElementById('btn-font-increase').addEventListener('click', () => setFont(fontSize + 1));

    // --- Toggle p_k ---
    document.getElementById('btn-toggle-pk').addEventListener('click', toggleModePk);

    // --- Description des indicateurs au clic sur une ligne ---
    const descPanel = document.getElementById('indicateur-desc-panel');
    document.getElementById('resultCommune').addEventListener('click', e => {
        const target = e.target.closest('li[data-desc], tr[data-desc]');
        if (!target) { descPanel.style.display = 'none'; return; }
        const desc = target.dataset.desc;
        if (descPanel.style.display === 'block' && descPanel.textContent === desc) {
            descPanel.style.display = 'none';
        } else {
            descPanel.textContent = desc;
            descPanel.style.display = 'block';
        }
    });


    // --- Chargement des données Corse par défaut (fetch) ---
    document.getElementById('loadDefaultBtn').addEventListener('click', async () => {
        try {
            const [textJson, textGeo] = await Promise.all([
                fetch('data/data_indicateurs.json').then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status} pour data_indicateurs.json`);
                    return r.text();
                }),
                fetch('data/Commune_Corse.geojson').then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status} pour Commune_Corse.geojson`);
                    return r.text();
                }),
            ]);

            chargerEtAfficher(JSON.parse(textJson), JSON.parse(textGeo));
            alert('Données Corse chargées. Sélectionnez une commune.');
        } catch (err) {
            alert('Erreur lors du chargement des données par défaut : ' + err.message);
        }
    });


    // --- Validation des fichiers uploadés manuellement ---
    document.getElementById('validateBtn').addEventListener('click', async () => {
        const fileJson    = document.getElementById('file').files[0];
        const fileGeoJson = document.getElementById('file_geojson').files[0];

        if (!fileGeoJson) {
            alert('Veuillez sélectionner au moins un fichier GeoJSON (.geojson).');
            return;
        }

        try {
            const textGeo = await readFileAsText(fileGeoJson);
            const geojson = JSON.parse(textGeo);

            if (fileJson) {
                // Chargement complet : indicateurs + géométrie → cartes choroplèthes
                const textJson = await readFileAsText(fileJson);
                chargerEtAfficher(JSON.parse(textJson), geojson);
                alert('Fichiers chargés. Sélectionnez une commune.');
            } else {
                // GeoJSON seul → toutes les communes en gris
                chargerGeojsonSeulement(geojson);
                alert('GeoJSON chargé (affichage en gris — sans données indicateurs).');
            }
        } catch (err) {
            alert('Erreur : ' + err.message);
        }
    });


    // --- Sélection d'une commune ---
    document.getElementById('validerCommune').addEventListener('click', () => {
        const commune = document.getElementById('communeSelect').value;
        if (!commune) {
            document.getElementById('resultCommune').innerHTML =
                '<p style="color:red;">Veuillez sélectionner une commune.</p>';
            return;
        }
        afficherCommune(commune);
    });


    // --- Navigation par onglets ---
    const tabButtons  = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const cible = this.getAttribute('data-tab');

            tabButtons.forEach(b  => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            this.classList.add('active');
            document.getElementById(cible).classList.add('active');

            if (cible === 'lisatab') initialiserCartesLISA();
            if (cible === 'cahtab')  initialiserCartesCAH();
            if (cible === 'vizutab') {
                const active = document.querySelector('.vizu-subtab-button.active');
                const type   = active ? active.dataset.vizu : 'oppchovec';
                construireHistogrammeJenks(type, `chart-${type}`);
            }

            const type = cible.replace('tab', '');
            if (['opp', 'cho', 'vec'].includes(type)) {
                setTimeout(() => {
                    if (!AppState.cartes[type]) {
                        // Premier clic : créer la carte dans le conteneur maintenant visible
                        if (!AppState.communeJson || Object.keys(AppState.scoresParCommune).length === 0) return;
                        const titres = { opp: 'Score Opp', cho: 'Score Cho', vec: 'Score Vec' };
                        const dicts  = {
                            opp: Object.fromEntries(Object.entries(AppState.scoresParCommune).map(([c, s]) => [c, s.Score_Opp])),
                            cho: Object.fromEntries(Object.entries(AppState.scoresParCommune).map(([c, s]) => [c, s.Score_Cho])),
                            vec: Object.fromEntries(Object.entries(AppState.scoresParCommune).map(([c, s]) => [c, s.Score_Vec])),
                        };
                        afficherCarteUnique(`map-${type}`, type, AppState.communeJson, dicts[type], titres[type]);
                    } else {
                        // Clics suivants : redimensionner et resynchroniser au zoom/centre de référence
                        AppState.cartes[type].invalidateSize();
                    }
                    // Synchroniser au zoom/centre de la carte de référence (oppchovec)
                    const ref = AppState.cartes['oppchovec'];
                    if (ref && AppState.cartes[type]) {
                        AppState.cartes[type].setView(ref.getCenter(), ref.getZoom(), { animate: false });
                    }
                }, 50);
            } else if (type === 'cah') {
                // Onglet CAH : sous-onglets gèrent leurs cartes — juste re-sync la carte active
                setTimeout(() => {
                    const activeCahSubtab = document.querySelector('.cah-subtab-content.active');
                    const cahMapType = activeCahSubtab && activeCahSubtab.id === 'cah5clusters' ? 'cah-5' : 'cah-3';
                    if (AppState.cartes[cahMapType]) {
                        AppState.cartes[cahMapType].invalidateSize();
                        const ref = AppState.cartes['oppchovec'];
                        if (ref) AppState.cartes[cahMapType].setView(ref.getCenter(), ref.getZoom(), { animate: false });
                    }
                }, 50);
            } else if (AppState.cartes[type]) {
                setTimeout(() => AppState.cartes[type].invalidateSize(), 100);
            }
        });
    });


    // --- Navigation par sous-onglets LISA ---
    const lisaSubBtns     = document.querySelectorAll('.lisa-subtab-button');
    const lisaSubContents = document.querySelectorAll('.lisa-subtab-content');

    lisaSubBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const cible = this.getAttribute('data-lisa-tab');

            lisaSubBtns.forEach(b     => b.classList.remove('active'));
            lisaSubContents.forEach(c => c.classList.remove('active'));

            this.classList.add('active');
            document.getElementById(cible).classList.add('active');

            const mapType = cible === 'lisa5pct' ? 'lisa-5pct' : 'lisa-1pct';
            setTimeout(() => {
                if (!AppState.cartes[mapType] && AppState.communeJson) {
                    // Lazy init LISA 1% : créer dans le sous-onglet maintenant visible
                    const clusters = mapType === 'lisa-5pct' ? AppState.clustersLISA5pct : AppState.clustersLISA1pct;
                    const seuil    = mapType === 'lisa-5pct' ? '5%' : '1%';
                    afficherCarteLISA(`map-${mapType}`, mapType, AppState.communeJson, AppState.indiceFinale, clusters, seuil);
                } else if (AppState.cartes[mapType]) {
                    AppState.cartes[mapType].invalidateSize();
                }
                // Synchroniser au zoom/centre de la carte de référence (oppchovec)
                const ref = AppState.cartes['oppchovec'];
                if (ref && AppState.cartes[mapType]) {
                    AppState.cartes[mapType].setView(ref.getCenter(), ref.getZoom(), { animate: false });
                }
            }, 50);
        });
    });


    // --- Navigation par sous-onglets CAH ---
    const cahSubBtns     = document.querySelectorAll('.cah-subtab-button');
    const cahSubContents = document.querySelectorAll('.cah-subtab-content');

    cahSubBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const cible = this.getAttribute('data-cah-tab');

            cahSubBtns.forEach(b     => b.classList.remove('active'));
            cahSubContents.forEach(c => c.classList.remove('active'));

            this.classList.add('active');
            document.getElementById(cible).classList.add('active');

            const mapType = cible === 'cah3clusters' ? 'cah-3' : 'cah-5';
            setTimeout(() => {
                if (!AppState.cartes[mapType] && AppState.communeJson) {
                    // Lazy init cah-5 au premier clic
                    const cahData  = mapType === 'cah-3' ? CAH_DATA_3 : CAH_DATA_5;
                    const nCluster = mapType === 'cah-3' ? 3 : 5;
                    afficherCarteCAH(`map-${mapType}`, mapType, AppState.communeJson, cahData, nCluster);
                } else if (AppState.cartes[mapType]) {
                    AppState.cartes[mapType].invalidateSize();
                }
                // Synchroniser au zoom/centre de la carte de référence
                const ref = AppState.cartes['oppchovec'];
                if (ref && AppState.cartes[mapType]) {
                    AppState.cartes[mapType].setView(ref.getCenter(), ref.getZoom(), { animate: false });
                }
            }, 50);
        });
    });

    // --- Toggle carte / graphique d'écarts (CAH 3) ---
    document.getElementById('toggleCAH3View').addEventListener('click', function () {
        const mapView   = document.getElementById('cah3-map-view');
        const chartView = document.getElementById('cah3-chart-view');
        if (mapView.style.display === 'none') {
            mapView.style.display = 'block';
            chartView.style.display = 'none';
            this.textContent = '\u{1F4CA} Voir les écarts standardisés';
            setTimeout(() => { if (AppState.cartes['cah-3']) AppState.cartes['cah-3'].invalidateSize(); }, 100);
        } else {
            mapView.style.display = 'none';
            chartView.style.display = 'flex';
            this.textContent = '\u{1F5FA}\uFE0F Voir la carte';
        }
    });

    // --- Toggle carte / graphique d'écarts (CAH 5) ---
    document.getElementById('toggleCAH5View').addEventListener('click', function () {
        const mapView   = document.getElementById('cah5-map-view');
        const chartView = document.getElementById('cah5-chart-view');
        if (mapView.style.display === 'none') {
            mapView.style.display = 'block';
            chartView.style.display = 'none';
            this.textContent = '\u{1F4CA} Voir les écarts standardisés';
            setTimeout(() => { if (AppState.cartes['cah-5']) AppState.cartes['cah-5'].invalidateSize(); }, 100);
        } else {
            mapView.style.display = 'none';
            chartView.style.display = 'flex';
            this.textContent = '\u{1F5FA}\uFE0F Voir la carte';
        }
    });


    // --- Sous-onglets Visualisation ---
    document.querySelectorAll('.vizu-subtab-button').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.vizu-subtab-button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.vizu-panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            const type = this.dataset.vizu;
            document.getElementById(`vizu-panel-${type}`).classList.add('active');
            construireHistogrammeJenks(type, `chart-${type}`);
        });
    });


    // --- Injection des légendes LISA dans les placeholders ---
    if (typeof LISA_DATA !== 'undefined' && typeof LISA_DATA_1PCT !== 'undefined') {
        const el5 = document.getElementById('lisa-legend-5pct');
        const el1 = document.getElementById('lisa-legend-1pct');
        if (el5) el5.innerHTML = buildLisaLegendHTML('5%');
        if (el1) el1.innerHTML = buildLisaLegendHTML('1%');
    }


    // --- Réseau routier (chargement lazy par fetch) ---
    ['nationales', 'departementales', 'communales', 'toutes'].forEach(typeRoute => {
        document.getElementById(`checkbox-${typeRoute}`).addEventListener('change', async function () {
            if (this.checked && !AppState.routesGeojson[typeRoute]) {
                // Premier chargement : fetch le GeoJSON
                try {
                    const r = await fetch(`data/routes_${typeRoute}.geojson`);
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    AppState.routesGeojson[typeRoute] = await r.json();
                    // Initialiser les couches sur toutes les cartes déjà créées
                    for (const [mapType, carte] of Object.entries(AppState.cartes)) {
                        if (carte) ajouterReseauRoutier(carte, mapType);
                    }
                } catch (err) {
                    this.checked = false;
                    alert(`Erreur chargement routes ${typeRoute} : ${err.message}`);
                }
            } else {
                // Mettre à jour l'affichage sur toutes les cartes
                for (const [mapType, carte] of Object.entries(AppState.cartes)) {
                    if (carte) mettreAJourAffichageRoutes(carte, mapType);
                }
            }
        });
    });
});


// Exposition sur window pour les onclick inline générés par commune.js
window.recalculerIndice          = recalculerIndice;
window.reinitialiserValeurs      = reinitialiserValeurs;
window.ajusterValeur             = ajusterValeur;
window.afficherComparaison       = afficherComparaison;
window.afficherResultatComparaison = afficherResultatComparaison;
