// Onglet « Évolution » : indice OppChoVec comparable pour 2016 et 2021 (données : serie_temporelle.json, construire_serie_temporelle.py).
// Trois cartes (2016, 2021, évolution), mêmes seuils de couleur pour les deux années, fiche commune au clic.
// Chargé avant script.js ; les globales de script.js (communeJson, colorsJenks, ajouterCopyright, BASE_PATH) ne sont lues qu'à l'appel.

const EVOLUTION_VARIABLES = {
    OppChoVec: 'Indice OppChoVec',
    Opp: 'Opportunités (Opp)',
    Cho: 'Choix (Cho)',
    Vec: 'Vécu (Vec)',
};
const EVOLUTION_NOMS_INDICATEURS = {
    Opp1: 'Opp1 · niveau de diplôme (1-4)', Opp2: 'Opp2 · diversité sociale (Theil)', Opp3: 'Opp3 · mobilité',
    Cho2: 'Cho2 · droit de vote (proxy : part de Français, 18 ans et plus, %)', Vec1: 'Vec1 · médiane du niveau de vie (€)', Vec2: 'Vec2 · logement', Vec3: 'Vec3 · stabilité de l\'emploi',
};
// Carte d'évolution (points sur 10) : classes de Jenks (5) calculées sur les 360 variations de la variable affichée (seuils_jenks_variation dans serie_temporelle.json).
// Couleurs : la classe qui contient 0 est neutre (blanc), les classes en dessous sont rouges (recul), celles au-dessus bleues (progression) : le signe reste lisible même si les classes ne sont pas centrées sur 0.
const EVOLUTION_NEUTRE = '#f0f0f0';
const EVOLUTION_ROUGES = { 1: ['#ef8a62'], 2: ['#b2182b', '#ef8a62'], 3: ['#b2182b', '#ef8a62', '#f6b79a'], 4: ['#b2182b', '#d6604d', '#ef8a62', '#f6b79a'] };     // du plus négatif au moins négatif
const EVOLUTION_BLEUS = { 1: ['#67a9cf'], 2: ['#67a9cf', '#2166ac'], 3: ['#9ecae1', '#4393c3', '#2166ac'], 4: ['#a6cee3', '#6baed6', '#3182bd', '#08519c'] };   // du moins positif au plus positif
// Seuils de ±0,5 point : uniquement pour compter les communes « en progression / stables / en recul » dans le résumé chiffré
const EVOLUTION_SEUILS_VARIATION = [-1.5, -0.5, 0.5, 1.5];

let evolutionDonnees = null;
let evolutionInitialise = false;
let evolutionCartes = {};          // { 2016, 2021, variation } : cartes Leaflet
let evolutionCouches = {};         // couches GeoJSON
let evolutionVariable = 'OppChoVec';
let evolutionSelection = null;

// ---------- Calculs purs ----------

function evolutionClasse(valeur, seuilsInternes) {
    for (let i = 0; i < seuilsInternes.length; i++) if (valeur <= seuilsInternes[i]) return i;
    return seuilsInternes.length;
}

// Une couleur par classe de Jenks de la variation (seuilsInternes : les 4 seuils intérieurs, croissants)
function evolutionCouleursVariation(seuilsInternes) {
    const n = seuilsInternes.length + 1;
    const zero = evolutionClasse(0, seuilsInternes);            // classe qui contient 0
    const nbNeg = zero, nbPos = n - zero - 1;
    const rouges = nbNeg ? EVOLUTION_ROUGES[Math.min(nbNeg, 4)].slice(-nbNeg) : [];
    const bleus = nbPos ? EVOLUTION_BLEUS[Math.min(nbPos, 4)].slice(-nbPos) : [];
    return [...rouges, EVOLUTION_NEUTRE, ...bleus];
}

// Valeur d'une variable pour une commune et une année ; variation = 2021 - 2016
function evolutionValeur(donnees, commune, annee, variable) {
    return donnees.communes[commune][String(annee)].scores_0_10[variable];
}

function evolutionVariation(donnees, commune, variable) {
    const [a0, a1] = donnees.annees;
    return evolutionValeur(donnees, commune, a1, variable) - evolutionValeur(donnees, commune, a0, variable);
}

function evolutionResume(donnees, variable) {
    const noms = Object.keys(donnees.communes);
    const [a0, a1] = donnees.annees;
    const v0 = noms.map(c => evolutionValeur(donnees, c, a0, variable));
    const v1 = noms.map(c => evolutionValeur(donnees, c, a1, variable));
    const var_ = noms.map((c, i) => v1[i] - v0[i]);
    const tri = noms.map((c, i) => ({ commune: c, variation: var_[i] })).sort((x, y) => y.variation - x.variation);
    const moyenne = t => t.reduce((s, x) => s + x, 0) / t.length;
    return {
        n: noms.length, moyenne0: moyenne(v0), moyenne1: moyenne(v1), variationMoyenne: moyenne(var_),
        progressions: var_.filter(x => x > EVOLUTION_SEUILS_VARIATION[2]).length,
        reculs: var_.filter(x => x < EVOLUTION_SEUILS_VARIATION[1]).length,
        stables: var_.filter(x => x >= EVOLUTION_SEUILS_VARIATION[1] && x <= EVOLUTION_SEUILS_VARIATION[2]).length,
        meilleures: tri.slice(0, 5), pires: tri.slice(-5).reverse(),
    };
}

// Détail du calcul d'une commune (mêmes formules que construire_serie_temporelle.py) :
//   indicateur normalisé = (x - min) / (max - min) sur l'échelle commune aux deux années ; dimension (0-1) = moyenne des indicateurs normalisés de la dimension ;
//   S = Σ p_k × dimension_k^β ; indice brut = (1/3) × S^(α/β) ; score 0-10 = (valeur - min) / (max - min) × 10, min et max pris sur toutes les communes des deux années.
const EVOLUTION_ALPHA = 2.5, EVOLUTION_BETA = 1.5;

function evolutionCalcul(donnees, commune, annee) {
    const ind = donnees.communes[commune][String(annee)].indicateurs;
    const norm = {};
    for (const k of donnees.indicateurs) {
        const [lo, hi] = donnees.echelle[k];
        norm[k] = hi !== lo ? (ind[k] - lo) / (hi - lo) : 0;
    }
    const dim = {};
    for (const [nom, ks] of Object.entries(donnees.dimensions)) dim[nom] = ks.reduce((s, k) => s + norm[k], 0) / ks.length;
    const somme = Object.entries(donnees.dimensions).reduce((s, [nom]) => s + donnees.p_k_betti[nom] * dim[nom] ** EVOLUTION_BETA, 0);
    return { norm, dim, somme, brut: (1 / 3) * somme ** (EVOLUTION_ALPHA / EVOLUTION_BETA) };
}

const evolutionCacheEchelles = new WeakMap();
function evolutionEchellesScores(donnees) {                     // min et max de l'indice brut et de chaque dimension, toutes communes et toutes années
    if (evolutionCacheEchelles.has(donnees)) return evolutionCacheEchelles.get(donnees);
    const e = { OppChoVec: [Infinity, -Infinity] };
    for (const nom of Object.keys(donnees.dimensions)) e[nom] = [Infinity, -Infinity];
    for (const commune of Object.keys(donnees.communes)) for (const annee of donnees.annees) {
        const c = evolutionCalcul(donnees, commune, annee);
        const valeurs = { OppChoVec: c.brut, ...c.dim };
        for (const [cle, v] of Object.entries(valeurs)) { e[cle][0] = Math.min(e[cle][0], v); e[cle][1] = Math.max(e[cle][1], v); }
    }
    evolutionCacheEchelles.set(donnees, e);
    return e;
}

function evolutionDetails(donnees, commune) {
    const [a0, a1] = donnees.annees;
    const c0 = evolutionCalcul(donnees, commune, a0), c1 = evolutionCalcul(donnees, commune, a1);
    const ech = evolutionEchellesScores(donnees);
    const sur10 = (x, cle) => (x - ech[cle][0]) / (ech[cle][1] - ech[cle][0]) * 10;
    const dimensions = Object.entries(donnees.dimensions).map(([nom, ks]) => {
        const [lo, hi] = ech[nom], n = ks.length;
        return {
            nom, poids: donnees.p_k_betti[nom], d0: c0.dim[nom], d1: c1.dim[nom], score0: sur10(c0.dim[nom], nom), score1: sur10(c1.dim[nom], nom),
            contributionSomme: donnees.p_k_betti[nom] * (c1.dim[nom] ** EVOLUTION_BETA - c0.dim[nom] ** EVOLUTION_BETA),
            indicateurs: ks.map(k => ({
                cle: k, brut0: donnees.communes[commune][String(a0)].indicateurs[k], brut1: donnees.communes[commune][String(a1)].indicateurs[k],
                norm0: c0.norm[k], norm1: c1.norm[k], contributionPoints: (c1.norm[k] - c0.norm[k]) / n / (hi - lo) * 10,       // somme des contributions = variation du score de la dimension (0-10)
            })),
        };
    });
    return { indice: { somme0: c0.somme, somme1: c1.somme, brut0: c0.brut, brut1: c1.brut, score0: sur10(c0.brut, 'OppChoVec'), score1: sur10(c1.brut, 'OppChoVec') }, dimensions };
}

// Composantes d'un indicateur brut (donnees.communes[c][année].composantes, produites par construire_serie_temporelle.py) :
// pour chaque sous-quantité, sa valeur aux deux dates et sa contribution à l'écart de l'indicateur ; la somme des contributions est exactement l'écart de l'indicateur.
const EVOLUTION_NIVEAUX = ['Niveau 1 · aucun diplôme ou brevet', 'Niveau 2 · CAP, BEP', 'Niveau 3 · baccalauréat', 'Niveau 4 · enseignement supérieur'];
const EVOLUTION_CSP = ['Agriculteurs exploitants', 'Artisans, commerçants, chefs d\'entreprise', 'Cadres et professions intellectuelles supérieures', 'Professions intermédiaires',
    'Employés', 'Ouvriers', 'Retraités', 'Autres personnes sans activité professionnelle'];
const EVOLUTION_STATUTS = [['chom', 'Chômeurs (15-64 ans)', 0], ['aide', 'Emplois aidés', 0.25], ['ponctuel', 'Intérim et apprentis', 0.5], ['cdd', 'CDD', 0.75], ['stable', 'CDI et non-salariés', 1]];

function evolutionComposantes(donnees, commune, cle) {
    const [a0, a1] = donnees.annees;
    const c = [donnees.communes[commune][String(a0)], donnees.communes[commune][String(a1)]];
    const k = c.map(x => x.composantes[cle] || {});
    const ind = c.map(x => x.indicateurs[cle]);
    const somme = o => Object.values(o).reduce((t, v) => t + v, 0);
    const lignes = [];
    const ligne = (libelle, v0, v1, dec, contribution, decContribution = 3, unite = '') => lignes.push({ libelle, v0, v1, dec, unite, contribution, decContribution });
    let intro = '', note = '', colonne = 'Valeur';
    if (cle === 'Opp1') {
        intro = 'Opp1 = niveau de diplôme moyen des 18 ans et plus non scolarisés = Σ niveau × part du niveau (1 à 4). Contribution d\'un niveau = niveau × écart de sa part.';
        colonne = 'Part des 18 ans et plus (%)';
        EVOLUTION_NIVEAUX.forEach((lib, i) => {
            const p = k.map(o => 100 * o['niveau' + (i + 1)] / somme(o));
            ligne(lib, p[0], p[1], 1, (i + 1) * (p[1] - p[0]) / 100, 3, '%');
        });
        note = 'Le détail à 7 niveaux n\'existe pas en 2016 : les niveaux sont regroupés en 4 pour les deux dates.';
    } else if (cle === 'Opp2') {
        intro = 'Opp2 = indice de Theil sur les 8 catégories socioprofessionnelles des 15 ans et plus = Σ (x/μ) ln(x/μ) / 8, où x est l\'effectif d\'une catégorie et μ la moyenne des 8 effectifs. Plus l\'indice est élevé, plus la répartition est inégale. Contribution d\'une catégorie = écart de son terme (x/μ) ln(x/μ) / 8.';
        colonne = 'Part des 15 ans et plus (%)';
        const terme = (o, i) => { const x = o['cs' + (i + 1)], mu = somme(o) / 8; return x > 0 ? (x / mu) * Math.log(x / mu) / 8 : 0; };
        EVOLUTION_CSP.forEach((lib, i) => {
            const p = k.map(o => 100 * o['cs' + (i + 1)] / somme(o));
            ligne(lib, p[0], p[1], 1, terme(k[1], i) - terme(k[0], i), 4, '%');
        });
        note = 'Une catégorie dont la part s\'éloigne de la moyenne (12,5 %) fait monter l\'indice ; un rapprochement le fait baisser.';
    } else if (cle === 'Opp3') {
        intro = 'Opp3 = part des ménages ayant au moins une voiture (%) + 100 si des actifs occupés vont travailler en transports en commun + 100 pour les trois villes qui ont un réseau de bus (Ajaccio, Bastia, Porto-Vecchio).';
        ligne('Ménages ayant au moins une voiture (%)', k[0].part_voiture, k[1].part_voiture, 1, k[1].part_voiture - k[0].part_voiture, 1, '%');
        ligne('Actifs occupés allant travailler en transports en commun (+100 si oui)', k[0].transport_commun, k[1].transport_commun, 0, k[1].transport_commun - k[0].transport_commun, 0);
        ligne('Ville dotée d\'un réseau de bus (+100 si oui, inchangé)', k[0].reseau_bus, k[1].reseau_bus, 0, k[1].reseau_bus - k[0].reseau_bus, 0);
    } else if (cle === 'Cho2') {
        intro = 'Cho2 = part des Français parmi les 18 ans et plus = 100 − part des étrangers de 18 ans et plus (plafonné à 100). C\'est un proxy du droit de vote : il ne tient compte ni de l\'inscription sur les listes électorales ni du vote des ressortissants européens aux municipales.';
        ligne('Population totale', k[0].population, k[1].population, 0, null);
        ligne('Étrangers de 18 ans et plus (estimés)', k[0].etrangers_18p, k[1].etrangers_18p, 0, null);
        const part = k.map(o => 100 * o.etrangers_18p / o.population);
        ligne('Part d\'étrangers parmi la population (%)', part[0], part[1], 2, ind[1] - ind[0], 2, '%');
        note = 'Étrangers de 18 ans et plus = population de 18 à 24 ans − 0,7 × Français de 15 à 24 ans + étrangers de 25 ans et plus (tables INSEE POP1B et NAT1). Une hausse de cette part fait baisser Cho2.';
    } else if (cle === 'Vec1') {
        intro = 'Vec1 = médiane du niveau de vie (Filosofi, INSEE), en euros courants (non corrigés de l\'inflation). C\'est un indicateur direct : il n\'a pas de sous-composantes.';
        note = [a0, a1].filter((a, i) => c[i].vec1_departementale).length
            ? `La médiane n'est pas diffusée pour cette commune en ${[a0, a1].filter((a, i) => c[i].vec1_departementale).join(' et ')} : valeur du département.` : 'Médiane propre à la commune aux deux dates.';
    } else if (cle === 'Vec2') {
        intro = 'Vec2 = [ exp(−personnes par pièce) + (part de logements avec salle de bain + chauffage) / 2 + part de maisons ] / 3, avec chauffage = 1 (constant, comme dans les données actuelles). Contribution = écart du terme correspondant dans cette formule.';
        ligne('Personnes par pièce (terme exp(−x) / 3)', k[0].personnes_par_piece, k[1].personnes_par_piece, 2, (Math.exp(-k[1].personnes_par_piece) - Math.exp(-k[0].personnes_par_piece)) / 3, 4);
        ligne('Résidences principales avec salle de bain (%, terme / 6)', 100 * k[0].part_sdb, 100 * k[1].part_sdb, 1, (k[1].part_sdb - k[0].part_sdb) / 6, 4, '%');
        ligne('Maisons parmi les résidences principales (%, terme / 3)', 100 * k[0].part_maisons, 100 * k[1].part_maisons, 1, (k[1].part_maisons - k[0].part_maisons) / 3, 4, '%');
        note = 'Moins de personnes par pièce (plus d\'espace) fait monter l\'indice.';
    } else if (cle === 'Vec3') {
        intro = 'Vec3 = stabilité de l\'emploi = Σ poids × part du statut : chômeurs 0, emplois aidés 0,25, intérim et apprentis 0,5, CDD 0,75, CDI et non-salariés 1. Contribution d\'un statut = poids × écart de sa part.';
        colonne = 'Part des actifs (%)';
        EVOLUTION_STATUTS.forEach(([cl, lib, poids]) => {
            const p = k.map(o => 100 * o[cl] / somme(o));
            ligne(`${lib} (poids ${evolutionFmt(poids, 2)})`, p[0], p[1], 1, poids * (p[1] - p[0]) / 100, 4, '%');
        });
    }
    return { cle, intro, note, colonne, lignes, total: { v0: ind[0], v1: ind[1], dec: EVOLUTION_DECIMALES[cle] ?? (cle === 'Opp2' || cle === 'Vec2' || cle === 'Vec3' ? 3 : 2) } };
}

// ---------- Affichage ----------

function evolutionEchapper(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const evolutionFmt = (x, d = 2) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

function evolutionCouleurAnnee(valeur) {
    return colorsJenks[evolutionClasse(valeur, evolutionDonnees.seuils_jenks[evolutionVariable])];
}
function evolutionCouleurVariation(v) {
    const seuils = evolutionDonnees.seuils_jenks_variation[evolutionVariable];
    return evolutionCouleursVariation(seuils)[evolutionClasse(v, seuils)];
}

function evolutionStyle(type, nom) {
    const d = evolutionDonnees;
    const [a0, a1] = d.annees;
    const fill = type === 'variation'
        ? evolutionCouleurVariation(evolutionVariation(d, nom, evolutionVariable))
        : evolutionCouleurAnnee(evolutionValeur(d, nom, type === 'a0' ? a0 : a1, evolutionVariable));
    return { fillColor: fill, color: nom === evolutionSelection ? '#d00000' : '#333', weight: nom === evolutionSelection ? 2.5 : 0.7, fillOpacity: 0.85 };
}

function evolutionInfobulle(type, nom) {
    const d = evolutionDonnees;
    const [a0, a1] = d.annees;
    const v0 = evolutionValeur(d, nom, a0, evolutionVariable), v1 = evolutionValeur(d, nom, a1, evolutionVariable);
    const base = `<strong>${evolutionEchapper(nom)}</strong><br>${a0} : ${evolutionFmt(v0)} · ${a1} : ${evolutionFmt(v1)}`;
    return type === 'variation' ? `${base}<br>Évolution : ${v1 - v0 >= 0 ? '+' : ''}${evolutionFmt(v1 - v0)}` : base;
}

function evolutionLegendes() {
    const d = evolutionDonnees;
    const s = d.seuils_jenks[evolutionVariable];
    const lib = [`≤ ${evolutionFmt(s[0])}`, ...s.slice(1).map((x, i) => `${evolutionFmt(s[i])} – ${evolutionFmt(x)}`), `> ${evolutionFmt(s[s.length - 1])}`];
    const pastille = c => `<span class="evolution-pastille" style="background:${c}"></span>`;
    document.getElementById('evolution-legende-annees').innerHTML =
        `<strong>${EVOLUTION_VARIABLES[evolutionVariable]} (0-10), mêmes classes pour ${d.annees[0]} et ${d.annees[1]}</strong> ` +
        lib.map((l, i) => `<span class="evolution-classe">${pastille(colorsJenks[i])}${l}</span>`).join('');
    const sv = d.seuils_jenks_variation[evolutionVariable];
    const signe = x => (x > 0 ? '+' : x < 0 ? '−' : '') + evolutionFmt(Math.abs(x));
    const zero = evolutionClasse(0, sv);
    const libVar = [`≤ ${signe(sv[0])}`, ...sv.slice(1).map((x, i) => `${signe(sv[i])} – ${signe(x)}`), `> ${signe(sv[sv.length - 1])}`];
    const couleursVar = evolutionCouleursVariation(sv);
    document.getElementById('evolution-legende-variation').innerHTML =
        `<strong>Évolution ${d.annees[0]} → ${d.annees[1]} (points sur 10), classes de Jenks</strong> ` +
        libVar.map((l, i) => `<span class="evolution-classe">${pastille(couleursVar[i])}${l}${i === zero ? ' (contient 0)' : ''}</span>`).join('');
}

function evolutionResumeHtml() {
    const d = evolutionDonnees;
    const r = evolutionResume(d, evolutionVariable);
    const [a0, a1] = d.annees;
    const ligne = e => `${evolutionEchapper(e.commune)} (${e.variation >= 0 ? '+' : ''}${evolutionFmt(e.variation)})`;
    document.getElementById('evolution-resume').innerHTML =
        `<div><strong>${EVOLUTION_VARIABLES[evolutionVariable]}</strong> : moyenne ${a0} <strong>${evolutionFmt(r.moyenne0)}</strong> → ${a1} <strong>${evolutionFmt(r.moyenne1)}</strong> ` +
        `(${r.variationMoyenne >= 0 ? '+' : ''}${evolutionFmt(r.variationMoyenne)}).</div>` +
        `<div>${r.progressions} communes en progression, ${r.stables} stables, ${r.reculs} en recul (seuil ±0,5 point).</div>` +
        `<div class="evolution-petit">Plus fortes progressions : ${r.meilleures.map(ligne).join(' ; ')}<br>Plus forts reculs : ${r.pires.map(ligne).join(' ; ')}</div>`;
}

const evolutionDetailsOuverts = new Set();     // scores dont le détail est déplié (conservé quand on change de commune)

const EVOLUTION_DECIMALES = { Opp3: 0, Vec1: 0 };
const evolutionSigne = (x, dec) => { const r = Number(x.toFixed(dec)); return (r > 0 ? '+' : '') + evolutionFmt(r === 0 ? 0 : x, dec); };   // jamais de « −0,00 »       // « + » seulement si l'écart arrondi est positif
function evolutionFleche(x, dec) {
    const r = Number(x.toFixed(dec));
    return r > 0 ? '<span class="evolution-hausse" title="en hausse">▲</span>' : r < 0 ? '<span class="evolution-baisse" title="en baisse">▼</span>' : '<span class="evolution-egal" title="inchangé">＝</span>';
}

// Détail d'un score : comment il est calculé et ce qui a fait monter ou baisser (contributions de chaque dimension ou indicateur)
function evolutionDetailHtml(variable, nom) {
    const d = evolutionDonnees;
    const [a0, a1] = d.annees;
    const det = evolutionDetails(d, nom);
    const f3 = x => evolutionFmt(x, 3);
    const b1 = evolutionFmt(EVOLUTION_BETA, 1), al1 = evolutionFmt(EVOLUTION_ALPHA, 1);
    if (variable === 'OppChoVec') {
        const i = det.indice;
        const lignes = det.dimensions.map(x => {
            const dd = x.d1 - x.d0;
            const part = Math.abs(i.somme1 - i.somme0) > 1e-9 ? `${evolutionSigne(100 * x.contributionSomme / (i.somme1 - i.somme0), 0)} %` : '—';
            return `<tr><td>${evolutionFleche(dd, 3)} ${EVOLUTION_VARIABLES[x.nom]}</td><td>${evolutionFmt(x.poids, 3)}</td><td>${f3(x.d0)}</td><td>${f3(x.d1)}</td><td>${evolutionSigne(dd, 3)}</td><td><strong>${evolutionSigne(x.contributionSomme, 3)}</strong></td><td>${part}</td></tr>`;
        }).join('');
        return `<div class="evolution-petit">Indice brut = ⅓ × (Σ p<sub>k</sub> × d<sub>k</sub><sup>${b1}</sup>)<sup>${al1}/${b1}</sup>, où d<sub>k</sub> est la dimension (0-1) et p<sub>k</sub> son poids (Betti et al., 2008) ; puis ramené à 0-10 (min-max sur les deux années).</div>` +
            `<table class="evolution-table evolution-table-detail"><tr><th>Dimension</th><th>p<sub>k</sub></th><th>d<sub>k</sub> ${a0}</th><th>d<sub>k</sub> ${a1}</th><th>Écart</th><th>Contribution à ΔS</th><th>Part</th></tr>${lignes}` +
            `<tr class="evolution-total"><td>Somme S = Σ p<sub>k</sub> d<sub>k</sub><sup>${b1}</sup></td><td></td><td>${f3(i.somme0)}</td><td>${f3(i.somme1)}</td><td></td><td><strong>${evolutionSigne(i.somme1 - i.somme0, 3)}</strong></td><td></td></tr>` +
            `<tr class="evolution-total"><td>Indice brut = ⅓ S<sup>${evolutionFmt(EVOLUTION_ALPHA / EVOLUTION_BETA, 2)}</sup></td><td></td><td>${f3(i.brut0)}</td><td>${f3(i.brut1)}</td><td>${evolutionSigne(i.brut1 - i.brut0, 3)}</td><td></td><td></td></tr>` +
            `<tr class="evolution-total"><td>Score 0-10</td><td></td><td>${evolutionFmt(i.score0)}</td><td>${evolutionFmt(i.score1)}</td><td><strong>${evolutionSigne(i.score1 - i.score0, 2)}</strong></td><td></td><td></td></tr></table>` +
            `<div class="evolution-petit">▲ dimension en hausse, ▼ en baisse. La part indique la contribution de chaque dimension à la variation de S ; l'indice n'étant pas une somme (exposants), les contributions ne s'additionnent pas exactement en points sur 10.</div>`;
    }
    const x = det.dimensions.find(z => z.nom === variable);
    const lignes = x.indicateurs.map(ind => {
        const dec = EVOLUTION_DECIMALES[ind.cle] ?? 2;
        return `<tr><td>${evolutionFleche(ind.contributionPoints, 2)} ${EVOLUTION_NOMS_INDICATEURS[ind.cle]}</td><td>${evolutionFmt(ind.brut0, dec)}</td><td>${evolutionFmt(ind.brut1, dec)}</td><td>${f3(ind.norm0)}</td><td>${f3(ind.norm1)}</td><td><strong>${evolutionSigne(ind.contributionPoints, 2)}</strong></td></tr>`;
    }).join('');
    const n = x.indicateurs.length;
    return `<div class="evolution-petit">Dimension ${EVOLUTION_VARIABLES[variable]} = ${n > 1 ? `moyenne des ${n} indicateurs normalisés` : 'indicateur unique, normalisé'} (min-max entre 0 et 1 sur les deux années), puis ramenée à 0-10 (min-max sur les deux années). ` +
        `Contribution = écart du normalisé ÷ ${n}, en points sur 10 : leur somme est exactement l'évolution du score.</div>` +
        `<table class="evolution-table evolution-table-detail"><tr><th>Indicateur</th><th>Brut ${a0}</th><th>Brut ${a1}</th><th>Normalisé ${a0}</th><th>Normalisé ${a1}</th><th>Contribution (points)</th></tr>${lignes}` +
        `<tr class="evolution-total"><td>Score de la dimension (0-10)</td><td></td><td></td><td>${evolutionFmt(x.score0)}</td><td>${evolutionFmt(x.score1)}</td><td><strong>${evolutionSigne(x.score1 - x.score0, 2)}</strong></td></tr></table>` +
        (variable === 'Cho' ? `<div class="evolution-petit">Cho2 est un proxy du droit de vote : la part de Français parmi les 18 ans et plus approche la part des personnes qui peuvent voter dans la commune (elle ne tient compte ni de l'inscription sur les listes électorales ni du vote des ressortissants européens aux municipales).</div>` : '');
}

// Détail d'un indicateur brut : formule, valeur de chaque composante aux deux dates et contribution à l'écart
function evolutionIndicateurHtml(cle, nom) {
    const d = evolutionDonnees;
    const [a0, a1] = d.annees;
    const x = evolutionComposantes(d, nom, cle);
    const dim = Object.entries(d.dimensions).find(([, ks]) => ks.includes(cle))[0];
    const part = evolutionDetails(d, nom).dimensions.find(z => z.nom === dim).indicateurs.find(i => i.cle === cle).contributionPoints;
    const f = (v, dec) => evolutionFmt(v, dec);
    const lignes = x.lignes.map(l => `<tr><td>${l.contribution === null ? '' : evolutionFleche(l.contribution, l.decContribution) + ' '}${l.libelle}</td><td>${f(l.v0, l.dec)}</td><td>${f(l.v1, l.dec)}</td>` +
        `<td>${evolutionSigne(l.v1 - l.v0, l.dec)}</td><td>${l.contribution === null ? '' : `<strong>${evolutionSigne(l.contribution, l.decContribution)}</strong>`}</td></tr>`).join('');
    const t = x.total;
    const entete = x.lignes.length ? `<tr><th>Composante</th><th>${a0}</th><th>${a1}</th><th>Écart</th><th>Contribution</th></tr>` : '';
    return `<div class="evolution-petit">${x.intro}</div>` +
        `<table class="evolution-table evolution-table-detail">${entete}${lignes}` +
        `<tr class="evolution-total"><td>${EVOLUTION_NOMS_INDICATEURS[cle]}</td><td>${f(t.v0, t.dec)}</td><td>${f(t.v1, t.dec)}</td><td><strong>${evolutionSigne(t.v1 - t.v0, t.dec)}</strong></td><td>${x.lignes.length ? 'somme des contributions' : ''}</td></tr></table>` +
        (x.lignes.length ? `<div class="evolution-petit">${x.colonne === 'Valeur' ? '' : `Colonnes 2016 et 2021 : ${x.colonne.charAt(0).toLowerCase() + x.colonne.slice(1)}. `}▲ composante qui fait monter l'indicateur, ▼ qui le fait baisser.</div>` : '') +
        (x.note ? `<div class="evolution-petit">${x.note}</div>` : '') +
        `<div class="evolution-petit">Dans la dimension ${EVOLUTION_VARIABLES[dim]}, cet indicateur contribue pour <strong>${evolutionSigne(part, 2)} point</strong> (sur 10) à l'évolution du score.</div>`;
}

function evolutionFicheContenu(nom) {
    const d = evolutionDonnees;
    const [a0, a1] = d.annees;
    const c = d.communes[nom];
    const lignes = Object.keys(EVOLUTION_NOMS_INDICATEURS).map(k => {
        const x0 = c[String(a0)].indicateurs[k], x1 = c[String(a1)].indicateurs[k];
        const dec = EVOLUTION_DECIMALES[k] ?? 2;
        const ouvert = evolutionDetailsOuverts.has(k);
        return `<tr class="evolution-ligne-score" data-variable="${k}" tabindex="0" role="button" aria-expanded="${ouvert}" title="Cliquer pour ${ouvert ? 'replier' : 'voir'} le détail du calcul"><td>${ouvert ? '▾' : '▸'} ${EVOLUTION_NOMS_INDICATEURS[k]}</td><td>${evolutionFmt(x0, dec)}</td><td>${evolutionFmt(x1, dec)}</td><td><strong>${evolutionSigne(x1 - x0, dec)}</strong></td></tr>` +
            (ouvert ? `<tr class="evolution-detail"><td colspan="4">${evolutionIndicateurHtml(k, nom)}</td></tr>` : '');
    }).join('');
    const scores = Object.keys(EVOLUTION_VARIABLES).map(v => {
        const v0 = evolutionValeur(d, nom, a0, v), v1 = evolutionValeur(d, nom, a1, v);
        const ouvert = evolutionDetailsOuverts.has(v);
        return `<tr class="evolution-ligne-score" data-variable="${v}" tabindex="0" role="button" aria-expanded="${ouvert}" title="Cliquer pour ${ouvert ? 'replier' : 'voir'} le détail du calcul"><td>${ouvert ? '▾' : '▸'} ${EVOLUTION_VARIABLES[v]}</td><td>${evolutionFmt(v0)}</td><td>${evolutionFmt(v1)}</td><td><strong>${evolutionSigne(v1 - v0, 2)}</strong></td></tr>` +
            (ouvert ? `<tr class="evolution-detail"><td colspan="4">${evolutionDetailHtml(v, nom)}</td></tr>` : '');
    }).join('');
    const estime = [a0, a1].filter(a => c[String(a)].vec1_departementale);
    return `<h4>${evolutionEchapper(nom)}</h4>` +
        `<table class="evolution-table"><tr><th>Scores (0-10)</th><th>${a0}</th><th>${a1}</th><th>Évolution</th></tr>${scores}` +
        `<tr><th>Indicateurs bruts</th><th>${a0}</th><th>${a1}</th><th>Évolution</th></tr>${lignes}</table>` +
        `<div class="evolution-petit">Cliquez sur un score ou sur un indicateur pour voir le détail du calcul et ce qui l'a fait monter ou baisser.</div>` +
        (estime.length ? `<div class="evolution-petit">Médiane du niveau de vie non diffusée par l'INSEE pour ${estime.join(' et ')} : valeur du département.</div>` : '');
}

function evolutionAfficherFiche() {
    document.getElementById('evolution-fiche').innerHTML = evolutionFicheContenu(evolutionSelection);
    document.querySelector('.evolution-bas').classList.toggle('avec-detail', evolutionDetailsOuverts.size > 0);      // le panneau du bas grandit quand un détail est déplié
}

function evolutionFiche(nom) {
    evolutionSelection = nom;
    for (const type of ['a0', 'a1', 'variation']) {
        evolutionCouches[type].eachLayer(l => { l.setStyle(evolutionStyle(type, l._evolutionNom)); if (l._evolutionNom === nom) l.bringToFront(); });
    }
    evolutionAfficherFiche();
}

function evolutionBasculerDetail(variable) {
    if (!evolutionSelection) return;
    if (evolutionDetailsOuverts.has(variable)) evolutionDetailsOuverts.delete(variable); else evolutionDetailsOuverts.add(variable);
    evolutionAfficherFiche();
    const ligne = document.querySelector(`#evolution-fiche .evolution-ligne-score[data-variable="${variable}"]`);
    if (ligne) ligne.focus();
}

function evolutionRedessiner() {
    for (const type of ['a0', 'a1', 'variation']) {
        if (evolutionCouches[type]) evolutionCouches[type].eachLayer(l => {
            l.setStyle(evolutionStyle(type, l._evolutionNom));
            l.setTooltipContent(evolutionInfobulle(type, l._evolutionNom));
        });
    }
    evolutionLegendes();
    evolutionResumeHtml();
}

let evolutionEnCours = false;
let evolutionAgrandie = null;      // 'a0' | 'a1' | 'variation' quand une carte est agrandie, sinon null

// Loupe : la carte choisie prend la grande colonne, les deux autres sont rangées en petit à droite ; un second clic sur la loupe de la carte agrandie rétablit les trois cartes.
function evolutionAgrandir(type) {
    const conteneur = document.getElementById('evolution-cartes');
    evolutionAgrandie = evolutionAgrandie === type ? null : type;
    conteneur.classList.toggle('zoom', evolutionAgrandie !== null);
    conteneur.querySelectorAll('.evolution-carte').forEach(c => c.classList.toggle('agrandie', c.dataset.carte === evolutionAgrandie));
    conteneur.querySelectorAll('.evolution-loupe').forEach(b => {
        const ouverte = b.dataset.carte === evolutionAgrandie;
        b.textContent = ouverte ? '↩' : '🔍';
        b.title = ouverte ? 'Revenir aux trois cartes' : 'Agrandir cette carte';
    });
    evolutionRecadrage = true;                     // les observateurs de taille (voir l'initialisation) recadrent chaque carte dès que sa taille a changé
    evolutionRecadrer();
    setTimeout(() => { evolutionRecadrer(); evolutionRecadrage = false; }, 600);
}

// Chaque carte s'adapte à son conteneur ; pendant un changement de disposition, elle recadre la Corse entière
let evolutionRecadrage = false;
function evolutionRecadrer(type) {
    const types = type ? [type] : Object.keys(evolutionCartes);
    for (const t of types) {
        const c = evolutionCartes[t];
        if (!c) continue;
        c.stop();                                   // interrompt une animation de zoom en cours, qui écraserait le recadrage
        c.invalidateSize({ animate: false });
        if (!evolutionRecadrage) continue;
        if (evolutionAgrandie || t === 'a0') c.fitBounds(evolutionCouches[t].getBounds(), { padding: [8, 8], animate: false });   // vues liées : a0 suffit quand les trois cartes sont affichées
    }
}

function evolutionBasculerResume(ouvrir) {
    const panneau = document.getElementById('evolution-resume'), bouton = document.getElementById('evolution-bouton-resume');
    const afficher = ouvrir === undefined ? panneau.hidden : ouvrir;
    panneau.hidden = !afficher;
    bouton.setAttribute('aria-expanded', String(afficher));
    bouton.textContent = afficher ? 'Résumé chiffré ▴' : 'Résumé chiffré ▾';
}

async function initialiserOngletEvolution() {
    if (evolutionEnCours) return;
    if (evolutionInitialise) {
        setTimeout(() => Object.values(evolutionCartes).forEach(c => c.invalidateSize()), 100);
        return;
    }
    if (typeof communeJson === 'undefined' || !communeJson || !communeJson.features) {          // géométries pas encore chargées : on réessaie
        setTimeout(() => { if (document.getElementById('evolutiontab').classList.contains('active')) initialiserOngletEvolution(); }, 400);
        return;
    }
    evolutionEnCours = true;
    try {
        const reponse = await fetch(BASE_PATH + 'serie_temporelle.json?v=20261016a');
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
        evolutionDonnees = await reponse.json();
    } catch (e) {
        console.warn('Évolution : serie_temporelle.json non chargé', e);
        document.getElementById('evolution-resume').textContent = 'Données de la série temporelle indisponibles.';
        evolutionEnCours = false;
        return;
    }
    evolutionInitialise = true;
    evolutionEnCours = false;
    const [a0, a1] = evolutionDonnees.annees;
    document.getElementById('evolution-titre-a0').textContent = a0;
    document.getElementById('evolution-titre-a1').textContent = a1;
    const ids = { a0: 'map-evolution-a0', a1: 'map-evolution-a1', variation: 'map-evolution-variation' };
    for (const [type, id] of Object.entries(ids)) {
        const carte = L.map(document.getElementById(id), { center: [42.0, 9.0], zoom: 7.4, zoomSnap: 0.1, zoomDelta: 0.1, attributionControl: false });
        carte.getContainer().style.backgroundColor = '#ffffff';
        evolutionCartes[type] = carte;
        evolutionCouches[type] = L.geoJSON(communeJson, {
            style: f => evolutionStyle(type, f.properties.nom),
            onEachFeature: (f, layer) => {
                const nom = f.properties.nom;
                layer._evolutionNom = nom;
                layer.bindTooltip(evolutionInfobulle(type, nom));
                layer.on('click', () => evolutionFiche(nom));
            },
        }).addTo(carte);
    }
    const fiche = document.getElementById('evolution-fiche');
    fiche.addEventListener('click', e => { const l = e.target.closest('.evolution-ligne-score'); if (l) evolutionBasculerDetail(l.dataset.variable); });
    fiche.addEventListener('keydown', e => { const l = e.target.closest('.evolution-ligne-score'); if (l && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); evolutionBasculerDetail(l.dataset.variable); } });
    if (typeof ResizeObserver !== 'undefined') {
        for (const [type, id] of Object.entries(ids)) new ResizeObserver(() => evolutionRecadrer(type)).observe(document.getElementById(id));
    }
    // les trois cartes bougent ensemble
    let enCours = false;
    for (const [type, carte] of Object.entries(evolutionCartes)) {
        carte.on('move', () => {
            if (enCours || evolutionAgrandie) return;       // vues indépendantes quand une carte est agrandie
            enCours = true;
            for (const [autre, c] of Object.entries(evolutionCartes)) if (autre !== type) c.setView(carte.getCenter(), carte.getZoom(), { animate: false });
            enCours = false;
        });
    }
    document.getElementById('evolution-variable').addEventListener('change', function () {
        evolutionVariable = this.value;
        evolutionRedessiner();
        if (evolutionSelection) evolutionFiche(evolutionSelection);
    });
    evolutionRedessiner();
    setTimeout(() => {
        Object.values(evolutionCartes).forEach(c => c.invalidateSize());
        if (!evolutionAgrandie) evolutionCartes.a0.fitBounds(evolutionCouches.a0.getBounds(), { padding: [8, 8], animate: false });   // les autres cartes suivent (vues liées)
    }, 150);
}

// Ouverture de l'onglet : l'initialisation est déclenchée ici (et non dans script.js), après le changement d'onglet fait par script.js
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const bouton = document.querySelector('.tab-button[data-tab="evolutiontab"]');
        if (bouton) bouton.addEventListener('click', () => setTimeout(initialiserOngletEvolution, 0));
        document.querySelectorAll('.evolution-loupe').forEach(b => b.addEventListener('click', () => { if (evolutionInitialise) evolutionAgrandir(b.dataset.carte); }));
        const boutonResume = document.getElementById('evolution-bouton-resume');
        if (boutonResume) {
            boutonResume.addEventListener('click', e => { e.stopPropagation(); evolutionBasculerResume(); });
            document.addEventListener('click', e => { if (!e.target.closest('.evolution-resume-zone')) evolutionBasculerResume(false); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') evolutionBasculerResume(false); });
        }
        // panneau latéral masqué dans l'onglet Évolution (classe sur <body>), restauré dans les autres ; les cartes se redimensionnent
        document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => {
            document.body.classList.toggle('mode-evolution', b.getAttribute('data-tab') === 'evolutiontab');
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
                Object.values(evolutionCartes).forEach(c => c.invalidateSize());
            }, 150);
        }));
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { evolutionCalcul, evolutionDetails, evolutionComposantes, evolutionClasse, evolutionCouleursVariation, evolutionValeur, evolutionVariation, evolutionResume, EVOLUTION_SEUILS_VARIATION, EVOLUTION_NEUTRE };
}
