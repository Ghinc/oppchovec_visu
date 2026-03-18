/**
 * État global de l'application OppChoVec.
 *
 * Remplace les 8+ variables globales de l'original par un objet unique.
 * Toutes les mutations passent par le contrôleur (controller/app.js).
 */

const AppState = {
    // ---- Données chargées depuis l'upload ----

    /** Données JSON brutes uploadées (jamais modifiées après chargement) */
    indicateursOriginaux: {},

    /** Valeurs courantes des indicateurs (modifiables par les sliders) */
    indicateursCommune: {},

    /** Indice OppChoVec 1-10 par nom de commune */
    indiceFinale: {},

    /** Scores des dimensions {Score_Opp, Score_Cho, Score_Vec} par commune */
    scoresParCommune: {},

    /** FeatureCollection GeoJSON des communes de Corse */
    communeJson: null,

    // ---- Données LISA ----

    /** Clusters LISA à seuil 5% {nom_commune: type_cluster} */
    clustersLISA5pct: {},

    /** Clusters LISA à seuil 1% {nom_commune: type_cluster} */
    clustersLISA1pct: {},

    // ---- Pondération p_k dynamique ----

    /** Mode de calcul des poids : 'egal' → [1,1,1] | 'betti' → Betti et al. */
    modeCalculPk: 'egal',

    /** Scores des 3 dimensions normalisés 0-1 (Score_Dim / 10) — utilisés pour Betti */
    scoresParCommune01: {},

    /** Seuils Jenks recalculés dynamiquement après changement p_k {type: [...]} */
    seuilsJenks: {},

    // ---- Réseau routier ----

    /** GeoJSON de chaque type de route (null = pas encore chargé) */
    routesGeojson: { nationales: null, departementales: null, communales: null, toutes: null },

    /** Couches Leaflet de routes par mapType puis par typeRoute */
    routesLayers: {},

    // ---- État de l'interface ----

    /** Comparaison en cours {commune1, commune2} ou null */
    comparaisonEnCours: null,

    /** Noms des communes actuellement surlignées sur la carte */
    communesHighlightees: [],

    /** Vrai si les cartes LISA ont été initialisées (lazy loading) */
    lisaCartesInitialisees: false,

    /** Vrai si les cartes CAH ont été initialisées (lazy loading) */
    cahCartesInitialisees: false,

    // ---- Instances Leaflet ----

    /** Instances de cartes Leaflet {type: L.Map | null} */
    cartes: {
        oppchovec:  null,
        opp:        null,
        cho:        null,
        vec:        null,
        'lisa-5pct': null,
        'lisa-1pct': null,
        'cah-3':     null,
        'cah-5':     null,
    },

    /** Couches GeoJSON actives {type: L.GeoJSON | null} */
    geojsonLayers: {
        oppchovec:  null,
        opp:        null,
        cho:        null,
        vec:        null,
        'lisa-5pct': null,
        'lisa-1pct': null,
        'cah-3':     null,
        'cah-5':     null,
    },

    /** Contrôles de légende Leaflet {type: L.Control | null} */
    legendControls: {
        oppchovec:  null,
        opp:        null,
        cho:        null,
        vec:        null,
        'lisa-5pct': null,
        'lisa-1pct': null,
        'cah-3':     null,
        'cah-5':     null,
    },

    /** Couches Leaflet indexées par nom de commune (carte oppchovec uniquement) */
    communeLayers: {},
};
