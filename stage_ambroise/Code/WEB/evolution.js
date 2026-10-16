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

function evolutionFiche(nom) {
    const d = evolutionDonnees;
    evolutionSelection = nom;
    for (const type of ['a0', 'a1', 'variation']) {
        evolutionCouches[type].eachLayer(l => { l.setStyle(evolutionStyle(type, l._evolutionNom)); if (l._evolutionNom === nom) l.bringToFront(); });
    }
    const [a0, a1] = d.annees;
    const c = d.communes[nom];
    const signe = (x, dec) => (Number(x.toFixed(dec)) > 0 ? '+' : '') + evolutionFmt(x, dec);    // « + » seulement si l'écart arrondi est positif
    const lignes = Object.keys(EVOLUTION_NOMS_INDICATEURS).map(k => {
        const x0 = c[String(a0)].indicateurs[k], x1 = c[String(a1)].indicateurs[k];
        const dec = k === 'Opp3' || k === 'Vec1' ? 0 : 2;
        return `<tr><td>${EVOLUTION_NOMS_INDICATEURS[k]}</td><td>${evolutionFmt(x0, dec)}</td><td>${evolutionFmt(x1, dec)}</td><td><strong>${signe(x1 - x0, dec)}</strong></td></tr>`;
    }).join('');
    const scores = Object.keys(EVOLUTION_VARIABLES).map(v => {
        const v0 = evolutionValeur(d, nom, a0, v), v1 = evolutionValeur(d, nom, a1, v);
        return `<tr><td>${EVOLUTION_VARIABLES[v]}</td><td>${evolutionFmt(v0)}</td><td>${evolutionFmt(v1)}</td><td><strong>${signe(v1 - v0, 2)}</strong></td></tr>`;
    }).join('');
    const estime = [a0, a1].filter(a => c[String(a)].vec1_departementale);
    document.getElementById('evolution-fiche').innerHTML =
        `<h4>${evolutionEchapper(nom)}</h4>` +
        `<table class="evolution-table"><tr><th>Scores (0-10)</th><th>${a0}</th><th>${a1}</th><th>Évolution</th></tr>${scores}` +
        `<tr><th>Indicateurs bruts</th><th>${a0}</th><th>${a1}</th><th>Évolution</th></tr>${lignes}</table>` +
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
    module.exports = { evolutionClasse, evolutionCouleursVariation, evolutionValeur, evolutionVariation, evolutionResume, EVOLUTION_SEUILS_VARIATION, EVOLUTION_NEUTRE };
}
