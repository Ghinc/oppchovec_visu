/**
 * Configuration centralisée du frontend OppChoVec.
 *
 * Consolide tous les paramètres qui étaient éparpillés dans script.js :
 *  - Constantes cartographiques
 *  - Seuils de Jenks et palettes de couleurs
 *  - Paramètres algorithmiques (pour le recalcul côté client)
 *  - Métadonnées des indicateurs (descriptions, bornes, pas)
 */

// ==============================================================================
// CARTE
// ==============================================================================

/** Centre de la Corse (WGS84) */
const MAP_CENTER = [42.0396, 9.0129];
const MAP_ZOOM   = 8;

/** Villes principales de Corse (marqueurs + labels sur les cartes) */
const VILLES_PRINCIPALES = [
    { nom: 'Ajaccio',       lat: 41.9267, lng: 8.7369, labelOffset: { lat: -0.15, lng: -0.25 } },
    { nom: 'Bastia',        lat: 42.7028, lng: 9.4503, labelOffset: { lat:  0.15, lng:  0.20 } },
    { nom: 'Corte',         lat: 42.3063, lng: 9.1508, labelOffset: { lat:  0.0,  lng:  0.70 } },
    { nom: 'Porto-Vecchio', lat: 41.5914, lng: 9.2795, labelOffset: { lat:  0.0,  lng:  0.30 } },
    { nom: 'Calvi',         lat: 42.5677, lng: 8.7575, labelOffset: { lat:  0.15, lng: -0.25 } },
];

// ==============================================================================
// CLASSIFICATION JENKS (4 classes, échelle 1-10)
// ==============================================================================

/** Seuils de rupture naturelle calculés sur les données normalisées 1-10 */
const SEUILS_JENKS = {
    oppchovec: [3.592, 5.029, 7.105],
    opp:       [3.929, 6.140, 7.116],
    cho:       [5.556, 7.579, 9.023],
    vec:       [4.636, 6.074, 7.946]
};

/** Palette rouge → orange → jaune → vert foncé */
const COLORS_JENKS = ["#d73027", "#fc8d59", "#fee08b", "#1a9850"];

/** Labels des classes pour les légendes */
const LABELS_JENKS = {
    oppchovec: ['≤ 3.6', '3.6 – 5.0', '5.0 – 7.1', '> 7.1'],
    opp:       ['≤ 3.9', '3.9 – 6.1', '6.1 – 7.1', '> 7.1'],
    cho:       ['≤ 5.6', '5.6 – 7.6', '7.6 – 9.0', '> 9.0'],
    vec:       ['≤ 4.6', '4.6 – 6.1', '6.1 – 7.9', '> 7.9']
};

// ==============================================================================
// ANALYSE LISA
// ==============================================================================

/** Couleurs des clusters LISA */
const COLORS_LISA = {
    'HH (High-High)':   '#d73027',
    'LL (Low-Low)':     '#4575b4',
    'LH (Low-High)':    '#abd9e9',
    'HL (High-Low)':    '#fdae61',
    'Non significatif': '#d9d9d9'
};

// ==============================================================================
// ALGORITHME (miroir de python/config.py pour le recalcul côté client)
// ==============================================================================

const ALPHA = 2.5;
const BETA  = 1.5;

const PONDERATIONS = {
    Opp: { Opp1: 0.25, Opp2: 0.25, Opp3: 0.25, Opp4: 0.25 },
    Cho: { Cho1: 0.50, Cho2: 0.50 },
    Vec: { Vec1: 0.25, Vec2: 0.25, Vec3: 0.25, Vec4: 0.25 }
};

// ==============================================================================
// MÉTADONNÉES DES INDICATEURS
// Remplace les deux dictionnaires `descriptionsIndicateurs` dupliqués dans l'original
// et consolide `stepsParIndicateur` + `bornesParIndicateur`.
// ==============================================================================

const INDICATEURS_META = {
    Indicateur_Opp1: {
        label:       'Opp1 – Niveau d\'éducation',
        description: 'Avoir une bonne éducation. Se traduit par le niveau de diplôme de la population sur une échelle de 1 à 7.',
        step: 0.1,  min: 1,     max: 7
    },
    Indicateur_Opp2: {
        label:       'Opp2 – Diversité sociale (Theil)',
        description: 'Représente l\'indice de Theil qui mesure les inégalités et les proportions des catégories socioprofessionnelles.',
        step: 0.01, min: 0,     max: 1
    },
    Indicateur_Opp3: {
        label:       'Opp3 – Mobilité',
        description: 'Avoir les moyens de mobilité. Score basé sur la proportion de ménages avec voiture et l\'accès aux transports.',
        step: 1,    min: 0,     max: 300
    },
    Indicateur_Opp4: {
        label:       'Opp4 – Accès TIC',
        description: 'Avoir accès aux TIC. Moyenne de la couverture 4G, Internet haut débit et fibre.',
        step: 1,    min: 0,     max: 100
    },
    Indicateur_Cho1: {
        label:       'Cho1 – Quartiers prioritaires',
        description: 'Ne pas être discriminé. Calculé avec exp(−pourcentage_population_quartiers_prioritaires).',
        step: 0.01, min: 0,     max: 1
    },
    Indicateur_Cho2: {
        label:       'Cho2 – Participation électorale',
        description: 'Avoir les moyens d\'influencer les décisions politiques. Proportion d\'inscrits sur les listes électorales.',
        step: 1,    min: 0,     max: 100
    },
    Indicateur_Vec1: {
        label:       'Vec1 – Revenu médian',
        description: 'Avoir un revenu décent. Revenu fiscal médian de la commune.',
        step: 100,  min: 15000, max: 30000
    },
    Indicateur_Vec2: {
        label:       'Vec2 – Qualité du logement',
        description: 'Avoir un logement décent. Score basé sur le confort, la densité d\'occupation et le type de logement.',
        step: 0.01, min: 0,     max: 1
    },
    Indicateur_Vec3: {
        label:       'Vec3 – Stabilité de l\'emploi',
        description: 'Stabilité de l\'emploi. Score basé sur la répartition des types de contrats et statuts d\'emploi.',
        step: 0.01, min: 0,     max: 1
    },
    Indicateur_Vec4: {
        label:       'Vec4 – Accès aux services',
        description: 'Être proche des services. Nombre de services de vie courante accessibles en moins de 20 min.',
        step: 1,    min: 0,     max: 20
    }
};
