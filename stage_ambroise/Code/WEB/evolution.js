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
    Cho2: 'Cho2 · part de Français, 18 ans et plus (%)', Vec1: 'Vec1 · médiane du niveau de vie (€)', Vec2: 'Vec2 · logement', Vec3: 'Vec3 · stabilité de l\'emploi',
};
// Évolution (points sur 10) : 5 classes symétriques autour de 0 ; rouge = recul, bleu = progression
const EVOLUTION_SEUILS_VARIATION = [-1.5, -0.5, 0.5, 1.5];
const EVOLUTION_COULEURS_VARIATION = ['#b2182b', '#ef8a62', '#f0f0f0', '#67a9cf', '#2166ac'];
const EVOLUTION_LIBELLES_VARIATION = ['recul fort (< −1,5)', 'recul (−1,5 à −0,5)', 'stable (±0,5)', 'progression (0,5 à 1,5)', 'progression forte (> 1,5)'];

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

// ---------- Affichage ----------

function evolutionEchapper(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const evolutionFmt = (x, d = 2) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

function evolutionCouleurAnnee(valeur) {
    return colorsJenks[evolutionClasse(valeur, evolutionDonnees.seuils_jenks[evolutionVariable])];
}
function evolutionCouleurVariation(v) {
    return EVOLUTION_COULEURS_VARIATION[evolutionClasse(v, EVOLUTION_SEUILS_VARIATION)];
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
    document.getElementById('evolution-legende-variation').innerHTML =
        `<strong>Évolution ${d.annees[0]} → ${d.annees[1]} (points sur 10)</strong> ` +
        EVOLUTION_LIBELLES_VARIATION.map((l, i) => `<span class="evolution-classe">${pastille(EVOLUTION_COULEURS_VARIATION[i])}${l}</span>`).join('');
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

function evolutionFiche(nom) {
    const d = evolutionDonnees;
    evolutionSelection = nom;
    for (const type of ['a0', 'a1', 'variation']) {
        evolutionCouches[type].eachLayer(l => { l.setStyle(evolutionStyle(type, l._evolutionNom)); if (l._evolutionNom === nom) l.bringToFront(); });
    }
    const [a0, a1] = d.annees;
    const c = d.communes[nom];
    const lignes = Object.keys(EVOLUTION_NOMS_INDICATEURS).map(k => {
        const x0 = c[String(a0)].indicateurs[k], x1 = c[String(a1)].indicateurs[k];
        const dec = k === 'Opp3' || k === 'Vec1' ? 0 : 2;
        return `<tr><td>${EVOLUTION_NOMS_INDICATEURS[k]}</td><td>${evolutionFmt(x0, dec)}</td><td>${evolutionFmt(x1, dec)}</td></tr>`;
    }).join('');
    const scores = Object.keys(EVOLUTION_VARIABLES).map(v => {
        const v0 = evolutionValeur(d, nom, a0, v), v1 = evolutionValeur(d, nom, a1, v);
        return `<tr><td>${EVOLUTION_VARIABLES[v]}</td><td>${evolutionFmt(v0)}</td><td>${evolutionFmt(v1)}</td><td><strong>${v1 - v0 >= 0 ? '+' : ''}${evolutionFmt(v1 - v0)}</strong></td></tr>`;
    }).join('');
    const estime = [a0, a1].filter(a => c[String(a)].vec1_departementale);
    document.getElementById('evolution-fiche').innerHTML =
        `<h4>${evolutionEchapper(nom)}</h4>` +
        `<table class="evolution-table"><tr><th></th><th>${a0}</th><th>${a1}</th><th>Évolution</th></tr>${scores}</table>` +
        `<table class="evolution-table"><tr><th>Indicateurs bruts</th><th>${a0}</th><th>${a1}</th></tr>${lignes}</table>` +
        (estime.length ? `<div class="evolution-petit">Médiane du niveau de vie non diffusée par l'INSEE pour ${estime.join(' et ')} : valeur du département.</div>` : '');
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
        const reponse = await fetch(BASE_PATH + 'serie_temporelle.json');
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
    // les trois cartes bougent ensemble
    let enCours = false;
    for (const [type, carte] of Object.entries(evolutionCartes)) {
        carte.on('move', () => {
            if (enCours) return;
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
        evolutionCartes.a0.fitBounds(evolutionCouches.a0.getBounds(), { padding: [8, 8] });   // les autres cartes suivent (vues liées)
    }, 150);
}

// Ouverture de l'onglet : l'initialisation est déclenchée ici (et non dans script.js), après le changement d'onglet fait par script.js
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const bouton = document.querySelector('.tab-button[data-tab="evolutiontab"]');
        if (bouton) bouton.addEventListener('click', () => setTimeout(initialiserOngletEvolution, 0));
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
    module.exports = { evolutionClasse, evolutionValeur, evolutionVariation, evolutionResume, EVOLUTION_SEUILS_VARIATION };
}
